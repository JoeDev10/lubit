// =========================================================
// LUBIT · API del panel de administración (función de Vercel)
//
// La página es estática: para guardar cambios hay que escribir en GitHub,
// y eso necesita un token que NO puede estar en el navegador.
// Esta función guarda el token en secreto (variables de entorno de Vercel)
// y solo pide el PIN al dueño del local.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   ADMIN_PIN     PIN de 4 dígitos para entrar al panel
//   GITHUB_TOKEN  token de GitHub con permiso de escritura en el repo (Contents: read & write)
//   GITHUB_REPO   opcional, por defecto "joedev10/lubit"
//   GITHUB_BRANCH opcional, por defecto la rama desde la que se publicó (o "master")
// =========================================================
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'joedev10/lubit';
const BRANCH = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'master';
const ARCHIVO = 'datos.json';
const DURACION_SESION = 1000 * 60 * 60 * 24 * 60; // 60 días: el dueño no tiene que poner el PIN a cada rato
const ORIGENES = ['https://joedev10.github.io'];

// Freno a los intentos de adivinar el PIN (por instancia de la función)
const intentos = new Map();
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

function clave() {
  return crypto.createHash('sha256').update(`${process.env.ADMIN_PIN}:${process.env.GITHUB_TOKEN}`).digest();
}

function firmar(payload) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', clave()).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

function sesionValida(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [cuerpo, firma] = token.split('.');
  const esperada = crypto.createHmac('sha256', clave()).update(cuerpo).digest('base64url');
  const a = Buffer.from(firma), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(cuerpo, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

function pinCorrecto(pin) {
  const a = crypto.createHash('sha256').update(String(pin || '')).digest();
  const b = crypto.createHash('sha256').update(String(process.env.ADMIN_PIN)).digest();
  return crypto.timingSafeEqual(a, b);
}

async function github(ruta, opciones = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'lubit-admin',
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function leerDatos() {
  const r = await github(`contents/${ARCHIVO}?ref=${encodeURIComponent(BRANCH)}`);
  if (!r.ok) throw new Error('No se pudo leer la información de la página');
  return { datos: JSON.parse(Buffer.from(r.data.content, 'base64').toString('utf8')), sha: r.data.sha };
}

async function escribirArchivo(ruta, base64, mensaje, sha) {
  return github(`contents/${ruta}`, {
    method: 'PUT',
    body: JSON.stringify({ message: mensaje, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) })
  });
}

function cors(req, res) {
  const origen = req.headers.origin;
  if (origen && ORIGENES.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  if (!process.env.ADMIN_PIN || !process.env.GITHUB_TOKEN) {
    return res.status(500).json({ error: 'Falta configurar el panel (ADMIN_PIN y GITHUB_TOKEN en Vercel).' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { accion } = body;

  try {
    // ---------- Entrar con PIN ----------
    if (accion === 'entrar') {
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const reg = intentos.get(ip) || { fallos: 0, hasta: 0 };
      if (reg.hasta > Date.now()) {
        const min = Math.ceil((reg.hasta - Date.now()) / 60000);
        return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${min} min.` });
      }
      if (!pinCorrecto(body.pin)) {
        reg.fallos += 1;
        if (reg.fallos >= MAX_FALLOS) { reg.fallos = 0; reg.hasta = Date.now() + BLOQUEO_MS; }
        intentos.set(ip, reg);
        await new Promise(r => setTimeout(r, 500));
        return res.status(401).json({ error: 'PIN incorrecto' });
      }
      intentos.delete(ip);
      return res.json({ sesion: firmar({ exp: Date.now() + DURACION_SESION }), repo: REPO, rama: BRANCH });
    }

    // A partir de acá hace falta una sesión válida
    if (!sesionValida(body.sesion)) return res.status(401).json({ error: 'La sesión venció. Volvé a poner el PIN.', sesion: false });

    if (accion === 'leer') {
      const { datos } = await leerDatos();
      return res.json({ datos, repo: REPO, rama: BRANCH });
    }

    if (accion === 'guardar') {
      const datos = body.datos;
      if (!datos || typeof datos !== 'object' || !Array.isArray(datos.productos)) {
        return res.status(400).json({ error: 'Datos inválidos' });
      }
      const contenido = Buffer.from(JSON.stringify(datos, null, 2) + '\n', 'utf8').toString('base64');
      // Si alguien guardó justo antes, reintentamos con la versión nueva
      for (let i = 0; i < 2; i++) {
        const { sha } = await leerDatos();
        const r = await escribirArchivo(ARCHIVO, contenido, 'Admin: actualizar datos del sitio', sha);
        if (r.ok) return res.json({ ok: true });
        if (r.status !== 409 && r.status !== 422) throw new Error(r.data.message || 'Error al guardar');
      }
      throw new Error('No se pudo guardar, probá de nuevo');
    }

    if (accion === 'foto') {
      const base64 = String(body.base64 || '').replace(/^data:[^,]+,/, '');
      const bytes = Buffer.byteLength(base64, 'base64');
      if (!bytes || bytes > 3.5 * 1024 * 1024) return res.status(400).json({ error: 'La foto es demasiado grande' });
      const ext = /png/i.test(body.tipo || '') ? 'png' : /webp/i.test(body.tipo || '') ? 'webp' : 'jpg';
      const ruta = `imagenes/${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      const r = await escribirArchivo(ruta, base64, 'Admin: subir foto de producto');
      if (!r.ok) throw new Error(r.data.message || 'Error al subir la foto');
      return res.json({ ruta });
    }

    return res.status(400).json({ error: 'Acción desconocida' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error inesperado' });
  }
};

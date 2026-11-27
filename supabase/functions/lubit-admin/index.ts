// LUBIT · API del panel de administración (Supabase Edge Function "lubit-admin")
// Proyecto de Supabase: "eliseo" (qpxqrtcceemdbbkdymjl). Se entra solo con PIN.
// El PIN está en la tabla lubit_config (clave 'pin') y el dueño lo puede cambiar desde el admin.
// Los datos viven en lubit_sitio y las fotos en el bucket público 'lubit'.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

const ORIGENES = ['https://joedev10.github.io', 'http://localhost:5173'];
const DURACION_SESION = 1000 * 60 * 60 * 24 * 60; // 60 días
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const intentos = new Map<string, { fallos: number; hasta: number }>();
const enc = new TextEncoder();

function cors(origen: string | null) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origen && ORIGENES.includes(origen)) {
    h['Access-Control-Allow-Origin'] = origen;
    h['Vary'] = 'Origin';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, apikey, authorization, x-client-info';
  }
  return h;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function leerPin(): Promise<string> {
  const { data, error } = await sb.from('lubit_config').select('valor').eq('clave', 'pin').single();
  if (error || !data) throw new Error('Falta configurar el PIN');
  return String(data.valor);
}

// La firma de la sesión depende del PIN: si se cambia el PIN, las sesiones viejas dejan de valer.
async function hmac(texto: string, pin: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${pin}:${SERVICE}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(texto)));
}

function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function firmar(pin: string) {
  const cuerpo = b64url(enc.encode(JSON.stringify({ exp: Date.now() + DURACION_SESION })));
  return `${cuerpo}.${await hmac(cuerpo, pin)}`;
}

async function sesionValida(token: unknown, pin: string) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [cuerpo, firma] = token.split('.');
  if (!igual(firma, await hmac(cuerpo, pin))) return false;
  try {
    const json = atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).exp > Date.now();
  } catch { return false; }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('origin'));
  const resp = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return resp({ error: 'Método no permitido' }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return resp({ error: 'Pedido inválido' }, 400); }

  try {
    const pin = await leerPin();

    if (body.accion === 'entrar') {
      const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
      const reg = intentos.get(ip) || { fallos: 0, hasta: 0 };
      if (reg.hasta > Date.now()) {
        const min = Math.ceil((reg.hasta - Date.now()) / 60000);
        return resp({ error: `Demasiados intentos. Probá de nuevo en ${min} min.` }, 429);
      }
      if (!igual(String(body.pin ?? ''), pin)) {
        reg.fallos += 1;
        if (reg.fallos >= MAX_FALLOS) { reg.fallos = 0; reg.hasta = Date.now() + BLOQUEO_MS; }
        intentos.set(ip, reg);
        await new Promise((r) => setTimeout(r, 500));
        return resp({ error: 'PIN incorrecto' }, 401);
      }
      intentos.delete(ip);
      return resp({ sesion: await firmar(pin) });
    }

    if (!(await sesionValida(body.sesion, pin))) {
      return resp({ error: 'La sesión venció. Volvé a poner el PIN.', sesion: false }, 401);
    }

    if (body.accion === 'leer') {
      const { data, error } = await sb.from('lubit_sitio').select('datos').eq('id', 1).single();
      if (error) throw new Error('No se pudo leer la información de la página');
      return resp({ datos: data.datos });
    }

    if (body.accion === 'guardar') {
      const datos = body.datos;
      if (!datos || typeof datos !== 'object' || !Array.isArray(datos.productos)) return resp({ error: 'Datos inválidos' }, 400);
      if (JSON.stringify(datos).length > 500_000) return resp({ error: 'Demasiada información' }, 400);
      const { error } = await sb.from('lubit_sitio').upsert({ id: 1, datos, actualizado: new Date().toISOString() });
      if (error) throw new Error('Error al guardar');
      return resp({ ok: true });
    }

    if (body.accion === 'foto') {
      const base64 = String(body.base64 || '').replace(/^data:[^,]+,/, '');
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (!bin.length || bin.length > 3.5 * 1024 * 1024) return resp({ error: 'La foto es demasiado grande' }, 400);
      const tipo = /png/i.test(body.tipo || '') ? 'image/png' : /webp/i.test(body.tipo || '') ? 'image/webp' : 'image/jpeg';
      const ext = tipo.split('/')[1].replace('jpeg', 'jpg');
      const ruta = `productos/${Date.now()}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
      const { error } = await sb.storage.from('lubit').upload(ruta, bin, { contentType: tipo, cacheControl: '31536000' });
      if (error) throw new Error('Error al subir la foto');
      const { data } = sb.storage.from('lubit').getPublicUrl(ruta);
      return resp({ ruta: data.publicUrl });
    }

    // Cambiar el PIN: pide el actual para confirmar. Devuelve una sesión nueva
    // (las de otros dispositivos se cierran y tienen que entrar con el PIN nuevo).
    if (body.accion === 'pin') {
      if (!igual(String(body.actual ?? ''), pin)) return resp({ error: 'El PIN actual no es correcto' }, 400);
      const nuevo = String(body.nuevo ?? '');
      if (!/^\d{4}$/.test(nuevo)) return resp({ error: 'El PIN nuevo tiene que tener 4 números' }, 400);
      const { error } = await sb.from('lubit_config').update({ valor: nuevo }).eq('clave', 'pin');
      if (error) throw new Error('No se pudo cambiar el PIN');
      return resp({ ok: true, sesion: await firmar(nuevo) });
    }

    return resp({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return resp({ error: (e as Error).message || 'Error inesperado' }, 500);
  }
});

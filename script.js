// =========================================================
// LUBIT · página pública
// Todo el contenido sale de datos.json (se edita desde admin.html)
// =========================================================

let WA_NUMBER = '5491131706948';
let DATOS = null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Acepta "11 3170-6948", "1131706948", "+54 9 11...", etc. y lo deja listo para wa.me
function normalizarWhatsapp(num) {
  let d = String(num || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  d = d.replace(/^0/, '');
  // "11 15 3170 6948" → quita el 15 después del código de área de Buenos Aires
  if (d.length === 12 && d.startsWith('1115')) d = '11' + d.slice(4);
  return '549' + d;
}

function waUrl(texto) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(texto)}`;
}

function bindWaLinks(ctx = document) {
  $$('[data-wa]', ctx).forEach(a => {
    a.href = waUrl(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

// Las fotos subidas desde el admin quedan como "imagenes/xxx.jpg" (ruta relativa)
function fotoUrl(src) { return src; }

// =========================================================
// CARGA DE DATOS
// =========================================================
// Los datos se editan desde el admin y viven en Supabase.
// Si la base no responde, se usa la copia de respaldo datos.json.
const SB_URL = 'https://qpxqrtcceemdbbkdymjl.supabase.co';
const SB_KEY = 'sb_publishable_aM4WcDMJpF1kL8EHQrabNg_nLGZ6-jD';

async function cargarDatos() {
  DATOS = {};
  try {
    const res = await fetch(`${SB_URL}/rest/v1/lubit_sitio?select=datos&id=eq.1`, { headers: { apikey: SB_KEY } });
    if (!res.ok) throw new Error();
    const filas = await res.json();
    if (!filas[0] || !filas[0].datos) throw new Error();
    DATOS = filas[0].datos;
  } catch {
    try {
      const res = await fetch('datos.json?t=' + Date.now());
      if (res.ok) DATOS = await res.json();
    } catch {}
  }
  const d = DATOS;
  if (d.contacto) renderContacto(d.contacto);
  renderNegocio(d.negocio || {});
  renderReparaciones(d.reparaciones || []);
  renderProductos(d.productos || []);
  renderTestimonios(d.testimonios || []);
  renderFAQ(d.faq || []);
  bindWaLinks();
  observarReveal();
}

// =========================================================
// NEGOCIO / PORTADA
// =========================================================
function renderNegocio(n) {
  if (n.aviso) $('#aviso').textContent = n.aviso;
  else $('.topbar').hidden = true;

  if (n.titulo) {
    // La última oración del título va resaltada en azul
    const partes = n.titulo.trim().match(/^(.*[.!?¡¿])\s+(.+)$/);
    $('#heroTitulo').innerHTML = partes ? `${esc(partes[1])} <em>${esc(partes[2])}</em>` : esc(n.titulo);
  }
  if (n.subtitulo) $('#heroSubtitulo').textContent = n.subtitulo;

  const stats = (n.stats || []).filter(s => s.numero);
  $('#heroStats').innerHTML = stats.map(s => `<li><strong>${esc(s.numero)}</strong><span>${esc(s.texto)}</span></li>`).join('');

  if (n.pagos) $('#payLine span').textContent = n.pagos;
  else $('#payLine').hidden = true;

  const ig = $('#linkInstagram'), fb = $('#linkFacebook');
  if (n.instagram) ig.href = n.instagram; else ig.hidden = true;
  if (n.facebook) fb.href = n.facebook; else fb.hidden = true;
}

// =========================================================
// CONTACTO
// =========================================================
function renderContacto(c) {
  const wa = normalizarWhatsapp(c.whatsapp);
  if (wa) WA_NUMBER = wa;

  $('#infoDireccion').textContent = [c.direccion, c.localidad].filter(Boolean).join(', ');
  if (c.horario) $('#infoHorario').textContent = c.horario;

  const local = WA_NUMBER.slice(3);
  $('#infoWhatsapp').textContent = local.length === 10 ? `${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}` : local;

  if (c.email) { $('#infoEmail').textContent = c.email; $('#infoEmail').href = 'mailto:' + c.email; }
  else $('#rowEmail').hidden = true;

  const q = encodeURIComponent([c.direccion, c.localidad || 'Buenos Aires', 'Argentina'].filter(Boolean).join(', '));
  $('#mapaIframe').src = `https://maps.google.com/maps?q=${q}&z=16&output=embed`;
  const llegar = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $('#btnComoLlegar').href = llegar;
  $('#dockMapa').href = llegar;

  renderAbierto(c.horario || '');
}

// Lee un horario tipo "Lun–Sáb: 10:00 a 19:00 hs" y muestra "Abierto ahora" / "Cerrado"
function renderAbierto(horario) {
  const el = $('#heroHorario');
  const dot = $('.eyebrow .dot');
  const m = horario.match(/(\d{1,2})[:.]?(\d{2})?\s*(?:a|-|–)\s*(\d{1,2})[:.]?(\d{2})?/);
  if (!m) { el.textContent = horario || 'Consultanos por WhatsApp'; return; }
  const abre = (+m[1]) * 60 + (+(m[2] || 0));
  const cierra = (+m[3]) * 60 + (+(m[4] || 0));
  const dias = ['dom', 'lun', 'mar', 'mi', 'jue', 'vie', 's'];
  const txt = horario.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rango = txt.match(/(dom|lun|mar|mie|jue|vie|sab)\w*\s*(?:a|-|–|—)\s*(dom|lun|mar|mie|jue|vie|sab)/);
  const idx = s => dias.findIndex(d => s.startsWith(d));
  const ahora = new Date();
  const hoy = ahora.getDay();
  let abreHoy = true;
  if (rango) {
    const a = idx(rango[1]), b = idx(rango[2]);
    abreHoy = a <= b ? hoy >= a && hoy <= b : hoy >= a || hoy <= b;
  }
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const abierto = abreHoy && min >= abre && min < cierra;
  el.textContent = abierto ? `Abierto ahora · hasta las ${m[3]}:${m[4] || '00'} hs` : `Cerrado ahora · ${horario}`;
  dot.classList.toggle('closed', !abierto);
}

// =========================================================
// REPARACIONES + COTIZADOR
// =========================================================
function renderReparaciones(lista) {
  const grid = $('#repairsGrid');
  grid.innerHTML = lista.map(r => `
    <article class="repair reveal">
      <div class="repair-icon"><i class="${esc(r.icono || 'fa-solid fa-screwdriver-wrench')}"></i></div>
      <h3>${esc(r.titulo)}</h3>
      <p>${esc(r.descripcion)}</p>
      <div class="repair-foot">
        ${r.precio ? `<span class="repair-price">${esc(r.precio)}</span>` : ''}
        <a class="repair-link" href="#" data-wa="${esc(`Hola Lubit! Quiero cotizar: ${r.titulo}. Mi celular es un `)}">Cotizar <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </article>`).join('');

  // Sticker del hero con el precio de pantallas
  const pantalla = lista.find(r => /pantalla/i.test(r.titulo));
  if (pantalla && pantalla.precio) {
    $('#stickerPrecio').innerHTML = `<small>${esc(pantalla.titulo)}</small><strong>${esc(pantalla.precio.replace(/^Desde/i, 'desde'))}</strong>`;
  } else {
    $('#stickerPrecio').hidden = true;
  }

  // Opciones del cotizador
  const problemas = [...lista.map(r => r.titulo), 'Otro problema'];
  $('#quoteProblemas').innerHTML = problemas.map(p =>
    `<label><input type="radio" name="problema" value="${esc(p)}" /><span>${esc(p)}</span></label>`).join('');
}

function initCotizador() {
  const form = $('#quoteForm');
  form.addEventListener('change', () => {
    $('#quoteError').hidden = true;
    const prob = form.problema?.value;
    const rep = (DATOS?.reparaciones || []).find(r => r.titulo === prob);
    const box = $('#quoteResult');
    if (rep && rep.precio) { $('#quotePrecio').textContent = rep.precio; box.hidden = false; }
    else box.hidden = true;
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const marca = form.marca?.value;
    const prob = form.problema?.value;
    if (!marca || !prob) { $('#quoteError').hidden = false; return; }
    const modelo = $('#quoteModelo').value.trim();
    const equipo = [marca, modelo].filter(Boolean).join(' ');
    const texto = `Hola Lubit! Quiero un presupuesto.\n📱 Equipo: *${equipo}*\n🔧 Problema: *${prob}*\n¿Cuánto sale y cuánto tarda?`;
    window.open(waUrl(texto), '_blank', 'noopener');
  });
}

// =========================================================
// PRODUCTOS
// =========================================================
const MARCA_LABEL = { apple: 'Apple', samsung: 'Samsung', motorola: 'Motorola', xiaomi: 'Xiaomi', lg: 'LG', otro: 'Otras' };
const labelMarca = m => MARCA_LABEL[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : '');

function renderProductos(productos) {
  const grid = $('#productsGrid');
  const lista = productos.filter(p => p.nombre);
  // Primero los disponibles, los vendidos al final
  lista.sort((a, b) => (a.vendido === true) - (b.vendido === true));

  if (!lista.length) {
    grid.innerHTML = `
      <div class="empty">
        <i class="fa-solid fa-mobile-screen-button"></i>
        <h3>Estamos renovando el stock</h3>
        <p>Escribinos y te contamos qué equipos tenemos disponibles hoy.</p>
        <a href="#" class="btn btn-wa" data-wa="Hola Lubit! ¿Qué celulares tienen disponibles?"><i class="fa-brands fa-whatsapp"></i> Consultar stock</a>
      </div>`;
    $('#filters').innerHTML = '';
    return;
  }

  grid.innerHTML = '';
  lista.forEach(p => grid.appendChild(cardProducto(p)));

  const marcas = [...new Set(lista.map(p => p.marca).filter(Boolean))];
  const filters = $('#filters');
  filters.innerHTML = marcas.length > 1
    ? `<button class="filter active" data-f="all">Todos</button>` + marcas.map(m => `<button class="filter" data-f="${esc(m)}">${esc(labelMarca(m))}</button>`).join('')
    : '';
  filters.onclick = e => {
    const b = e.target.closest('.filter'); if (!b) return;
    $$('.filter', filters).forEach(x => x.classList.toggle('active', x === b));
    $$('.product', grid).forEach(c => c.classList.toggle('hidden', b.dataset.f !== 'all' && c.dataset.brand !== b.dataset.f));
  };
}

function cardProducto(p) {
  const fotos = (p.fotos || []).filter(Boolean);
  const card = document.createElement('article');
  card.className = 'product reveal';
  card.dataset.brand = p.marca || '';

  const tags = [];
  if (p.condicion) tags.push(`<span class="tag cond">${esc(p.condicion)}</span>`);
  if (p.badge) tags.push(`<span class="tag ${p.badge === 'Hot' ? 'hot' : p.badge === 'Oferta' ? 'offer' : ''}">${esc(p.badge === 'Hot' ? '🔥 Más vendido' : p.badge)}</span>`);

  const specs = [];
  if (p.almacenamiento) specs.push(`<span><i class="fa-solid fa-database"></i>${esc(p.almacenamiento)}</span>`);
  if (p.bateria) specs.push(`<span><i class="fa-solid fa-battery-three-quarters"></i>Batería ${esc(p.bateria)}</span>`);

  const galeria = fotos.length
    ? `<div class="gallery-track">${fotos.map((f, i) => `<img src="${esc(fotoUrl(f))}" alt="${esc(p.nombre)} foto ${i + 1}" loading="lazy" />`).join('')}</div>
       ${fotos.length > 1 ? `
         <button class="gallery-arrow prev" aria-label="Foto anterior"><i class="fa-solid fa-chevron-left"></i></button>
         <button class="gallery-arrow next" aria-label="Foto siguiente"><i class="fa-solid fa-chevron-right"></i></button>
         <div class="gallery-dots">${fotos.map((_, i) => `<span class="${i ? '' : 'on'}"></span>`).join('')}</div>` : ''}`
    : `<div class="gallery-empty"><i class="fa-solid fa-mobile-screen-button"></i></div>`;

  const vendido = p.vendido === true;
  const btn = vendido
    ? `<a href="#" class="btn btn-ghost full" data-wa="${esc(`Hola Lubit! Vi que el ${p.nombre} está vendido. ¿Les va a entrar otro o tienen algo parecido?`)}">Avisame si vuelve</a>`
    : `<a href="#" class="btn btn-wa full" data-wa="${esc(`Hola Lubit! Me interesa el ${p.nombre}${p.almacenamiento ? ' ' + p.almacenamiento : ''}${p.precio ? ' (' + p.precio + ')' : ''}. ¿Sigue disponible?`)}"><i class="fa-brands fa-whatsapp"></i> Lo quiero</a>`;

  card.innerHTML = `
    <div class="gallery">
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
      ${galeria}
      ${vendido ? '<div class="sold-overlay"><span>Vendido</span></div>' : ''}
    </div>
    <div class="product-body">
      <span class="product-brand">${esc(labelMarca(p.marca))}</span>
      <h3>${esc(p.nombre)}</h3>
      ${specs.length ? `<div class="specs">${specs.join('')}</div>` : ''}
      ${p.descripcion ? `<p class="product-desc">${esc(p.descripcion)}</p>` : ''}
      <div class="price-block">
        ${p.precio ? `<div class="price">${esc(p.precio)}</div>` : '<div class="price ask">Consultá el precio</div>'}
        ${p.cuotas ? `<div class="cuotas">${esc(p.cuotas)}</div>` : ''}
      </div>
      ${btn}
    </div>`;

  initGaleria(card, fotos);
  return card;
}

function initGaleria(card, fotos) {
  const track = $('.gallery-track', card);
  if (!track) return;
  const dots = $$('.gallery-dots span', card);
  const go = dir => track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
  $('.gallery-arrow.prev', card)?.addEventListener('click', () => go(-1));
  $('.gallery-arrow.next', card)?.addEventListener('click', () => go(1));
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, j) => d.classList.toggle('on', i === j));
  }, { passive: true });
  $$('img', track).forEach((img, i) => img.addEventListener('click', () => abrirLightbox(fotos.map(fotoUrl), i)));
}

// =========================================================
// TESTIMONIOS + FAQ
// =========================================================
function renderTestimonios(lista) {
  const grid = $('#reviewsGrid');
  const validos = lista.filter(t => t.texto);
  if (!validos.length) { $('#opiniones').hidden = true; return; }
  grid.innerHTML = validos.map(t => {
    const ini = (t.nombre || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return `
      <figure class="review reveal">
        <div class="stars" aria-label="5 estrellas">★★★★★</div>
        <blockquote>“${esc(t.texto)}”</blockquote>
        <figcaption class="reviewer">
          <div class="avatar">${esc(ini)}</div>
          <div><strong>${esc(t.nombre)}</strong><span>${esc(t.detalle)}</span></div>
        </figcaption>
      </figure>`;
  }).join('');
}

function renderFAQ(lista) {
  $('#faqList').innerHTML = lista.filter(f => f.pregunta).map(f => `
    <details class="faq-item reveal">
      <summary>${esc(f.pregunta)}</summary>
      <p>${esc(f.respuesta)}</p>
    </details>`).join('');
  // Solo una abierta a la vez
  $$('#faqList details').forEach(d => d.addEventListener('toggle', () => {
    if (d.open) $$('#faqList details').forEach(o => { if (o !== d) o.open = false; });
  }));
}

// =========================================================
// LIGHTBOX
// =========================================================
const lb = { fotos: [], i: 0 };
function abrirLightbox(fotos, i) {
  lb.fotos = fotos; lb.i = i;
  $('#lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  pintarLightbox();
}
function cerrarLightbox() { $('#lightbox').classList.remove('open'); document.body.style.overflow = ''; }
function moverLightbox(d) { lb.i = (lb.i + d + lb.fotos.length) % lb.fotos.length; pintarLightbox(); }
function pintarLightbox() {
  $('#lbImg').src = lb.fotos[lb.i];
  const varias = lb.fotos.length > 1;
  $('#lbPrev').hidden = $('#lbNext').hidden = !varias;
  $('#lbCount').textContent = varias ? `${lb.i + 1} / ${lb.fotos.length}` : '';
}
$('#lbClose').addEventListener('click', cerrarLightbox);
$('#lbPrev').addEventListener('click', () => moverLightbox(-1));
$('#lbNext').addEventListener('click', () => moverLightbox(1));
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') cerrarLightbox(); });
document.addEventListener('keydown', e => {
  if (!$('#lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') cerrarLightbox();
  if (e.key === 'ArrowLeft') moverLightbox(-1);
  if (e.key === 'ArrowRight') moverLightbox(1);
});

// =========================================================
// NAV, MENÚ, ANIMACIONES
// =========================================================
const burger = $('#burger'), menu = $('#mobileMenu');
burger.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
$$('a', menu).forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }));

window.addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 10), { passive: true });

const io = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 })
  : null;
function observarReveal() {
  $$('.reveal:not(.in)').forEach(el => io ? io.observe(el) : el.classList.add('in'));
}
$$('.steps li, .quote, .visit-card').forEach(el => el.classList.add('reveal'));

$('#year').textContent = new Date().getFullYear();

bindWaLinks();
initCotizador();
cargarDatos();

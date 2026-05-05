// =============================================
// CONFIGURACIÓN
// =============================================
const WHATSAPP_NUMBER = '5491131706948';

// =============================================
// DATOS DINÁMICOS DESDE datos.json
// =============================================

async function cargarDatos() {
  try {
    const res = await fetch('datos.json?t=' + Date.now());
    if (!res.ok) return;
    const datos = await res.json();
    if (datos.reparaciones) renderReparaciones(datos.reparaciones);
    if (datos.contacto) renderContacto(datos.contacto);
    if (datos.faq) renderFAQ(datos.faq);
    if (datos.productos) renderProductos(datos.productos);
  } catch (e) {
    // Si no se puede cargar, el HTML estático se mantiene
  }
}

function renderProductos(productos) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  const disponibles = productos.filter(p => p.nombre);
  if (!disponibles.length) {
    grid.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;grid-column:1/-1">No hay productos disponibles por el momento.</p>';
    return;
  }
  grid.innerHTML = '';
  disponibles.forEach(p => grid.appendChild(crearCardProducto(p)));
  iniciarFiltros();
  animarElementos();
}

function renderFAQ(faq) {
  const list = document.getElementById('faqList');
  if (!list) return;
  list.innerHTML = faq.map(item => `
    <div class="faq-item">
      <button class="faq-question" aria-expanded="false">
        ${item.pregunta}
        <i class="fa-solid fa-chevron-down faq-icon"></i>
      </button>
      <div class="faq-answer">
        <p>${item.respuesta}</p>
      </div>
    </div>
  `).join('');
  initFAQ();
}

function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-question').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.nextElementSibling.classList.remove('open');
      });
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        btn.nextElementSibling.classList.add('open');
      }
    });
  });
}

function renderReparaciones(reparaciones) {
  const grid = document.getElementById('repairsGrid');
  if (!grid) return;
  grid.innerHTML = reparaciones.map(r => `
    <div class="repair-card">
      <div class="repair-icon"><i class="${r.icono}"></i></div>
      <h3>${r.titulo}</h3>
      <p>${r.descripcion}</p>
      <span class="repair-price">${r.precio}</span>
      <a href="#contacto" class="btn btn-outline-white">Pedir turno</a>
    </div>
  `).join('');
}

function renderContacto(contacto) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
  set('infoDireccion', contacto.direccion);
  set('infoWhatsapp', contacto.whatsapp_display);
  set('infoEmail', contacto.email);
  set('infoHorario', contacto.horario);

  if (contacto.whatsapp) {
    const waBase = `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent('Hola! Quiero hacer una consulta.')}`;
    const floatBtn = document.getElementById('whatsappFloat');
    if (floatBtn) floatBtn.href = waBase;
    const socialBtn = document.getElementById('whatsappSocial');
    if (socialBtn) socialBtn.href = waBase;
  }

  if (contacto.direccion) {
    const mapa = document.getElementById('mapaIframe');
    if (mapa) {
      const q = encodeURIComponent(contacto.direccion + ', Buenos Aires, Argentina');
      mapa.src = `https://maps.google.com/maps?q=${q}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
  }
}

// =============================================

// Menú hamburguesa
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// WhatsApp links
const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Quiero hacer una consulta.')}`;
document.getElementById('whatsappFloat').href = waLink;
document.getElementById('whatsappSocial').href = waLink;

// Formulario de contacto → abre WhatsApp
document.getElementById('contactForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();
  const servicio = document.getElementById('servicio').value;
  const mensaje = document.getElementById('mensaje').value.trim();

  if (!servicio) {
    document.getElementById('servicio').focus();
    document.getElementById('servicio').style.borderColor = '#ef4444';
    return;
  }

  const texto = `Hola! Mi nombre es *${nombre}*.\nNecesito: *${servicio}*.\n${mensaje ? 'Mensaje: ' + mensaje + '\n' : ''}Mi teléfono: ${telefono}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`, '_blank');

  this.reset();
  document.getElementById('servicio').style.borderColor = '';
  const btn = this.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Mensaje enviado!';
  btn.disabled = true;
  setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 3000);
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// Animación de entrada
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

function animarElementos() {
  document.querySelectorAll('.product-card, .repair-card, .quick-card, .testimonial, .step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity .4s ease, transform .4s ease';
    observer.observe(el);
  });
}
animarElementos();

// Filtro de productos
function iniciarFiltros() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.product-card').forEach(card => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.brand !== filter);
      });
    });
  });
}
iniciarFiltros();

// =============================================
// CARRUSEL
// =============================================
function crearCarrusel(fotos) {
  if (!fotos.length) return `<div class="carousel-placeholder"><i class="fa-solid fa-mobile-screen-button"></i></div>`;

  const slides = fotos.map((url, i) =>
    `<img src="${url}" alt="foto ${i + 1}" class="carousel-slide${i === 0 ? ' active' : ''}" loading="lazy">`
  ).join('');

  const dots = fotos.length > 1 ? `<div class="carousel-dots">${fotos.map((_, i) =>
    `<span class="carousel-dot${i === 0 ? ' active' : ''}"></span>`
  ).join('')}</div>` : '';

  const arrows = fotos.length > 1 ? `
    <button class="carousel-btn prev" aria-label="Anterior">&#8249;</button>
    <button class="carousel-btn next" aria-label="Siguiente">&#8250;</button>
  ` : '';

  return `<div class="carousel">${arrows}<div class="carousel-track">${slides}</div>${dots}</div>`;
}

function initCarrusel(card) {
  const carousel = card.querySelector('.carousel');
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.carousel-dot');
  if (slides.length <= 1) return;

  let current = 0;

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  carousel.querySelector('.prev').addEventListener('click', () => goTo(current - 1));
  carousel.querySelector('.next').addEventListener('click', () => goTo(current + 1));
}

function crearCardProducto(p) {
  const badgeClass = p.badge === 'Hot' ? 'hot' : p.badge === 'Oferta' ? 'offer' : '';
  const badgeHTML = p.badge ? `<span class="product-badge ${badgeClass}">${p.badge}</span>` : '';
  const mensajeWA = encodeURIComponent(`Hola! Quiero consultar por el ${p.nombre}.`);
  const marcaLabel = (p.marca || '').charAt(0).toUpperCase() + (p.marca || '').slice(1);
  const fotos = (p.fotos && p.fotos.length) ? p.fotos : [];

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.brand = p.marca || '';
  card.innerHTML = `
    ${badgeHTML}
    ${crearCarrusel(fotos)}
    <div class="product-info">
      <span class="brand-tag">${marcaLabel}</span>
      <h3>${p.nombre}</h3>
      <p>${p.descripcion || ''}</p>
      <div class="price-row">
        <strong class="price">${p.precio || ''}</strong>
        <span class="installments">${p.cuotas || ''}</span>
      </div>
      <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${mensajeWA}" target="_blank" class="btn btn-primary full-width">Consultar</a>
    </div>
  `;
  initCarrusel(card);
  return card;
}

cargarDatos();

// =============================================
// LIGHTBOX
// =============================================
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');

let lightboxPhotos = [];
let lightboxIndex = 0;

function actualizarLightbox() {
  lightboxImg.src = lightboxPhotos[lightboxIndex];
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
  lightboxPrev.classList.toggle('hidden', lightboxPhotos.length <= 1);
  lightboxNext.classList.toggle('hidden', lightboxPhotos.length <= 1);
  lightboxCounter.style.display = lightboxPhotos.length <= 1 ? 'none' : '';
}

function abrirLightbox(src, card) {
  const slides = card ? [...card.querySelectorAll('.carousel-slide')] : [];
  lightboxPhotos = slides.length ? slides.map(s => s.src) : [src];
  lightboxIndex = lightboxPhotos.indexOf(src);
  if (lightboxIndex < 0) lightboxIndex = 0;
  lightbox.classList.add('open');
  actualizarLightbox();
}

lightboxPrev.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  actualizarLightbox();
});
lightboxNext.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
  actualizarLightbox();
});

document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('open'));
lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('open'); });
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') lightbox.classList.remove('open');
  if (e.key === 'ArrowLeft') { lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length; actualizarLightbox(); }
  if (e.key === 'ArrowRight') { lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length; actualizarLightbox(); }
});

document.addEventListener('click', e => {
  if (e.target.classList.contains('carousel-slide')) {
    const card = e.target.closest('.product-card');
    abrirLightbox(e.target.src, card);
  }
});

// =============================================
// CONFIGURACIÓN — editá solo estas dos líneas
// =============================================
const WHATSAPP_NUMBER = '5491112345678';
const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTqOXq_4et5S8zU1ytsX1KzbixP6PyJDYp25_I5_OaDYCVOk11DRukT2BjgC7bnVVzSS_5sXydj7Sq8/pub?output=csv';

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
// CARGA DE PRODUCTOS DESDE GOOGLE SHEETS
// =============================================
function parseCSV(text) {
  const lines = text.trim().replace(/\r/g, '').split('\n');
  return lines.slice(1).map(line => {
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    cols.push(current.trim());
    return cols;
  }).filter(cols => cols.some(c => c));
}

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
  const marcaLabel = p.marca.charAt(0).toUpperCase() + p.marca.slice(1);
  const fotos = [p.foto1, p.foto2, p.foto3, p.foto4, p.foto5, p.foto6].filter(Boolean);

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.brand = p.marca;
  card.innerHTML = `
    ${badgeHTML}
    ${crearCarrusel(fotos)}
    <div class="product-info">
      <span class="brand-tag">${marcaLabel}</span>
      <h3>${p.nombre}</h3>
      <p>${p.descripcion}</p>
      <div class="price-row">
        <strong class="price">$${p.precio}</strong>
        <span class="installments">${p.cuotas}</span>
      </div>
      <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${mensajeWA}" target="_blank" class="btn btn-primary full-width">Consultar</a>
    </div>
  `;
  initCarrusel(card);
  return card;
}

async function cargarProductos() {
  const grid = document.getElementById('productsGrid');

  if (!SHEETS_CSV_URL) {
    grid.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;grid-column:1/-1">Los productos se cargarán desde Google Sheets próximamente.</p>';
    return;
  }

  grid.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;grid-column:1/-1">Cargando productos...</p>';

  try {
    const res = await fetch(SHEETS_CSV_URL);
    if (!res.ok) throw new Error(`Error ${res.status} al cargar la planilla`);
    const text = await res.text();
    const rows = parseCSV(text);

    const productos = rows
      .map(cols => ({
        nombre: cols[0] || '',
        marca: (cols[1] || '').toLowerCase(),
        descripcion: cols[2] || '',
        precio: cols[3] || '',
        cuotas: cols[4] || '',
        badge: cols[5] || '',
        disponible: (cols[6] || '').toUpperCase(),
        foto1: cols[7] || '',
        foto2: cols[8] || '',
        foto3: cols[9] || '',
        foto4: cols[10] || '',
        foto5: cols[11] || '',
        foto6: cols[12] || '',
      }))
      .filter(p => p.disponible === 'SI' && p.nombre);

    grid.innerHTML = '';
    productos.forEach(p => {
      grid.appendChild(crearCardProducto(p));
    });

    iniciarFiltros();
    animarElementos();

  } catch {
    grid.innerHTML = '<p style="text-align:center;color:#ef4444;padding:40px;grid-column:1/-1">No se pudieron cargar los productos. Verificá la URL de Google Sheets.</p>';
  }
}

cargarProductos();

// FAQ acordeón
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

// Lightbox
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

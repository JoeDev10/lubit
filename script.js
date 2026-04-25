// =============================================
// CONFIGURACIÓN — editá solo estas dos líneas
// =============================================
const WHATSAPP_NUMBER = '5491112345678';
const SHEETS_CSV_URL = ''; // Pegá aquí la URL de Google Sheets cuando la tengas

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
  const lines = text.trim().split('\n');
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
  });
}

function crearCardProducto(p) {
  const badgeClass = p.badge === 'Hot' ? 'hot' : p.badge === 'Oferta' ? 'offer' : '';
  const badgeHTML = p.badge ? `<span class="product-badge ${badgeClass}">${p.badge}</span>` : '';
  const icono = p.marca === 'apple' ? 'fa-brands fa-apple' : 'fa-solid fa-mobile-screen-button';
  const mensajeWA = encodeURIComponent(`Hola! Quiero consultar por el ${p.nombre}.`);
  const marcaLabel = p.marca.charAt(0).toUpperCase() + p.marca.slice(1);

  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.brand = p.marca;
  card.innerHTML = `
    ${badgeHTML}
    <div class="product-img ${p.marca}">
      <i class="${icono}"></i>
    </div>
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
        disponible: (cols[6] || '').toUpperCase()
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

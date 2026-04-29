// ===== SUPABASE CONFIG =====
const SUPA_URL = 'https://enpwfklapgnxqtqmobux.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucHdma2xhcGdueHF0cW1vYnV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NzE5MTksImV4cCI6MjA5MDE0NzkxOX0.tDw6PggZlJfH-CwLliGmmLLncljDSVivhLAG_HJFD6Y';
const db = window.supabase.createClient(SUPA_URL, SUPA_KEY);

// ===== CATEGORÍAS CONFIG =====
// img: ruta relativa desde index.html → public/assets/
const catConfig = {
  arepa:      { emoji: '🫔', img: 'assets/arepa_huevo.png', label: 'Arepa' },
  carimañola: { emoji: '🥟', img: 'assets/carimañolas.png',  label: 'Carimañola' },
  empanada:   { emoji: '🥙', img: 'assets/empanadas.png',    label: 'Empanada' },
  buñuelo:    { emoji: '🍩', img: 'assets/buñuelos.png',     label: 'Buñuelo' },
  bollito:    { emoji: '🥞', img: 'assets/deditos.png',     label: 'Deditos' },
  patacon:    { emoji: '🍌', img: 'assets/deditos.png',     label: 'Patacón' },
  encurtido:  { emoji: '🥒', img: 'assets/deditos.png',     label: 'Encurtido' },
  dulce:      { emoji: '🍬', img: 'assets/deditos.png',     label: 'Dulce Caribeño' },
};

// NOTA: Si la imagen de deditos sigue sin cargar, abre DevTools (F12) → Network
// y revisa el nombre exacto del archivo. Nombres con tildes o ñ pueden causar
// problemas según el sistema operativo. Renombra el archivo si es necesario.
// Ejemplos de nombres seguros: deditos.png, bunuelo.png, carimanola.png

// ===== ESTADO GLOBAL =====
let currentUser = null;
let authToken = null;
let allProductos = [];
let votosMap = {};
let realtimeChannel = null;
let votedItems = new Set();

// ===== HELPER FETCH CON TOKEN =====
async function apiFetch(ruta, opciones) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const res = await fetch(ruta, { ...opciones, headers });
  return res.json();
}

// ===== AUTH TABS =====
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function checkStrength(val) {
  let s = 0;
  if (val.length > 5) s += 30;
  if (val.match(/[A-Z]/)) s += 30;
  if (val.match(/[0-9]/)) s += 40;
  const el = document.getElementById('strength-fill');
  el.style.width = s + '%';
  el.style.background = s < 40 ? '#8B2020' : s < 70 ? '#f59e0b' : '#4A7C59';
}

// ===== REGISTRO =====
async function doRegistro() {
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const msg = document.getElementById('msg-registro');

  if (!username || !password) { showMsg(msg, 'Por favor completa todos los campos', 'err'); return; }
  showMsg(msg, 'Registrando...', '');

  try {
    const data = await apiFetch('/api/registro', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (data.error) { showMsg(msg, data.error, 'err'); return; }
    showMsg(msg, '✅ ¡Cuenta creada! Ahora inicia sesión', 'ok');
    document.getElementById('reg-user').value = '';
    document.getElementById('reg-pass').value = '';
    document.getElementById('strength-fill').style.width = '0%';
    setTimeout(() => { document.querySelectorAll('.auth-tab')[1].click(); }, 1200);
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'err');
  }
}

// ===== LOGIN =====
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const msg = document.getElementById('msg-login');

  if (!username || !password) { showMsg(msg, 'Por favor completa todos los campos', 'err'); return; }
  showMsg(msg, 'Verificando...', '');

  try {
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (data.error) { showMsg(msg, data.error, 'err'); return; }
    authToken = data.token;
    currentUser = data.username;
    localStorage.setItem('fritomapp_token', authToken);
    localStorage.setItem('fritomapp_user', currentUser);
    enterApp(currentUser);
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'err');
  }
}

function cargarVotosUsuario(username) {
  const key = 'fritomapp_votes_' + username;
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  votedItems.clear();
  saved.forEach(v => votedItems.add(v));
}

function enterApp(username) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('username-display').textContent = username;
  cargarVotosUsuario(username);
  initTop5();
}

function logout() {
  votedItems.clear();
  currentUser = null;
  authToken = null;
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  localStorage.removeItem('fritomapp_token');
  localStorage.removeItem('fritomapp_user');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('msg-login').textContent = '';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

// Persistencia de sesión
window.addEventListener('load', () => {
  const savedToken = localStorage.getItem('fritomapp_token');
  const savedUser = localStorage.getItem('fritomapp_user');
  if (savedToken && savedUser) {
    authToken = savedToken;
    currentUser = savedUser;
    enterApp(savedUser);

    // Detectar QR — si la URL tiene un ancla tipo /#dona-petra
    const ancla = window.location.hash.replace('#', '');
    if (ancla) {
      setTimeout(() => abrirPerfilPorSlug(ancla), 800);
    }
  }
});

// ===== HELPER MENSAJES =====
function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'auth-msg' + (type ? ' ' + type : '');
}

// ===== FILTROS =====
function filterCategory(chipEl, cat) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chipEl.classList.add('active');
  document.querySelectorAll('.cocinera-card').forEach(card => {
    if (cat === 'todos') { card.style.display = ''; return; }
    const cats = card.dataset.category || '';
    card.style.display = cats.includes(cat) ? '' : 'none';
  });
  showToast(cat === 'todos' ? '🍽️ Mostrando todos' : '🔍 Filtrando: ' + cat);
}

function filterBarrio(barrio) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.cocinera-card').forEach(card => {
    card.style.display = (card.dataset.barrio === barrio) ? '' : 'none';
  });
  showToast('📍 ' + barrio);
  document.getElementById('cocineras').scrollIntoView({ behavior: 'smooth' });
}

// ===== TOP 5 — INIT =====
async function initTop5() {
  try {
    const { data: productos, error: errProd } = await db.from('productos').select('*');
    if (!errProd) allProductos = productos || [];

    const { data: votosData, error: errVotos } = await db
      .from('votos')
      .select('frito, votos')
      .order('votos', { ascending: false });

    if (!errVotos && Array.isArray(votosData)) {
      votosData.forEach(v => { votosMap[v.frito] = v.votos; });
    } else {
      votosMap = { arepa: 0, carimañola: 0, empanada: 0, buñuelo: 0, bollito: 0 };
    }

    renderTop5();
    subscribeVotosRealtime();
  } catch (e) {
    console.warn('initTop5 error:', e);
    votosMap = { arepa: 0, carimañola: 0, empanada: 0, buñuelo: 0, bollito: 0 };
    renderTop5();
  }
}

// ===== TOP 5 — RENDER =====
function renderTop5() {
  const container = document.getElementById('top5-container');
  if (!container) return;

  const sorted = Object.entries(votosMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) return;

  const [top1, top2, ...smalls] = sorted;

  container.innerHTML = `
    <div class="top5-main">
      ${renderBigCard(top1, 1)}
      ${top2 ? renderBigCard(top2, 2) : ''}
    </div>
    <div class="top5-small-row">
      ${smalls.map((item, i) => renderSmallCard(item, i + 3)).join('')}
    </div>
  `;
}

function getProductosDeCat(cat) {
  return allProductos.filter(p => p.categoria === cat);
}

// ===== RENDER BIG CARD =====
function renderBigCard([cat, votos], rank) {
  const conf = catConfig[cat] || { emoji: '🍽️', img: '', label: cat };
  const voted = votedItems.has(cat);
  const fallbackBg = conf.img ? '' : 'background:linear-gradient(135deg,#c05e05,#e8820c);';

  return `
    <div class="top5-item${rank === 1 ? ' rank1' : ''}" style="${fallbackBg}">
      ${conf.img ? `<img class="top5-bg-img" src="${conf.img}" alt="${conf.label}">` : ''}
      <div class="top5-img-overlay"></div>
      <div class="top5-top-row">
        <div class="top5-rank">${rank}</div>
        <div class="top5-top-right">
          <div class="top5-likes" id="votes-${cat}">❤️ <span>${Number(votos).toLocaleString()}</span></div>
          <button class="vote-btn${voted ? ' voted' : ''}" id="vbtn-${cat}"
            onclick="votar('${cat}','vbtn-${cat}','votes-${cat}')">❤️ Votar</button>
        </div>
      </div>
      <div class="top5-label">${conf.label}</div>
    </div>
  `;
}

// ===== RENDER SMALL CARD =====
function renderSmallCard([cat, votos], rank) {
  const conf = catConfig[cat] || { emoji: '🍽️', img: '', label: cat };
  const voted = votedItems.has(cat);
  const fallbackBg = conf.img ? '' : 'background:linear-gradient(135deg,#c05e05,#e8820c);';

  return `
    <div class="top5-small" style="${fallbackBg}">
      ${conf.img ? `<img class="top5-bg-img" src="${conf.img}" alt="${conf.label}">` : ''}
      <div class="top5-img-overlay"></div>
      <div class="top5-top-row">
        <div class="top5-rank">${rank}</div>
        <div class="top5-top-right">
          <div class="top5-likes" id="votes-${cat}">❤️ <span>${Number(votos).toLocaleString()}</span></div>
          <button class="vote-btn${voted ? ' voted' : ''}" id="vbtn-${cat}"
            onclick="votar('${cat}','vbtn-${cat}','votes-${cat}')">❤️</button>
        </div>
      </div>
      <div class="top5-label">${conf.label}</div>
    </div>
  `;
}

// ===== REALTIME VOTOS =====
function subscribeVotosRealtime() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db.channel('votos-live')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'votos'
    }, (payload) => {
      const row = payload.new || payload.old;
      if (!row || !row.frito) return;

      const { frito, votos } = row;
      const prevOrder = getRankingOrder();

      votosMap[frito] = votos;
      renderTop5();

      const el = document.getElementById('votes-' + frito);
      if (el) {
        el.classList.add('vote-pulse');
        setTimeout(() => el.classList.remove('vote-pulse'), 700);
      }

      const newOrder = getRankingOrder();
      if (JSON.stringify(prevOrder) !== JSON.stringify(newOrder)) {
        showToast('🔄 ¡El ranking cambió!');
      }
    })
    .subscribe((status) => {
      console.log('Realtime votos:', status);
    });
}

function getRankingOrder() {
  return Object.entries(votosMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);
}

// ===== VOTACIONES =====
async function votar(item, btnId, votesId) {
  if (!currentUser) return;
  if (votedItems.has(item)) { showToast('Ya votaste por este frito ❤️'); return; }

  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('voted');

  try {
    const { data, error } = await db.rpc('sumar_voto', {
      nombre_frito: item,
      nombre_usuario: currentUser
    });

    if (error || (data && data.error)) {
      showToast('✗ ' + (data?.error || error.message));
      if (btn) btn.classList.remove('voted');
      return;
    }

    votedItems.add(item);
    localStorage.setItem('fritomapp_votes_' + currentUser, JSON.stringify([...votedItems]));
    showToast('❤️ Voto registrado para ' + item + '!');
  } catch (e) {
    console.log('Error al votar:', e);
    if (btn) btn.classList.remove('voted');
  }
}

function updateVoteDisplay(item, count) {
  const el = document.getElementById('votes-' + item);
  if (!el) return;
  el.innerHTML = '❤️ <span>' + count.toLocaleString() + '</span>';
}

// ===== ABRIR PERFIL DESDE QR =====
const perfilesPorSlug = {
  'dona-petra':     { name:'Doña Petra',     avatar:'👩🏾', bg:'linear-gradient(135deg,#d4874a,#f5c842)', specialty:'Arepas de huevo · Getsemaní',          bio:'Doña Petra lleva 45 años preparando las mejores arepas de huevo del barrio Getsemaní. Su receta es un secreto familiar transmitido de generación en generación, con una masa perfecta y un huevo siempre en su punto.', cats:'arepa' },
  'dorita-gaviria': { name:'Dorita Gaviria', avatar:'👩🏽', bg:'linear-gradient(135deg,#c05e05,#e8820c)', specialty:'Arepas y empanadas · Centro Histórico', bio:'Cuarenta años haciendo las arepas y empanadas más crujientes del Centro Histórico. Dorita aprendió de su madre y su abuela, manteniendo vivo el saber ancestral cartagenero.', cats:'arepa,empanada' },
  'marina-torres':  { name:'Marina Torres',  avatar:'👩🏿', bg:'linear-gradient(135deg,#b85d08,#d4874a)', specialty:'Patacones y fritos · Bocagrande',       bio:'Marina es la reina de los patacones en Bocagrande. Lleva 20 años perfeccionando su técnica de doble fritura, logrando patacones crujientes por fuera y suaves por dentro.', cats:'empanada,carimañola' },
  'sr-luis':        { name:'Sr. Luis',       avatar:'🧑🏾', bg:'linear-gradient(135deg,#8B4513,#c05e05)', specialty:'Encurtidos · Plaza Trinidad',           bio:'El Sr. Luis es el único maestro encurtidor certificado de la Plaza Trinidad. Sus encurtidos de berenjena, zanahoria y ají son el complemento perfecto para cualquier frito cartagenero.', cats:'encurtido' },
  'dona-rosa':      { name:'Doña Rosa',      avatar:'👩🏽', bg:'linear-gradient(135deg,#d4874a,#e8820c)', specialty:'Fritos y dulces caribeños · Getsemaní',  bio:'Doña Rosa combina como nadie los fritos salados y los dulces caribeños. Sus cocadas, alegrías y caballitos de palo son el broche de oro perfecto después de degustar sus fritos.', cats:'buñuelo,dulce' },
  'dona-carmen':    { name:'Doña Carmen',    avatar:'👩🏿', bg:'linear-gradient(135deg,#a05c28,#f5c842)', specialty:'Carimañolas · Centro Histórico',         bio:'Doña Carmen es la guardiana de la carimañola tradicional. 38 años de experiencia le dan el toque preciso: yuca bien cocida, relleno de carne jugoso y fritura en el punto exacto.', cats:'carimañola' },
};

function abrirPerfilPorSlug(slug) {
  const p = perfilesPorSlug[slug];
  if (!p) return;
  document.getElementById('cocineras')?.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => openPerfil(p.name, p.avatar, p.bg, p.specialty, p.bio, p.cats), 400);
}

// ===== GENERADOR DE QR =====
const qrNames = {
  'dona-petra': 'Doña Petra — Getsemaní',
  'dorita-gaviria': 'Dorita Gaviria — C. Histórico',
  'marina-torres': 'Marina Torres — Bocagrande',
  'sr-luis': 'Sr. Luis — Plaza Trinidad',
  'dona-rosa': 'Doña Rosa — Getsemaní',
  'dona-carmen': 'Doña Carmen — Centro Histórico'
};

function generarQR() {
  const val = document.getElementById('qr-select').value;
  if (!val) { showToast('Selecciona un puesto primero'); return; }

  const canvas = document.getElementById('qr-canvas');
  canvas.innerHTML = '';
  const url = 'https://fritomapp.onrender.com/#' + val;
  new QRCode(canvas, { text: url, width: 160, height: 160, colorDark: '#1A1208', colorLight: '#FDF5E6' });

  document.getElementById('qr-label').textContent = qrNames[val];
  document.getElementById('qr-display').classList.add('show');
  showToast('📱 QR generado para ' + qrNames[val]);
}

// ===== MODAL PERFIL con menú integrado =====
async function openPerfil(name, avatar, bg, specialty, bio, catsStr) {
  document.getElementById('modal-avatar').textContent = avatar;
  document.getElementById('modal-avatar').style.background = bg;
  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-sub').textContent = specialty;
  document.getElementById('modal-body').textContent = bio;

  const grid = document.getElementById('modal-menu-grid');
  grid.innerHTML = '<div class="menu-loading">Cargando menú...</div>';
  document.getElementById('modal-overlay').classList.add('open');

  if (allProductos.length === 0) {
    const { data: productos } = await db.from('productos').select('*');
    allProductos = productos || [];
  }

  const cats = catsStr ? catsStr.split(',').map(c => c.trim()) : [];
  const items = allProductos.filter(p => cats.includes(p.categoria));

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="menu-empty">
        <div style="font-size:2rem;margin-bottom:6px">🚧</div>
        <div>Menú en construcción</div>
        <div style="font-size:0.75rem;opacity:0.6;margin-top:4px">Pronto disponible</div>
      </div>`;
    return;
  }

  const grouped = {};
  items.forEach(p => {
    if (!grouped[p.categoria]) grouped[p.categoria] = [];
    grouped[p.categoria].push(p);
  });

  grid.innerHTML = Object.entries(grouped).map(([cat, prods]) => {
    const conf = catConfig[cat] || { emoji: '🍽️', label: cat };
    const header = `<div class="menu-cat-header">${conf.label}</div>`;
    const cards = prods.map(p => `
      <div class="menu-item">
        <div class="menu-item-nombre">${p.nombre}</div>
        <div class="menu-item-desc">${p.descripcion || ''}</div>
        <div class="menu-item-precio">$ ${Number(p.precio).toLocaleString('es-CO')}</div>
      </div>`
    ).join('');
    return header + cards;
  }).join('');
}

function closePerfil(e) {
  if (!e || e.target === document.getElementById('modal-overlay') || e.target.classList.contains('modal-close')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

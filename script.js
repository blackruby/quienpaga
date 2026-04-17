// ═══════════════════════════════════════════
//  DATOS GLOBALES
// ═══════════════════════════════════════════

const DB_CONFIGS_KEY  = 'LAISLA_DB_CONFIGS';
const DB_DEFAULT_KEY  = 'LAISLA_DB_DEFAULT';

var DB_CONFIGS = [];
var DB_DEFAULT_ID = null;
var currentDb = null;
var dbFormAdminValue = true;
var dbShareTargetId = null;

var CLIENTES  = [];
var PRODUCTOS = [];
var PRECIO_TERRAZA = 0;
var precioTerrazaOriginal = 0;
var precioTerrazaActual = 0;

function loadDbConfigs() {
  try {
    DB_CONFIGS = JSON.parse(localStorage.getItem(DB_CONFIGS_KEY) || '[]') || [];
  } catch (e) {
    DB_CONFIGS = [];
  }
  DB_CONFIGS.forEach(function(db) {
    db.admin = db.admin === true;
  });
  DB_DEFAULT_ID = localStorage.getItem(DB_DEFAULT_KEY);
  currentDb = DB_CONFIGS.find(function(db) {
    return String(db.id) === String(DB_DEFAULT_ID);
  }) || null;
  updateAdminVisibility();
}

function saveDbConfigs() {
  localStorage.setItem(DB_CONFIGS_KEY, JSON.stringify(DB_CONFIGS));
  if (DB_DEFAULT_ID !== null && DB_DEFAULT_ID !== undefined) {
    localStorage.setItem(DB_DEFAULT_KEY, String(DB_DEFAULT_ID));
  } else {
    localStorage.removeItem(DB_DEFAULT_KEY);
  }
}

function getSelectedDb() {
  return currentDb || DB_CONFIGS.find(function(db) {
    return String(db.id) === String(DB_DEFAULT_ID);
  }) || null;
}

function updateAdminVisibility() {
  var isAdmin = currentDb && currentDb.admin === true;
  var btnProds = document.getElementById('btn-productos');
  var btnClis = document.getElementById('btn-clientes');
  var btnBorrarComanda = document.getElementById('btn-borrar-comanda');
  if (btnProds) btnProds.style.display = isAdmin ? '' : 'none';
  if (btnClis) btnClis.style.display = isAdmin ? '' : 'none';
  if (btnBorrarComanda) btnBorrarComanda.style.display = isAdmin ? '' : 'none';
}

function dbFetch(path, options) {
  var db = getSelectedDb();
  if (!db) throw new Error('No hay BD seleccionada. Ve a Gestión de BD.');
  var url = db.url.replace(/\/+$/, '') + path;
  options = options || {};
  options.headers = options.headers || {};
  options.headers.Authorization = 'Bearer ' + db.token;
  return fetch(url, options);
}

function selectDb(id) {
  // Try to load data from the selected DB first
  var db = DB_CONFIGS.find(function(d) { return String(d.id) === String(id); });
  if (!db) return;

  // Temporarily set this DB as current to test connection
  var oldCurrent = currentDb;
  currentDb = db;

  mostrarEstadoCarga('Verificando conexión…', false);

  // Try to load basic data to verify connection
  Promise.all([
    dbFetch('/get/clientes'),
    dbFetch('/get/productos'),
    dbFetch('/get/terraza')
  ])
  .then(function(results) {
    // Connection successful, set as default and load data
    DB_DEFAULT_ID = String(id);
    currentDb = db;
    saveDbConfigs();
    renderDbManager();
    updateAdminVisibility();
    showScreen('screen-home', 'nav-home', true);
    cargarDatos();
  })
  .catch(function(err) {
    // Connection failed, revert and show error
    currentDb = oldCurrent;
    console.error('Error conectando a BD:', err);
    alert('Error de conexión con la BD: ' + err.message + '. No se pudo seleccionar.');
    mostrarEstadoCarga('', false); // Clear loading message
  });
}

function addDbConfig(name, url, token, admin) {
  var trimmedName = name.trim();
  var trimmedUrl = url.trim();
  var trimmedToken = token.trim();
  if (!trimmedName || !trimmedUrl || !trimmedToken) {
    alert('Nombre, URL y token son obligatorios.');
    return null;
  }
  var id = String(Date.now());
  DB_CONFIGS.push({ id: id, name: trimmedName, url: trimmedUrl, token: trimmedToken, admin: admin === true });
  saveDbConfigs();
  return id;
}

function submitDbForm(e) {
  e.preventDefault();
  var name = document.getElementById('db-name-input').value;
  var url = document.getElementById('db-url-input').value;
  var token = document.getElementById('db-token-input').value;
  if (!name.trim() || !url.trim() || !token.trim()) {
    document.getElementById('db-form').reportValidity();
    return false;
  }
  var id = addDbConfig(name, url, token, dbFormAdminValue);
  if (id) {
    renderDbManager();
    cerrarDbFormBtn();
  }
  return false;
}

function deleteDbConfig(id) {
  DB_CONFIGS = DB_CONFIGS.filter(function(db) { return String(db.id) !== String(id); });
  if (String(DB_DEFAULT_ID) === String(id)) {
    DB_DEFAULT_ID = null;
    currentDb = null;
  }
  saveDbConfigs();
  loadDbConfigs();
  renderDbManager();
  if (!getSelectedDb()) showDbManager();
}

var visualViewportResizeHandler = null;

function promptAddDb() {
  openDbFormModal();
}

function openDbFormModal() {
  document.getElementById('db-form').reset();
  dbFormAdminValue = true;
  var overlay = document.getElementById('db-form-overlay');
  var sheet = document.getElementById('db-form-sheet');
  overlay.classList.add('open');
  applyKeyboardAwareModal(overlay, sheet);

  setTimeout(function() {
    var nameInput = document.getElementById('db-name-input');
    if (nameInput) {
      nameInput.focus({ preventScroll: true });
    }
  }, 120);

  pushModalState('db-form');
}

function cerrarDbFormBtn() {
  deactivateKeyboardAwareModal();
  document.getElementById('db-form-overlay').classList.remove('open');
}

function deactivateKeyboardAwareModal() {
  if (window.visualViewport && visualViewportResizeHandler) {
    window.visualViewport.removeEventListener('resize', visualViewportResizeHandler);
    visualViewportResizeHandler = null;
  }
}

function applyKeyboardAwareModal(overlay, sheet) {
  if (!overlay || !sheet) return;
  if (window.visualViewport) {
    deactivateKeyboardAwareModal();
    visualViewportResizeHandler = function() {
      var viewportHeight = window.visualViewport.height;
      var keyboardGap = window.innerHeight - viewportHeight;
      var maxHeight = Math.min(viewportHeight - 80, window.innerHeight * 0.92);
      sheet.style.maxHeight = maxHeight + 'px';
      if (keyboardGap > 60 || viewportHeight < window.innerHeight * 0.9) {
        overlay.classList.add('keyboard-open');
      } else {
        overlay.classList.remove('keyboard-open');
      }
    };
    window.visualViewport.addEventListener('resize', visualViewportResizeHandler);
    visualViewportResizeHandler();
  } else {
    overlay.classList.remove('keyboard-open');
    sheet.style.maxHeight = '92vh';
  }
}

function cerrarDbForm(e) {
  if (e.target === document.getElementById('db-form-overlay')) cerrarDbFormBtn();
}

function promptShareDbQr(id) {
  dbShareTargetId = id;
  var overlay = document.getElementById('db-share-overlay');
  var checkbox = document.getElementById('db-share-admin-checkbox');
  var qrArea = document.getElementById('db-share-qr-area');
  var message = document.getElementById('db-share-message');
  var adminRow = document.getElementById('db-share-admin-row');
  var actionRow = document.getElementById('db-share-action-row');
  var db = DB_CONFIGS.find(function(d) { return String(d.id) === String(id); });
  if (!db) return;

  checkbox.checked = false;
  qrArea.style.display = 'none';
  message.style.display = 'block';
  adminRow.style.display = 'flex';
  actionRow.style.display = 'flex';
  document.getElementById('db-share-json').textContent = '';
  overlay.classList.add('open');
  pushModalState('db-share');
}

function cerrarDbShareFormBtn() {
  document.getElementById('db-share-overlay').classList.remove('open');
}

function cerrarDbShareForm(e) {
  if (e.target === document.getElementById('db-share-overlay')) cerrarDbShareFormBtn();
}

function generateDbQr() {
  if (!dbShareTargetId) return;
  var db = DB_CONFIGS.find(function(d) { return String(d.id) === String(dbShareTargetId); });
  if (!db) return;

  var adminValue = document.getElementById('db-share-admin-checkbox').checked;
  var payload = {
    nombre: db.name,
    url: db.url,
    token: db.token,
    admin: adminValue
  };
  var qrText = JSON.stringify(payload);
  var qrImage = document.getElementById('db-qr-image');
  var qrArea = document.getElementById('db-share-qr-area');
  var message = document.getElementById('db-share-message');
  var adminRow = document.getElementById('db-share-admin-row');
  var actionRow = document.getElementById('db-share-action-row');

  qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=' + encodeURIComponent(qrText);
  document.getElementById('db-share-json').textContent = qrText;
  qrArea.style.display = 'block';
  message.style.display = 'none';
  adminRow.style.display = 'none';
  actionRow.style.display = 'none';
}

function renderDbManager() {
  var list = document.getElementById('db-list');
  if (!list) return;
  list.innerHTML = '';
  if (DB_CONFIGS.length === 0) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:14px;">No hay BD configuradas.</div>';
    return;
  }
  DB_CONFIGS.forEach(function(db) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1.5px solid rgba(255,255,255,.08);border-radius:16px;background:var(--surface2);gap:12px;';
    var nameHtml = db.admin
      ? '<button class="db-name-link" onclick="promptShareDbQr(\'' + db.id + '\')">' + db.name + '</button>'
      : '<div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + db.name + '</div>';
    row.innerHTML =
      '<div style="min-width:0;flex:1;">' +
        '<div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + nameHtml + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-shrink:0;">' +
        '<button class="fab-btn fab-cancel" style="padding:10px 12px;min-width:auto;font-size:12px;" onclick="selectDb(\'' + db.id + '\')">' +
          (String(DB_DEFAULT_ID) === String(db.id) ? 'Activa' : 'Seleccionar') +
        '</button>' +
        '<button class="fab-btn" style="background:rgba(240,112,112,.15);color:#f07070;padding:10px 12px;min-width:auto;font-size:12px;" onclick="deleteDbConfig(\'' + db.id + '\')">' +
          'Eliminar' +
        '</button>' +
      '</div>';
    list.appendChild(row);
  });
}

function showDbManager() {
  showScreen('screen-dbs', 'nav-home', true);
  renderDbManager();
}

// ═══════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════

var importes        = {};
var clienteActivoId = null;
var modalCounts     = {};
var datosListos     = false;
var terrazaActiva   = false;   // estado del toggle de terraza
var _histDiaItems   = null;     // items del día cuando se abre comanda desde lista de horas

// ═══════════════════════════════════════════
//  CARGA INICIAL DESDE UPSTASH (una sola vez)
// ═══════════════════════════════════════════

function redisGet(clave) {
  return dbFetch('/get/' + clave)
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' al leer "' + clave + '"');
    return r.json();
  })
  .then(function(data) {
    if (data.result === null || data.result === undefined)
      throw new Error('La clave "' + clave + '" no existe en Redis');
    if (typeof data.result !== 'string') return data.result;
    return JSON.parse(data.result);
  });
}

function mostrarEstadoCarga(msg, esError) {
  var color = esError ? '#f07070' : 'var(--text-muted)';
  var icono = esError ? 'error_outline' : 'sync';
  var html  =
    '<tr><td colspan="3" style="text-align:center;padding:28px;color:' + color + ';font-size:13px;">' +
    '<span class="material-icons-round" style="vertical-align:middle;font-size:18px;margin-right:6px;opacity:.8">' + icono + '</span>' +
    msg + '</td></tr>';
  document.getElementById('clientes-tbody').innerHTML = html;
}

// Ejecutar al cargar la página
async function cargarDatos() {
  loadDbConfigs();
  updateScreenHeader('screen-home');
  if (!DB_CONFIGS.length || !getSelectedDb()) {
    renderDbManager();
    showDbManager();
    return;
  }

  mostrarEstadoCarga('Cargando datos…', false);

  try {
    var resultados = await Promise.all([
      redisGet('clientes').catch(function() { return []; }),
      redisGet('productos').catch(function() { return []; }),
      dbFetch('/get/terraza')
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(d) { return parseFloat(d.result) || 0; })
        .catch(function() { return 0; })
    ]);

    CLIENTES        = resultados[0];
    PRODUCTOS       = resultados[1];
    PRECIO_TERRAZA  = resultados[2];

    // Initialize clients with "Invitados" if empty
    if (!Array.isArray(CLIENTES) || CLIENTES.length === 0) {
      CLIENTES = [{ id: 0, nombre: 'Invitados' }];
      // Save initialized clients to DB
      await dbFetch('/set/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CLIENTES)
      });
    }

    if (!Array.isArray(PRODUCTOS) || PRODUCTOS.length === 0)
      throw new Error('El array de productos está vacío');

    datosListos = true;

    if (document.getElementById('screen-nueva').classList.contains('active')) {
      nuevaConsumicion();
    }

  } catch(err) {
    console.error('Error cargando datos desde Upstash:', err);
    mostrarEstadoCarga('Error al cargar datos: ' + err.message, true);
  }
}

cargarDatos();

// ═══════════════════════════════════════════
//  NAVEGACIÓN
// ═══════════════════════════════════════════

// ── Pantalla activa actual (para saber adónde retroceder) ──
var _screenActual = 'home';

function showScreen(screenId, navId, sinHistorial) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById(screenId).classList.add('active');
  document.getElementById(navId).classList.add('active');
  _screenActual = screenId;
  updateScreenHeader(screenId);

  if (!sinHistorial && screenId !== 'screen-home') {
    history.pushState({ screen: screenId }, '');
  }
}

function updateScreenHeader(screenId) {
  var titleEl = document.getElementById('title-' + screenId.replace(/^screen-/, ''));
  if (!titleEl) return;
  if (!titleEl.dataset.baseTitle) {
    titleEl.dataset.baseTitle = titleEl.textContent;
  }
  var db = getSelectedDb();
  titleEl.textContent = titleEl.dataset.baseTitle + (db ? ' · ' + db.name : '');
}

function goHome() {
  showScreen('screen-home', 'nav-home', true);
  history.replaceState({ screen: 'home' }, '');
}

// ── Gestión del botón "atrás" del sistema ──
history.replaceState({ screen: 'home' }, '');

// Cada modal que se abre añade su propia entrada al historial
function pushModalState(nombre) {
  history.pushState({ screen: _screenActual, modal: nombre }, '');
}

window.addEventListener('popstate', function(e) {
  var state = e.state || {};

  // Priorizar cerrar hist-modal si está abierto (submodal)
  if (document.getElementById('hist-modal-overlay').classList.contains('open')) {
    cerrarHistModalBtn(); return;
  }

  // Si el estado que quedó atrás tiene modal, cerrarlo
  if (state.modal) {
    if (state.modal === 'hist-list')   { cerrarHistListBtn();  return; }
    if (state.modal === 'pago')        { cancelarPago();       return; }
    if (state.modal === 'productos')   { cerrarModalBtn();     return; }
    if (state.modal === 'desglose')    { cerrarDesgloseBtn();  return; }
    if (state.modal === 'cruces')      { cerrarCrucesModalBtn(); return; }
    if (state.modal === 'qr')          { closeQrScanner();     return; }
  }

  // Sin modal: si hay alguno abierto, cerrarlo (seguridad)
  if (document.getElementById('cruces-overlay').classList.contains('open')) {
    cerrarCrucesModalBtn(); return;
  }
  if (document.getElementById('desglose-overlay').classList.contains('open')) {
    cerrarDesgloseBtn(); return;
  }
  if (document.getElementById('hist-list-overlay').classList.contains('open')) {
    cerrarHistListBtn(); return;
  }
  if (document.getElementById('pago-overlay').classList.contains('open')) {
    cancelarPago(); return;
  }
  if (document.getElementById('modal-overlay').classList.contains('open')) {
    cerrarModalBtn(); return;
  }
  if (document.getElementById('qr-modal')) {
    closeQrScanner(); return;
  }

  // Sin modales: navegar según pantalla
  if (_screenActual === 'screen-home') return; // dejar salir

  showScreen('screen-home', 'nav-home', true);
  history.replaceState({ screen: 'home' }, '');
});

// ═══════════════════════════════════════════
//  PANTALLA: NUEVA CONSUMICIÓN
// ═══════════════════════════════════════════

function toggleTerraza() {
  terrazaActiva = !terrazaActiva;
  var toggle = document.getElementById('terraza-toggle');
  var input = document.getElementById('terraza-precio-input');
  toggle.classList.toggle('checked', terrazaActiva);
  input.disabled = !terrazaActiva;
  if (terrazaActiva) {
    input.focus();
  }
}

function construirTablaClientes() {
  importes = {};
  CLIENTES.forEach(function(c) { importes[c.id] = 0; });

  var tbody = document.getElementById('clientes-tbody');
  tbody.innerHTML = '';

  CLIENTES.forEach(function(cliente) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><div class="client-name">' + cliente.nombre + '</div></td>' +
      '<td>' +
        '<input class="importe-input" type="number"' +
        ' id="importe-' + cliente.id + '"' +
        ' value="0.00" min="0" step="0.1" placeholder="0,00" inputmode="decimal"' +
        ' onchange="onImporteChange(' + cliente.id + ', this.value)"' +
        ' oninput="onImporteChange(' + cliente.id + ', this.value)" />' +
      '</td>' +
      '<td>' +
        '<button class="add-product-btn" onclick="abrirModal(' + cliente.id + ')" title="Añadir producto">' +
          '<span class="material-icons-round">add_shopping_cart</span>' +
        '</button>' +
      '</td>';
    tbody.appendChild(tr);
  });

  actualizarTotal();
}

function nuevaConsumicion() {
  showScreen('screen-nueva', 'nav-nueva');

  if (!datosListos) {
    mostrarEstadoCarga('Cargando datos…', false);
    return;
  }

  dbFetch('/get/terraza')
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(d) {
      precioTerrazaActual = parseFloat(d.result) || 0;
      precioTerrazaOriginal = precioTerrazaActual;
    })
    .catch(function() {
      precioTerrazaActual = 0;
      precioTerrazaOriginal = 0;
    })
    .finally(function() {
      resetearTerrazaUI();
      construirTablaClientes();
    });
}

function resetearTerrazaUI() {
  terrazaActiva = false;
  var toggle = document.getElementById('terraza-toggle');
  var input = document.getElementById('terraza-precio-input');
  toggle.classList.remove('checked');
  input.disabled = true;
  if (precioTerrazaActual > 0) {
    input.value = precioTerrazaActual.toFixed(2);
  } else {
    input.value = '';
  }
}

function onImporteChange(clienteId, valor) {
  importes[clienteId] = parseFloat(valor) || 0;
  actualizarTotal();
}

function actualizarTotal() {
  var total = 0;
  Object.keys(importes).forEach(function(k) { total += importes[k]; });
  document.getElementById('total-value').textContent =
    total.toFixed(2).replace('.', ',') + ' €';
}

// ─── Cancelar / Confirmar ───────────────────

function cancelarConsumicion() {
  goHome();
}

// ─── Tu función (firma ampliada con historial) ───
function ordenPagadores(clientes, historial) {
  var inv = 0, cliRank = {}, imp;
  for (var c of clientes) {
    if (c.id == 0) {
      inv = c.importe;
    } else {
      if (c.importe > 0) {
        cliRank[c.id] = {nombre: c.nombre, importe: c.importe, peso: 0};
      }
    }
  }

  if (inv > 0) inv /= Object.keys(cliRank).length - 1;

  for (var id in cliRank) {
    for (var id2 in cliRank) {
      if (id != id2) {
        imp = cliRank[id2].importe + inv;
        cliRank[id].peso += imp;
        cliRank[id2].peso -= imp;
      }
    }
  }

  for (h of historial) {
    if (Object.hasOwn(cliRank, h.p)) {
      inv = 0;
      for (var c of h.c) if (c[0] == 0) inv = c[1] / (h.c.length - 1);
      for (var c of h.c) if (c[0] != h.p && Object.hasOwn(cliRank, c[0])) {
        imp = c[1] + inv;
        cliRank[h.p].peso += imp;
        cliRank[c[0]].peso -= imp;
      }
    }
  }

  var cli = [];
  for (var id in cliRank) cli.push({id: id, nombre: cliRank[id].nombre, peso: cliRank[id].peso});
  cli.sort((a, b) => a.peso - b.peso);

  return cli;
}

// datos guardados temporalmente mientras el modal de pago está abierto
var _datosPendientes = null;

// Obtiene todas las claves que empiezan por "0" y devuelve un array
// con el valor (objeto) de cada una de ellas
function obtenerHistorial() {
  // KEYS * trae todas las claves de golpe; filtramos las que empiezan por "0"
  return dbFetch('/keys/*')
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function(data) {
    var claves = (data.result || []).filter(function(k) {
      return k.charAt(0) >= '0' && k.charAt(0) <= '9';
    });
    if (claves.length === 0) return [];

    return dbFetch('/mget/' + claves.join('/'))
    .then(function(r) { return r.json(); })
    .then(function(mdata) {
      return (mdata.result || []).map(function(val) {
        if (!val) return null;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch(e) { return null; }
      }).filter(Boolean);
    });
  });
}

async function guardarConsumicion(datos) {
  _datosPendientes = datos;

  // Mostrar total mientras carga el historial
  document.getElementById('pago-total-label').textContent =
    datos.total.toFixed(2).replace('.', ',') + ' €';

  // Rellenar select con placeholder mientras se carga
  var sel = document.getElementById('pago-select');
  sel.innerHTML = '<option disabled>Cargando…</option>';
  document.getElementById('pago-overlay').classList.add('open');
  pushModalState('pago');

  var ahora = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var localIso = ahora.getFullYear() + '-' + pad(ahora.getMonth() + 1) + '-' + pad(ahora.getDate()) + 'T' + pad(ahora.getHours()) + ':' + pad(ahora.getMinutes());
  document.getElementById('pago-datetime-input').value = localIso;
  var historial = [];
  try {
    historial = await obtenerHistorial();
  } catch(err) {
    console.warn('No se pudo obtener el historial:', err.message);
    // No es bloqueante: se abre el modal igualmente con historial vacío
  }

  // Rellenar select con el orden de ordenPagadores
  var ordenados = ordenPagadores(datos.clientes, historial);
  sel.innerHTML = '';
  if (ordenados.length === 0) ordenados = datos.clientes.slice();
  ordenados.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    sel.appendChild(opt);
  });
}

function cancelarPago() {
  document.getElementById('pago-overlay').classList.remove('open');
  _datosPendientes = null;
}

function confirmarPago() {
  if (!_datosPendientes) return;

  var pagadorId = parseInt(document.getElementById('pago-select').value, 10);

  var ahora = obtenerFechaHoraPago();
  function pad(n) { return String(n).padStart(2, '0'); }
  var clave =
    String(ahora.getFullYear()).slice(-2) +
    pad(ahora.getMonth() + 1) +
    pad(ahora.getDate()) +
    pad(ahora.getHours()) +
    pad(ahora.getMinutes()) +
    pad(ahora.getSeconds());

  var consumiciones = _datosPendientes.clientes
    .filter(function(c) { return c.importe > 0; })
    .map(function(c) { return [c.id, c.importe]; });

  var valor = { p: pagadorId, c: consumiciones };

  dbFetch('/set/' + clave, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(valor)
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function() {
    document.getElementById('pago-overlay').classList.remove('open');
    _datosPendientes = null;
    goHome();
  })
  .catch(function(err) {
    console.error('Error guardando en Upstash:', err);
    alert('Error al guardar: ' + err.message);
  });
}

function obtenerFechaHoraPago() {
  var input = document.getElementById('pago-datetime-input');
  if (input.value) {
    var d = new Date(input.value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function confirmarConsumicion() {
  var hayImporte = CLIENTES.some(function(c) {
    return c.id > 0 && (importes[c.id] || 0) > 0;
  });
  if (!hayImporte) {
    alert('Debes introducir al menos un importe para continuar.');
    return;
  }

  if (terrazaActiva) {
    var inputPrecio = document.getElementById('terraza-precio-input');
    precioTerrazaActual = parseFloat(inputPrecio.value) || 0;
  }

  var total = 0;
  Object.keys(importes).forEach(function(k) { total += importes[k]; });
  var datos = {
    fecha: new Date().toISOString(),
    clientes: CLIENTES.map(function(c) {
      return { id: c.id, nombre: c.nombre, importe: importes[c.id] || 0 };
    }),
    total: total
  };

  if (terrazaActiva && precioTerrazaActual !== precioTerrazaOriginal) {
    dbFetch('/set/terraza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(precioTerrazaActual)
    })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function() {
      PRECIO_TERRAZA = precioTerrazaActual;
      precioTerrazaOriginal = precioTerrazaActual;
    })
    .catch(function(err) {
      console.error('Error guardando precio terraza:', err);
    })
    .finally(function() {
      guardarConsumicion(datos);
    });
  } else {
    guardarConsumicion(datos);
  }
}

// ═══════════════════════════════════════════
//  MODAL DE PRODUCTOS
// ═══════════════════════════════════════════

function abrirModal(clienteId) {
  if (terrazaActiva) {
    var inputPrecio = document.getElementById('terraza-precio-input');
    precioTerrazaActual = parseFloat(inputPrecio.value) || 0;
  }
  clienteActivoId = clienteId;
  modalCounts = {};

  var cliente = CLIENTES.find(function(c) { return c.id === clienteId; });
  document.getElementById('modal-client-name').textContent = '👤 ' + cliente.nombre;

  var lista = document.getElementById('productos-list');
  lista.innerHTML = '';

  PRODUCTOS.forEach(function(prod) {
    var icono = prod.icono || '🛒';
    var esEmoji = Array.from(icono).length <= 2;
    var imgHtml = esEmoji
      ? '<div class="producto-img">' + icono + '</div>'
      : '<img class="producto-img" src="' + icono + '" alt="' + prod.descripcion + '" />';

    var div = document.createElement('div');
    div.className = 'producto-item';
    div.id = 'modal-prod-' + prod.id;

    div.innerHTML =
      imgHtml +
      '<div class="producto-info">' +
        '<div class="producto-desc">' + prod.descripcion + '</div>' +
        '<div class="producto-price">' + prod.precio.toFixed(2).replace('.', ',') + ' €/ud.</div>' +
      '</div>' +
      '<div class="prod-stepper" id="stepper-' + prod.id + '">' +
        '<button class="step-btn step-minus" onclick="cambiarCantidad(' + prod.id + ', -1, event)" title="Quitar uno">' +
          '<span class="material-icons-round">remove</span>' +
        '</button>' +
        '<span class="step-qty" id="qty-' + prod.id + '">0</span>' +
        '<button class="step-btn step-plus" onclick="cambiarCantidad(' + prod.id + ', +1, event)" title="Añadir uno">' +
          '<span class="material-icons-round">add</span>' +
        '</button>' +
      '</div>';

    lista.appendChild(div);
  });

  actualizarSubtotalModal();
  document.getElementById('modal-overlay').classList.add('open');
  pushModalState('productos');
}

function cambiarCantidad(prodId, delta, event) {
  event.stopPropagation();
  if (clienteActivoId === null) return;

  var prod = PRODUCTOS.find(function(p) { return p.id === prodId; });
  if (!prod) return;

  var anterior = modalCounts[prodId] || 0;
  var nueva    = Math.max(0, anterior + delta);
  var diff     = nueva - anterior;
  if (diff === 0) return;

  modalCounts[prodId] = nueva;

  // Precio por unidad: producto + terraza si está activa
  var precioPorUd = prod.precio + (terrazaActiva ? precioTerrazaActual : 0);
  importes[clienteActivoId] = Math.round(Math.max(0,
    (importes[clienteActivoId] || 0) + diff * precioPorUd
  ) * 100) / 100;

  var input = document.getElementById('importe-' + clienteActivoId);
  if (input) input.value = importes[clienteActivoId].toFixed(2);

  var qtyEl     = document.getElementById('qty-'        + prodId);
  var stepperEl = document.getElementById('stepper-'    + prodId);
  var itemEl    = document.getElementById('modal-prod-' + prodId);
  if (qtyEl)     qtyEl.textContent = nueva;
  if (stepperEl) stepperEl.classList.toggle('has-qty', nueva > 0);
  if (itemEl)    itemEl.classList.toggle('selected',   nueva > 0);

  actualizarTotal();
  actualizarSubtotalModal();
}

function actualizarSubtotalModal() {
  var val = importes[clienteActivoId] || 0;
  var el  = document.getElementById('modal-subtotal-value');
  if (!el) return;
  el.textContent = val.toFixed(2).replace('.', ',') + ' €';
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function cerrarModalBtn() {
  document.getElementById('modal-overlay').classList.remove('open');
  clienteActivoId = null;
  modalCounts = {};
}

function cerrarModal(e) {
  if (e.target === document.getElementById('modal-overlay')) cerrarModalBtn();
}

// Seleccionar todo el contenido al coger foco en inputs numéricos
document.addEventListener('focusin', function(e) {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
    e.target.select();
  }
});

// Al perder el foco: redondear a 2 decimales
document.addEventListener('focusout', function(e) {
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
    var val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      e.target.value = Math.round(val * 100) / 100;
    }
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') cerrarModalBtn();
});

// ═══════════════════════════════════════════
//  OTRAS PANTALLAS
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  HISTÓRICO — CALENDARIO
// ═══════════════════════════════════════════

// Historial con clave adjunta: [{key, data}]
var _histItems       = [];  // historial con clave, para el calendario
var _historialStats  = [];  // historial con clave, para el desglose de estadísticas

async function verHistorico() {
  showScreen('screen-historico', 'nav-hist');

  var loading = document.getElementById('hist-loading');
  var cal     = document.getElementById('hist-calendar');
  loading.style.display = 'flex';
  cal.style.display     = 'none';
  cal.innerHTML         = '';

  // Traer claves + valores
  try {
    _histItems = await obtenerHistorialConClaves();
  } catch(err) {
    loading.innerHTML = '<span style="color:#f07070">Error: ' + err.message + '</span>';
    return;
  }

  if (_histItems.length === 0) {
    loading.innerHTML = '<span style="opacity:.5">Sin comandas registradas</span>';
    return;
  }

  // Agrupar por YYMMDD
  var porDia = {}; // { 'YYMMDD': [{key, data}, ...] }
  _histItems.forEach(function(item) {
    var dia = item.key.substring(0, 6); // YYMMdd
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(item);
  });

  // Calcular rango de meses: desde el más antiguo hasta hoy
  var claves  = Object.keys(porDia).sort();
  var hoy     = new Date();
  var minYear = 2000 + parseInt(claves[0].substring(0, 2), 10);
  var minMes  = parseInt(claves[0].substring(2, 4), 10) - 1;
  var maxYear = hoy.getFullYear();
  var maxMes  = hoy.getMonth();

  // Generar meses de más reciente a más antiguo
  var meses = [];
  var y = maxYear, m = maxMes;
  while (y > minYear || (y === minYear && m >= minMes)) {
    meses.push({ y: y, m: m });
    m--; if (m < 0) { m = 11; y--; }
  }

  var MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var DOW = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

  meses.forEach(function(ym) {
    var yy2  = String(ym.y).slice(-2);
    var mm2  = String(ym.m + 1).padStart(2, '0');
    var div  = document.createElement('div');
    div.className = 'cal-month';

    var titulo = document.createElement('div');
    titulo.className   = 'cal-month-title';
    titulo.textContent = MESES_ES[ym.m] + ' ' + ym.y;
    div.appendChild(titulo);

    var grid = document.createElement('div');
    grid.className = 'cal-grid';

    // Cabecera días de la semana
    DOW.forEach(function(d) {
      var dh = document.createElement('div');
      dh.className   = 'cal-dow';
      dh.textContent = d;
      grid.appendChild(dh);
    });

    // Primer día del mes (0=dom…6=sab → convertir a lun=0)
    var primerDia = new Date(ym.y, ym.m, 1).getDay();
    primerDia = (primerDia + 6) % 7; // lunes = 0
    var diasEnMes = new Date(ym.y, ym.m + 1, 0).getDate();

    // Celdas vacías iniciales
    for (var e = 0; e < primerDia; e++) {
      var em = document.createElement('div');
      em.className = 'cal-day empty';
      grid.appendChild(em);
    }

    // Días del mes
    for (var d = 1; d <= diasEnMes; d++) {
      var dd2  = String(d).padStart(2, '0');
      var clave = yy2 + mm2 + dd2;
      var items = porDia[clave] || [];
      var esHoy = (ym.y === hoy.getFullYear() && ym.m === hoy.getMonth() && d === hoy.getDate());

      var btn = document.createElement(items.length ? 'button' : 'div');
      btn.className = 'cal-day' + (items.length ? ' has-data' : '') + (esHoy ? ' today' : '');
      btn.textContent = d;

      if (items.length) {
        var dot = document.createElement('span');
        dot.className = 'cal-dot';
        btn.appendChild(dot);
        (function(its) {
          btn.addEventListener('click', function() { abrirHistDia(its); });
        })(items);
      }

      grid.appendChild(btn);
    }

    div.appendChild(grid);
    cal.appendChild(div);
  });

  loading.style.display = 'none';
  cal.style.display     = 'flex';
}

// Como obtenerHistorial pero devuelve [{key, data}]
function obtenerHistorialConClaves() {
  return dbFetch('/keys/*')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var claves = (data.result || []).filter(function(k) {
      return k.charAt(0) >= '0' && k.charAt(0) <= '9';
    });
    if (claves.length === 0) return [];

    return dbFetch('/mget/' + claves.join('/'))
    .then(function(r) { return r.json(); })
    .then(function(mdata) {
      return (mdata.result || []).map(function(val, i) {
        if (!val) return null;
        var obj = (typeof val !== 'string') ? val : null;
        if (!obj) { try { obj = JSON.parse(val); } catch(e) { return null; } }
        return { key: claves[i], data: obj };
      }).filter(Boolean);
    });
  });
}

// ── Abrir día ────────────────────────────────

function abrirHistDia(items) {
  if (items.length === 1) {
    mostrarComanda(items[0]);
    return;
  }
  // Varios: mostrar lista de horas
  var MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var titulo = document.getElementById('hist-list-title');
  var key0   = items[0].key;
  var yy = 2000 + parseInt(key0.substring(0,2),10);
  var mm = parseInt(key0.substring(2,4),10) - 1;
  var dd = parseInt(key0.substring(4,6),10);
  titulo.textContent = dd + ' ' + MESES_ES[mm] + ' ' + yy;

  var body = document.getElementById('hist-list-body');
  body.innerHTML = '';

  items.forEach(function(item) {
    var hh = item.key.substring(6,8);
    var mi = item.key.substring(8,10);
    var total = (item.data.c || []).reduce(function(s, par) {
      return s + (par[0] !== 0 ? par[1] : 0);
    }, 0);
    var btn = document.createElement('button');
    btn.className = 'hist-hora-btn';
    btn.innerHTML =
      '<span class="hora">' + hh + ':' + mi + '</span>' +
      '<span class="total">' + total.toFixed(2).replace('.', ',') + ' €</span>';
    btn.addEventListener('click', function() {
      cerrarHistListBtn();
      _histDiaItems = items;
      mostrarComanda(item);
    });
    body.appendChild(btn);
  });

  document.getElementById('hist-list-overlay').classList.add('open');
  pushModalState('hist-list');
}

// ── Mostrar detalle de una comanda ───────────

// Clave de la comanda que se está mostrando en el modal de detalle
var _comandaActivaKey = null;

function mostrarComanda(item) {
  _comandaActivaKey = item.key;
  var key  = item.key;
  var data = item.data;

  var yy = 2000 + parseInt(key.substring(0,2),10);
  var mm = parseInt(key.substring(2,4),10) - 1;
  var dd = parseInt(key.substring(4,6),10);
  var hh = key.substring(6,8);
  var mi = key.substring(8,10);
  var MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  document.getElementById('hist-modal-title').textContent =
    dd + ' ' + MESES_ES[mm] + ' ' + yy;
  document.getElementById('hist-modal-sub').textContent = 'Comanda a las ' + hh + ':' + mi;

  var body = document.getElementById('hist-modal-body');
  body.innerHTML = '';

  var pagadorId = String(data.p);
  var consumos  = data.c || [];

  var total = consumos.reduce(function(s, par) { return s + par[1]; }, 0);

  // Fila de total
  var totalRow = document.createElement('div');
  totalRow.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0 8px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:2px';
  totalRow.innerHTML =
    '<span style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)">TOTAL</span>' +
    '<span style="font-size:18px;font-weight:900;color:var(--accent-light)">' + total.toFixed(2).replace('.',',') + ' €</span>';
  body.appendChild(totalRow);

  // Fila por cliente
  consumos.forEach(function(par) {
    var cId     = String(par[0]);
    var importe = par[1];
    var cli     = CLIENTES.find(function(c) { return String(c.id) === cId; });
    var nombre  = cli ? cli.nombre : 'Cliente ' + cId;
    var esPagador = (cId === pagadorId);

    var row = document.createElement('div');
    row.className = 'hist-comanda-row' + (esPagador ? ' pagador' : '');
    row.innerHTML =
      '<span class="nombre">' + nombre +
        (esPagador ? '<span class="pagador-badge">pagó</span>' : '') +
      '</span>' +
      '<span class="importe">' + importe.toFixed(2).replace('.',',') + ' €</span>';
    body.appendChild(row);
  });

  document.getElementById('hist-modal-overlay').classList.add('open');
  pushModalState('hist-modal');
}

function cerrarHistModalBtn() {
  document.getElementById('hist-modal-overlay').classList.remove('open');
  _comandaActivaKey = null;
  if (_histDiaItems) {
    var items = _histDiaItems;
    _histDiaItems = null;
    abrirHistDia(items);
  }
}

function borrarComanda() {
  if (!_comandaActivaKey) return;
  if (!confirm('¿Borrar esta comanda? La acción no se puede deshacer.')) return;

  var clave = _comandaActivaKey;

  dbFetch('/del/' + clave, {
    method: 'POST'
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function() {
    // Eliminar del array local y refrescar el calendario
    _histItems = _histItems.filter(function(i) { return i.key !== clave; });
    cerrarHistModalBtn();
    verHistorico(); // recargar vista
  })
  .catch(function(err) {
    console.error('Error borrando comanda:', err);
    alert('Error al borrar: ' + err.message);
  });
}
function cerrarHistModal(e) {
  if (e.target === document.getElementById('hist-modal-overlay')) cerrarHistModalBtn();
}
function cerrarHistListBtn() {
  document.getElementById('hist-list-overlay').classList.remove('open');
}
function cerrarHistList(e) {
  if (e.target === document.getElementById('hist-list-overlay')) cerrarHistListBtn();
}

// ─── Productos ───────────────────────────────

// ─── Productos (editable + reordenable) ─────

var _nextProdId = 1000;
var _dragSrc    = null;  // fila que se está arrastrando

function verProductos() {
  showScreen('screen-productos', 'nav-home');
  var tbody = document.getElementById('productos-admin-tbody');
  tbody.innerHTML = '';
  PRODUCTOS.forEach(function(p) { addProductoRow(p); });
}

function addProductoRow(p) {
  var isNew = !p;
  p = p || { id: ++_nextProdId, icono: '', descripcion: '', precio: 0 };
  var tbody = document.getElementById('productos-admin-tbody');
  var tr = document.createElement('tr');
  tr.draggable = true;
  tr.dataset.id = p.id;
  tr.innerHTML =
    '<td class="prod-drag-handle">' +
      '<span class="material-icons-round">drag_indicator</span>' +
    '</td>' +
    '<td>' +
      '<input class="prod-edit-input icono" type="text" value="' + (p.icono || '') + '" placeholder="🥡" maxlength="2" />' +
    '</td>' +
    '<td>' +
      '<input class="prod-edit-input" type="text" value="' + (p.descripcion || '') + '" placeholder="Descripción" />' +
    '</td>' +
    '<td>' +
      '<input class="prod-edit-input precio" type="number" value="' + (p.precio || 0).toFixed(2) + '" min="0" step="0.1" inputmode="decimal" />' +
    '</td>' +
    '<td>' +
      '<button class="prod-del-btn" onclick="eliminarProductoRow(this)" title="Eliminar">' +
        '<span class="material-icons-round">delete</span>' +
      '</button>' +
    '</td>';

  // ── Drag & Drop (ratón / teclado) ──
  tr.addEventListener('dragstart', function(e) {
    _dragSrc = tr;
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  tr.addEventListener('dragend', function() {
    _dragSrc = null;
    tr.classList.remove('dragging');
    document.querySelectorAll('#productos-admin-tbody tr').forEach(function(r) {
      r.classList.remove('drag-over');
    });
  });
  tr.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (_dragSrc && _dragSrc !== tr) {
      document.querySelectorAll('#productos-admin-tbody tr').forEach(function(r) {
        r.classList.remove('drag-over');
      });
      tr.classList.add('drag-over');
    }
  });
  tr.addEventListener('drop', function(e) {
    e.preventDefault();
    if (_dragSrc && _dragSrc !== tr) {
      var tbody = tr.parentNode;
      var rows  = Array.from(tbody.querySelectorAll('tr'));
      var srcIdx = rows.indexOf(_dragSrc);
      var tgtIdx = rows.indexOf(tr);
      if (srcIdx < tgtIdx) tbody.insertBefore(_dragSrc, tr.nextSibling);
      else                 tbody.insertBefore(_dragSrc, tr);
      tr.classList.remove('drag-over');
    }
  });

  // ── Touch drag (móvil) ──
  var handle = tr.querySelector('.prod-drag-handle');
  var touchY = 0;
  handle.addEventListener('touchstart', function(e) {
    _dragSrc = tr;
    tr.classList.add('dragging');
    touchY = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });

  handle.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var y = e.touches[0].clientY;
    var tbody = tr.parentNode;
    var rows  = Array.from(tbody.querySelectorAll('tr:not(.dragging)'));
    document.querySelectorAll('#productos-admin-tbody tr').forEach(function(r) {
      r.classList.remove('drag-over');
    });
    var target = null;
    rows.forEach(function(r) {
      var rect = r.getBoundingClientRect();
      if (y > rect.top && y < rect.bottom) target = r;
    });
    if (target) target.classList.add('drag-over');
    touchY = y;
  }, { passive: false });

  handle.addEventListener('touchend', function() {
    var tbody = tr.parentNode;
    var over  = tbody.querySelector('tr.drag-over');
    if (over && over !== tr) {
      var rows   = Array.from(tbody.querySelectorAll('tr'));
      var srcIdx = rows.indexOf(tr);
      var tgtIdx = rows.indexOf(over);
      if (srcIdx < tgtIdx) tbody.insertBefore(tr, over.nextSibling);
      else                 tbody.insertBefore(tr, over);
    }
    tr.classList.remove('dragging');
    document.querySelectorAll('#productos-admin-tbody tr').forEach(function(r) {
      r.classList.remove('drag-over');
    });
    _dragSrc = null;
  });

  tbody.appendChild(tr);

  // Dar visibilidad y foco al producto si es nuevo
  if (isNew) {
    setTimeout(function() {
      tr.querySelector('input').focus();
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }
}

function eliminarProductoRow(btn) {
  btn.closest('tr').remove();
}

function guardarProductos() {
  var filas = document.querySelectorAll('#productos-admin-tbody tr');
  var nuevos = [];
  var nextId = 1;

  filas.forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    var icono  = inputs[0].value.trim();
    var desc   = inputs[1].value.trim();
    var precio = parseFloat(inputs[2].value) || 0;
    if (!desc) return; // ignorar filas vacías
    nuevos.push({ id: nextId++, icono: icono, descripcion: desc, precio: precio });
  });

  if (nuevos.length === 0) {
    alert('No hay productos para guardar.');
    return;
  }

  dbFetch('/set/productos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevos)  // igual que terraza y comandas: objeto directo
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function() {
    PRODUCTOS = nuevos;
    goHome();
  })
  .catch(function(err) {
    console.error('Error guardando productos:', err);
    alert('Error al guardar: ' + err.message);
  });
}

// ─── Clientes (editable) ─────────────────────

async function verClientes() {
  showScreen('screen-clientes', 'nav-home');
  var tbody = document.getElementById('clientes-admin-tbody');
  tbody.innerHTML = '';

  // Cargar historial para saber qué clientes no se pueden borrar
  var historial = [];
  try {
    historial = await obtenerHistorial();
  } catch(err) {
    console.warn('No se pudo obtener historial para clientes:', err.message);
  }

  // Set de ids que aparecen en el historial (como pagador o como consumidor)
  var idsEnHistorial = new Set();
  historial.forEach(function(h) {
    idsEnHistorial.add(String(h.p));
    if (Array.isArray(h.c)) {
      h.c.forEach(function(par) { idsEnHistorial.add(String(par[0])); });
    }
  });

  CLIENTES.forEach(function(c) {
    var borrable = c.id !== 0 && !idsEnHistorial.has(String(c.id));
    addClienteRow(c, borrable);
  });
}

function addClienteRow(c, borrable) {
  var maxId = 0;
  CLIENTES.forEach(function(x) { if (x.id > maxId) maxId = x.id; });
  if (!c) {
    document.querySelectorAll('#clientes-admin-tbody tr').forEach(function(tr) {
      var id = parseInt(tr.dataset.id, 10);
      if (id > maxId) maxId = id;
    });
    c = { id: maxId + 1, nombre: '' };
    borrable = true; // recién añadido: siempre borrable
  }

  var tbody = document.getElementById('clientes-admin-tbody');
  var tr = document.createElement('tr');
  tr.dataset.id = c.id;

  var btnBorrar = borrable
    ? '<button class="prod-del-btn" onclick="eliminarClienteRow(this)" title="Eliminar">' +
        '<span class="material-icons-round">delete</span>' +
      '</button>'
    : '';

  tr.innerHTML =
    '<td style="color:var(--text-muted);font-weight:700;font-size:13px;padding:8px 14px">' + c.id + '</td>' +
    '<td style="padding:6px 8px 6px 0">' +
      '<input class="prod-edit-input" type="text" value="' + (c.nombre || '') + '" placeholder="Nombre del cliente" />' +
    '</td>' +
    '<td style="width:36px;padding:6px 8px 6px 0">' + btnBorrar + '</td>';

  // Insertar antes de la última fila (que es siempre el cliente id=0)
  var filas = tbody.querySelectorAll('tr');
  var ultima = filas.length > 0 ? filas[filas.length - 1] : null;
  if (ultima && parseInt(ultima.dataset.id, 10) === 0) {
    tbody.insertBefore(tr, ultima);
  } else {
    tbody.appendChild(tr);
  }

  // Si es nuevo, poner foco en el input
  if (!c.nombre) {
    setTimeout(function() { tr.querySelector('input').focus(); }, 50);
  }
}

function eliminarClienteRow(btn) {
  btn.closest('tr').remove();
}

function guardarClientes() {
  var filas = document.querySelectorAll('#clientes-admin-tbody tr');
  var nuevos = [];

  filas.forEach(function(tr) {
    var id     = parseInt(tr.dataset.id, 10);
    var nombre = tr.querySelector('input').value.trim();
    if (!nombre) return; // ignorar filas vacías
    nuevos.push({ id: id, nombre: nombre });
  });

  if (nuevos.length === 0) {
    alert('No hay clientes para guardar.');
    return;
  }

  dbFetch('/set/clientes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nuevos)
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function() {
    CLIENTES = nuevos;
    goHome();
  })
  .catch(function(err) {
    console.error('Error guardando clientes:', err);
    alert('Error al guardar: ' + err.message);
  });
}

// ─── Terraza ─────────────────────────────────
// Funciones verTerraza() y guardarTerraza() eliminadas
// El precio de terraza ahora se gestiona en Nueva consumición

function rellenaEstadistica(tabla, historial) {
  var balance = {};
  for (var c1 in tabla) {
    balance[c1] = {};
    for (var c2 in tabla) balance[c1][c2] = 0;
  }
  for (var h of historial) {
    var invit = 0, pagado = 0;
    for (var c of h.c) {
      if (c[0] == 0) {
        invit = c[1];
      } else {
        // Consumido
        tabla[c[0]][1] += c[1];
      }
      pagado += c[1];
    }
    tabla[h.p][3] += pagado;
    if (invit > 0) invit /= (h.c.length - 1);
    for (var c of h.c) {
      if (c[0] != 0) tabla[c[0]][2] += invit;
    }
    // Balance
    for (var c of h.c) {
      if (c[0] != 0) balance[h.p][c[0]] += c[1] + invit;
    }
  }
  // Balance cruzado
  var balanceCruz = structuredClone(balance);
  for (var i in balance) {
    for (var j in balance[i]) {
      balanceCruz[i][j] = balance[i][j] - balance[j][i];
    }
  }
  return { tabla: tabla, balance: balanceCruz };
}

async function verEstadisticas() {
  showScreen('screen-estadisticas', 'nav-stats');

  document.getElementById('stats-loading').style.display  = 'flex';
  document.getElementById('stats-content').style.display  = 'none';

  var historial = [];
  try {
    _historialStats = await obtenerHistorialConClaves();
    historial = _historialStats.map(function(item) { return item.data; });
  } catch(err) {
    console.warn('Error obteniendo historial para estadísticas:', err.message);
  }

  // Construir tabla inicial (sin id == 0)
  var tablaInicial = {};
  CLIENTES.forEach(function(c) {
    if (c.id != 0) tablaInicial[c.id] = [c.nombre, 0, 0, 0];
  });

  var resultado   = rellenaEstadistica(tablaInicial, historial);
  var tablaFinal  = resultado.tabla;
  var balanceCruz = resultado.balance;

  // ── Tabla 1: Posición global ──────────────
  var tbody  = document.getElementById('stats-tbody');
  tbody.innerHTML = '';
  var totales = [0, 0, 0, 0];

  CLIENTES.forEach(function(c) {
    if (c.id == 0) return;
    var fila      = tablaFinal[c.id] || [c.nombre, 0, 0, 0];
    var consumido = parseFloat(fila[1]) || 0;
    var invitado  = parseFloat(fila[2]) || 0;
    var consInvt  = consumido + invitado;
    var pagado    = parseFloat(fila[3]) || 0;
    var balance   = pagado - consInvt;
    var balClass  = balance > 0.005 ? 'balance-pos' : balance < -0.005 ? 'balance-neg' : 'balance-zero';
    var balText   = Math.abs(balance) < 0.005 ? '0,00 €' : Math.abs(balance).toFixed(2).replace('.', ',') + ' €';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>'             + fila[0]                                     + '</td>' +
      '<td class="' + balClass + '">' + balText                        + '</td>' +
      '<td class="num">' + pagado.toFixed(2).replace('.', ',')         + ' €</td>' +
      '<td class="num">' + consInvt.toFixed(2).replace('.', ',')       + ' €</td>' +
      '<td class="num">' + consumido.toFixed(2).replace('.', ',')      + ' €</td>' +
      '<td class="num">' + invitado.toFixed(2).replace('.', ',')       + ' €</td>';
    (function(clienteId, nombre) {
      tr.addEventListener('click', function() { abrirDesglose(clienteId, nombre); });
    })(c.id, c.nombre);
    tbody.appendChild(tr);
    totales[0] += consumido;
    totales[1] += invitado;
    totales[2] += consInvt;
    totales[3] += pagado;
  });

  var totalBalance = totales[3] - totales[2];
  var tBalClass = totalBalance > 0.005 ? 'balance-pos' : totalBalance < -0.005 ? 'balance-neg' : 'balance-zero';
  var tBalText  = Math.abs(totalBalance) < 0.005 ? '0,00 €' : Math.abs(totalBalance).toFixed(2).replace('.', ',') + ' €';
  document.getElementById('stats-tfoot').innerHTML =
    '<tr><td>TOTAL</td>' +
    '<td class="' + tBalClass + '">' + tBalText + '</td>' +
    '<td>' + totales[3].toFixed(2).replace('.', ',') + ' €</td>' +
    '<td>' + totales[2].toFixed(2).replace('.', ',') + ' €</td>' +
    '<td>' + totales[0].toFixed(2).replace('.', ',') + ' €</td>' +
    '<td>' + totales[1].toFixed(2).replace('.', ',') + ' €</td>' +
    '</tr>';

  // ── Tabla 2: Balance cruzado ──────────────
  // Solo clientes con id != 0, en el mismo orden que CLIENTES
  var clis = CLIENTES.filter(function(c) { return c.id != 0; });

  // Cabecera: primera celda vacía + nombre oblicuo por cada cliente-columna
  var thead = document.getElementById('cross-thead');
  var trH = document.createElement('tr');
  var thEmpty = document.createElement('th');
  thEmpty.innerHTML = '<span class="th-inner">&nbsp;</span>';
  trH.appendChild(thEmpty);
  clis.forEach(function(c) {
    var th = document.createElement('th');
    th.innerHTML = '<span class="th-inner">' + c.nombre + '</span>';
    trH.appendChild(th);
  });
  thead.innerHTML = '';
  thead.appendChild(trH);

  // Filas
  var crossTbody = document.getElementById('cross-tbody');
  crossTbody.innerHTML = '';
  clis.forEach(function(fila) {
    var tr = document.createElement('tr');
    var tdNombre = document.createElement('td');
    tdNombre.textContent = fila.nombre;
    tr.appendChild(tdNombre);

    clis.forEach(function(col) {
      var td = document.createElement('td');
      if (fila.id === col.id) {
        td.className = 'cx-self';
        td.textContent = '—';
      } else {
        var val = (balanceCruz[fila.id] && balanceCruz[fila.id][col.id]) || 0;
        td.className = val > 0.005 ? 'cx-pos' : val < -0.005 ? 'cx-neg' : '';
        td.textContent = Math.abs(val) < 0.005 ? '0,00' : Math.abs(val).toFixed(2).replace('.', ',');
        // Agregar event listener para abrir modal de cruces
        td.style.cursor = 'pointer';
        td.addEventListener('click', (function(clienteFila, clienteCol) {
          return function() {
            abrirCrucesModal(clienteFila, clienteCol);
          };
        })(fila, col));
      }
      tr.appendChild(td);
    });
    crossTbody.appendChild(tr);
  });

  document.getElementById('stats-loading').style.display = 'none';
  document.getElementById('stats-content').style.display = 'flex';
}

// ═══════════════════════════════════════════
//  DESGLOSE POR CLIENTE
// ═══════════════════════════════════════════

function abrirDesglose(clienteId, nombre) {
  var historial = _historialStats;
  document.getElementById('desglose-title').textContent = nombre;

  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var tbody = document.getElementById('desglose-tbody');
  tbody.innerHTML = '';

  var totPagado = 0, totConsumido = 0, totInvitado = 0;

  // Filtrar comandas donde participó este cliente y ordenar cronológicamente
  var entradas = historial.filter(function(item) {
    var h = item.data || item;
    return h.c && h.c.some(function(par) { return par[0] == clienteId; });
  });
  entradas.sort(function(a, b) { return a.key > b.key ? -1 : 1; });

  entradas.forEach(function(item) {
    var key = item.key;
    var h   = item.data || item;

    var yy = 2000 + parseInt(key.substring(0,2),10);
    var mm = parseInt(key.substring(2,4),10) - 1;
    var dd = parseInt(key.substring(4,6),10);
    var hh = key.substring(6,8);
    var mi = key.substring(8,10);
    var fecha = dd + ' ' + MESES[mm] + ' ' + String(yy).slice(-2) + ' ' + hh + ':' + mi;

    var consumido = 0, invit = 0, pagado = 0;
    for (var c of h.c) {
      if (c[0] == clienteId) consumido = c[1];
      if (c[0] == 0) invit = c[1];
    }
    if (invit > 0) invit /= (h.c.length - 1);
    if (h.p == clienteId) {
      for (var c of h.c) { if (c[0] != 0) pagado += c[1]; }
      pagado += invit;
    }

    var consInvt = consumido + invit;
    totPagado    += pagado;
    totConsumido += consumido;
    totInvitado  += invit;

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="text-align:left;font-size:12px">'  + fecha + '</td>' +
      '<td class="num">' + (pagado > 0 ? pagado.toFixed(2).replace('.',',') + ' €' : '—') + '</td>' +
      '<td class="num">' + consInvt.toFixed(2).replace('.',',')  + ' €</td>' +
      '<td class="num">' + consumido.toFixed(2).replace('.',',') + ' €</td>' +
      '<td class="num">' + invit.toFixed(2).replace('.',',')     + ' €</td>';
    tbody.appendChild(tr);
    tr.addEventListener('click', function() { mostrarComanda(item); });
  });

  // Totales
  var totConsInvt = totConsumido + totInvitado;
  document.getElementById('desglose-tfoot').innerHTML =
    '<tr>' +
    '<td>TOTAL</td>' +
    '<td>' + totPagado.toFixed(2).replace('.',',')    + ' €</td>' +
    '<td>' + totConsInvt.toFixed(2).replace('.',',')  + ' €</td>' +
    '<td>' + totConsumido.toFixed(2).replace('.',',') + ' €</td>' +
    '<td>' + totInvitado.toFixed(2).replace('.',',')  + ' €</td>' +
    '</tr>';

  // Balance
  var balance = totPagado - totConsInvt;
  var balEl   = document.getElementById('desglose-balance');
  balEl.textContent = Math.abs(balance).toFixed(2).replace('.',',') + ' €';
  balEl.style.color = balance > 0.005 ? '#f07070' : balance < -0.005 ? '#50c8a0' : 'var(--text-muted)';

  document.getElementById('desglose-overlay').classList.add('open');
  pushModalState('desglose');
}

function cerrarDesgloseBtn() {
  document.getElementById('desglose-overlay').classList.remove('open');
}
function cerrarDesglose(e) {
  if (e.target === document.getElementById('desglose-overlay')) cerrarDesgloseBtn();
}

// ═══════════════════════════════════════════
//  CRUCES DE PAGOS
// ═══════════════════════════════════════════

function abrirCrucesModal(cliente1, cliente2) {
  var historial = _historialStats;

  // Títulos del modal
  document.getElementById('cruces-title').textContent = cliente1.nombre + ' ↔ ' + cliente2.nombre;
  document.getElementById('cruces-col1-header').textContent = cliente1.nombre;
  document.getElementById('cruces-col2-header').textContent = cliente2.nombre;

  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var tbody = document.getElementById('cruces-tbody');
  var tfoot = document.getElementById('cruces-tfoot');
  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  var saldoTotal = 0;
  var totalCliente1 = 0;
  var totalCliente2 = 0;
  var filas = [];

  historial.forEach(function(item) {
    var h = item.data || item;
    var key = item.key;
    var participan1 = h.c.some(function(par) { return par[0] == cliente1.id; });
    var participan2 = h.c.some(function(par) { return par[0] == cliente2.id; });
    if (!participan1 || !participan2) return;

    var consumo1 = 0, consumo2 = 0;
    var invitados = h.c.find(function(par) { return par[0] == 0; }) || [0, 0];
    var invit = invitados[1] || 0;

    for (var c of h.c) {
      if (c[0] == cliente1.id) consumo1 = c[1];
      if (c[0] == cliente2.id) consumo2 = c[1];
    }

    var numClientes = h.c.length - 1;
    if (invit > 0 && numClientes > 0) {
      var invitPorCliente = invit / numClientes;
      consumo1 += invitPorCliente;
      consumo2 += invitPorCliente;
    }

    if (h.p != cliente1.id && h.p != cliente2.id) return;

    filas.push({ key: key, data: h, consumo1: consumo1, consumo2: consumo2 });
  });

  filas.sort(function(a, b) {
    return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
  });

  filas.forEach(function(item) {
    var h = item.data;
    var key = item.key;
    var consumo1 = item.consumo1;
    var consumo2 = item.consumo2;

    var yy = 2000 + parseInt(key.substring(0,2),10);
    var mm = parseInt(key.substring(2,4),10) - 1;
    var dd = parseInt(key.substring(4,6),10);
    var hh = key.substring(6,8);
    var mi = key.substring(8,10);
    var fecha = dd + ' ' + MESES[mm] + ' ' + String(yy).slice(-2) + ' ' + hh + ':' + mi;

    var tr = document.createElement('tr');
    var tdFecha = document.createElement('td');
    tdFecha.style.textAlign = 'left';
    tdFecha.style.fontSize = '12px';
    tdFecha.textContent = fecha;
    tr.appendChild(tdFecha);

    var tdCliente1 = document.createElement('td');
    var tdCliente2 = document.createElement('td');
    tdCliente1.className = 'num';
    tdCliente2.className = 'num';

    if (h.p == cliente1.id) {
      tdCliente1.textContent = '✓ Pagó';
      tdCliente1.className = 'num cruces-paid';
      tdCliente2.textContent = consumo2.toFixed(2).replace('.', ',') + ' €';
      saldoTotal += consumo2;
      totalCliente2 += consumo2;
    } else {
      tdCliente1.textContent = consumo1.toFixed(2).replace('.', ',') + ' €';
      tdCliente2.textContent = '✓ Pagó';
      tdCliente2.className = 'num cruces-paid';
      saldoTotal -= consumo1;
      totalCliente1 += consumo1;
    }

    tr.appendChild(tdCliente1);
    tr.appendChild(tdCliente2);
    tr.addEventListener('click', function() { mostrarComanda(item); });
    tbody.appendChild(tr);
  });

  var trTotal = document.createElement('tr');
  var tdLabel = document.createElement('td');
  tdLabel.style.textAlign = 'left';
  tdLabel.style.fontWeight = '700';
  tdLabel.textContent = 'TOTAL';
  trTotal.appendChild(tdLabel);

  var tdTot1 = document.createElement('td');
  var tdTot2 = document.createElement('td');
  tdTot1.className = 'num';
  tdTot2.className = 'num';
  tdTot1.textContent = totalCliente1.toFixed(2).replace('.', ',') + ' €';
  tdTot2.textContent = totalCliente2.toFixed(2).replace('.', ',') + ' €';
  tdTot1.style.fontWeight = '700';
  tdTot2.style.fontWeight = '700';

  trTotal.appendChild(tdTot1);
  trTotal.appendChild(tdTot2);
  tfoot.appendChild(trTotal);

  var saldoElem = document.getElementById('cruces-saldo-valor');
  var cliente1Span = document.getElementById('cruces-saldo-cliente1');
  var absValue = Math.abs(saldoTotal).toFixed(2).replace('.', ',');
  saldoElem.textContent = absValue + ' €';
  saldoElem.className = 'cruces-saldo-value';

  if (saldoTotal > 0.005) {
    cliente1Span.textContent = cliente2.nombre + ' debe:';
  } else if (saldoTotal < -0.005) {
    cliente1Span.textContent = cliente1.nombre + ' debe:';
  } else {
    cliente1Span.textContent = 'Saldo neto:';
  }

  document.getElementById('cruces-overlay').classList.add('open');
  pushModalState('cruces');
}

function cerrarCrucesModalBtn() {
  document.getElementById('cruces-overlay').classList.remove('open');
}

function cerrarCrucesModal(e) {
  if (e.target === document.getElementById('cruces-overlay')) cerrarCrucesModalBtn();
}

// ═══════════════════════════════════════════
//  ESCANEO QR PARA BD
// ═══════════════════════════════════════════

var qrVideo = null;
var qrCanvas = null;
var qrCanvasContext = null;
var qrStream = null;
var qrScanning = false;

function scanQrCode() {
  // Check if jsQR library is loaded
  if (typeof jsQR === 'undefined') {
    // Show loading message
    var loadingBtn = document.querySelector('button[onclick="scanQrCode()"]');
    if (loadingBtn) {
      loadingBtn.disabled = true;
      loadingBtn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Cargando...';
    }

    setTimeout(function() {
      if (typeof jsQR === 'undefined') {
        alert('La librería de escaneo QR no se pudo cargar. Verifica tu conexión a internet e inténtalo de nuevo.');
        if (loadingBtn) {
          loadingBtn.disabled = false;
          loadingBtn.innerHTML = '<span class="material-icons-round">qr_code_scanner</span> Escanear QR';
        }
        return;
      }
      // Restore button and continue
      if (loadingBtn) {
        loadingBtn.disabled = false;
        loadingBtn.innerHTML = '<span class="material-icons-round">qr_code_scanner</span> Escanear QR';
      }
      scanQrCode();
    }, 2000);
    return;
  }

  // Create QR scanner modal
  var modal = document.createElement('div');
  modal.id = 'qr-modal';
  modal.className = 'modal-overlay';
  modal.onclick = function(e) {
    if (e.target === modal) closeQrScanner();
  };
  modal.innerHTML = `
    <div class="modal-sheet" style="max-height:80vh;">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Escanear código QR</span>
        <button class="modal-close" onclick="closeQrScanner()" title="Cerrar">
          <span class="material-icons-round">close</span>
        </button>
      </div>
      <div style="padding:20px;text-align:center;">
        <video id="qr-video" style="width:100%;max-width:300px;border-radius:12px;" autoplay playsinline></video>
        <canvas id="qr-canvas" style="display:none;"></canvas>
        <p style="margin-top:16px;color:var(--text-muted);font-size:14px;">
          Apunta la cámara al código QR que contiene la configuración de la BD
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  qrVideo = document.getElementById('qr-video');
  qrCanvas = document.getElementById('qr-canvas');
  qrCanvasContext = qrCanvas.getContext('2d');

  // Start camera
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  })
  .then(function(stream) {
    qrStream = stream;
    qrVideo.srcObject = stream;
    qrVideo.play();
    qrScanning = true;
    scanFrame();
  })
  .catch(function(err) {
    console.error('Error accessing camera:', err);
    alert('Error al acceder a la cámara: ' + err.message);
    closeQrScanner();
  });

  modal.classList.add('open');
  pushModalState('qr');

  // Handle escape key
  function handleQrEscape(e) {
    if (e.key === 'Escape') {
      closeQrScanner();
    }
  }
  document.addEventListener('keydown', handleQrEscape);

  // Store the handler to remove it later
  modal._escapeHandler = handleQrEscape;
}

function scanFrame() {
  if (!qrScanning) return;

  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    qrCanvas.height = qrVideo.videoHeight;
    qrCanvas.width = qrVideo.videoWidth;
    qrCanvasContext.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);

    var imageData = qrCanvasContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
    var code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      handleQrResult(code.data);
      return;
    }
  }

  requestAnimationFrame(scanFrame);
}

function handleQrResult(qrData) {
  try {
    var data = JSON.parse(qrData);
    if (data.nombre && data.url && data.token) {
      document.getElementById('db-name-input').value = data.nombre;
      document.getElementById('db-url-input').value = data.url;
      document.getElementById('db-token-input').value = data.token;
      dbFormAdminValue = data.admin === true;
      closeQrScanner();
      alert('Configuración cargada del QR. Revisa los datos y pulsa "Guardar BD".');
    } else {
      alert('El código QR no contiene una configuración válida de BD. Debe incluir nombre, url y token.');
    }
  } catch (err) {
    alert('Error al procesar el código QR. Asegúrate de que contiene un JSON válido.');
  }
}

function closeQrScanner() {
  qrScanning = false;

  if (qrStream) {
    qrStream.getTracks().forEach(function(track) {
      track.stop();
    });
    qrStream = null;
  }

  var modal = document.getElementById('qr-modal');
  if (modal) {
    if (modal._escapeHandler) {
      document.removeEventListener('keydown', modal._escapeHandler);
    }
    modal.remove();
  }

  // Restore button state
  var loadingBtn = document.querySelector('button[onclick="scanQrCode()"]');
  if (loadingBtn) {
    loadingBtn.disabled = false;
    loadingBtn.innerHTML = '<span class="material-icons-round">qr_code_scanner</span> Escanear QR';
  }
}
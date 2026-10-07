/* Lista de confirmados para el admin.
   Usa SUPABASE_URL y SUPABASE_KEY de script.js y la clave que se escribe en la página. */
(() => {
  'use strict';

  const SESSION_KEY = 'recibida-tomas:admin';

  const loginForm = document.getElementById('login');
  const claveInput = document.getElementById('clave');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const listArea = document.getElementById('admin-list');
  const statusEl = document.getElementById('admin-status');
  const refreshBtn = document.getElementById('refresh');
  const summary = document.getElementById('admin-summary');
  const els = {
    personas: document.getElementById('total-personas'),
    personasLabel: document.getElementById('total-personas-label'),
    si: document.getElementById('total-si'),
    siLabel: document.getElementById('total-si-label'),
    no: document.getElementById('total-no'),
    noLabel: document.getElementById('total-no-label'),
  };
  const groups = {
    vienen: [document.getElementById('vienen-section'), document.getElementById('vienen-list')],
    no: [document.getElementById('no-section'), document.getElementById('no-list')],
    old: [document.getElementById('old-section'), document.getElementById('old-list')],
  };
  const oldSummary = document.getElementById('old-summary');

  const LOGIN_TEXT = loginBtn.textContent;
  const dateFmt = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let clave = '';
  let client = null;

  /* ---------- Clave en la pestaña (se borra al cerrarla) ---------- */

  function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  function saveSession(value) {
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) { /* sin acceso: solo hay que volver a escribir la clave */ }
  }

  /* ---------- Supabase ---------- */

  function configMissing() {
    return typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('TU-PROYECTO') ||
      typeof SUPABASE_KEY === 'undefined' || SUPABASE_KEY.startsWith('TU-');
  }

  async function fetchRows(key) {
    if (!client) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    const { data, error } = await client.rpc('listar_rsvps', { clave: key });
    if (error) throw error;
    return data || [];
  }

  function errorText(err) {
    if (err && (err.code === 'PGRST202' || err.code === '42883')) {
      return 'Falta crear la función listar_rsvps en Supabase: corré supabase/schema.sql en el SQL Editor.';
    }
    return 'No se pudo cargar la lista. Revisá tu conexión y probá de nuevo.';
  }

  /* ---------- Pantallas ---------- */

  function setStatus(message, isError = false) {
    statusEl.textContent = message || '';
    statusEl.hidden = !message;
    statusEl.classList.toggle('is-error', isError);
  }

  function setLoginError(message) {
    loginError.textContent = message || '';
    loginError.hidden = !message;
    if (message) claveInput.setAttribute('aria-invalid', 'true');
    else claveInput.removeAttribute('aria-invalid');
  }

  function showLogin() {
    listArea.hidden = true;
    refreshBtn.hidden = true;
    loginForm.hidden = false;
    claveInput.focus();
  }

  function showList(rows) {
    loginForm.hidden = true;
    listArea.hidden = false;
    refreshBtn.hidden = false;
    render(rows);
  }

  /* ---------- Lista ---------- */

  function joinNames(names) {
    if (typeof Intl !== 'undefined' && Intl.ListFormat) {
      return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(names);
    }
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names.join('');
  }

  // Mismo nombre escrito distinto ("Lucas", " lucas ", "Lucás") cuenta como la misma persona.
  const normalize = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();

  function guestItem(row) {
    const li = document.createElement('li');
    li.className = 'guest';

    const head = document.createElement('div');
    head.className = 'guest__head';
    const name = document.createElement('span');
    name.className = 'guest__name';
    name.textContent = row.nombre;
    head.append(name);
    if (row.asiste && row.acompanantes > 0) {
      const count = document.createElement('span');
      count.className = 'guest__count';
      count.textContent = `+${row.acompanantes}`;
      count.setAttribute('aria-label', `y ${row.acompanantes} más`);
      head.append(count);
    }
    const time = document.createElement('time');
    time.className = 'guest__time';
    time.dateTime = row.created_at;
    time.textContent = dateFmt.format(new Date(row.created_at));
    head.append(time);
    li.append(head);

    const names = Array.isArray(row.nombres_acompanantes) ? row.nombres_acompanantes : [];
    if (row.asiste && names.length) {
      const p = document.createElement('p');
      p.className = 'guest__companions';
      p.textContent = `Con ${joinNames(names)}`;
      li.append(p);
    }
    return li;
  }

  function fill(key, rows) {
    const [section, list] = groups[key];
    list.replaceChildren(...rows.map(guestItem));
    section.hidden = rows.length === 0;
  }

  function render(rows) {
    // rows viene ordenado de la más nueva a la más vieja
    const seen = new Set();
    const latest = [];
    const replaced = [];
    rows.forEach((row) => {
      const key = normalize(row.nombre);
      if (seen.has(key)) replaced.push(row);
      else { seen.add(key); latest.push(row); }
    });

    const vienen = latest.filter((r) => r.asiste);
    const noVienen = latest.filter((r) => !r.asiste);
    const personas = vienen.reduce((sum, r) => sum + 1 + (Number(r.acompanantes) || 0), 0);

    els.personas.textContent = personas;
    els.personasLabel.textContent = personas === 1 ? 'persona viene' : 'personas vienen';
    els.si.textContent = vienen.length;
    els.siLabel.textContent = vienen.length === 1 ? 'respuesta que sí' : 'respuestas que sí';
    els.no.textContent = noVienen.length;
    els.noLabel.textContent = noVienen.length === 1 ? 'no puede ir' : 'no pueden ir';
    summary.hidden = false;

    fill('vienen', vienen);
    fill('no', noVienen);
    fill('old', replaced);
    oldSummary.textContent = `Respuestas reemplazadas (${replaced.length})`;

    setStatus(rows.length ? '' : 'Todavía no confirmó nadie.');
  }

  /* ---------- Acciones ---------- */

  async function onLogin(event) {
    event.preventDefault();
    setLoginError(null);
    const key = claveInput.value.trim();
    if (!key) {
      setLoginError('Escribí la clave.');
      claveInput.focus();
      return;
    }
    if (configMissing()) {
      setLoginError('Faltan SUPABASE_URL y SUPABASE_KEY al principio de script.js.');
      return;
    }
    if (!window.supabase) {
      setLoginError('No se pudo conectar con Supabase. Revisá tu internet y probá de nuevo.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Entrando…';
    try {
      const rows = await fetchRows(key);
      clave = key;
      saveSession(key);
      claveInput.value = '';
      showList(rows);
    } catch (err) {
      console.error(err);
      if (err && err.code === '28000') {
        setLoginError('La clave no es correcta.');
        claveInput.select();
      } else {
        setLoginError(errorText(err));
      }
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = LOGIN_TEXT;
    }
  }

  async function refresh() {
    refreshBtn.disabled = true;
    setStatus('Actualizando…');
    try {
      render(await fetchRows(clave));
    } catch (err) {
      console.error(err);
      if (err && err.code === '28000') {
        // La clave cambió en Supabase: hay que volver a escribirla.
        clave = '';
        saveSession('');
        showLogin();
        setLoginError('La clave cambió. Escribí la nueva.');
      } else {
        setStatus(errorText(err), true);
      }
    } finally {
      refreshBtn.disabled = false;
    }
  }

  loginForm.addEventListener('submit', onLogin);
  refreshBtn.addEventListener('click', refresh);

  /* ---------- Inicio ---------- */

  const saved = readSession();
  if (saved && !configMissing() && window.supabase) {
    clave = saved;
    loginForm.hidden = true;
    listArea.hidden = false;
    refreshBtn.hidden = false;
    refresh();
  } else {
    showLogin();
  }
})();

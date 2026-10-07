/* ============================================================
   COMPLETÁ ESTAS DOS CONSTANTES
   Supabase → tu proyecto → Project Settings → API Keys.
   - SUPABASE_URL: la "Project URL" (https://xxxx.supabase.co)
   - SUPABASE_KEY: la "publishable key" (sb_publishable_…)
     o, en proyectos viejos, la "anon public" key.
   NUNCA pongas acá la secret key ni la service_role key.
   ============================================================ */
const SUPABASE_URL = 'https://plkmaqocxlsoovehyrum.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uciNGorz2mPdqD6SfbnSoA_BOm-JjGh';

(() => {
  'use strict';

  const STORAGE_KEY = 'recibida-tomas:rsvp';
  const MAX_NOMBRE = 100;
  const MAX_ACOMPANANTES = 10;
  const TIMEOUT_MS = 15000;

  const form = document.getElementById('rsvp-form');
  if (!form) return; // admin.html carga este archivo solo por las dos constantes de arriba
  const nombreInput = document.getElementById('nombre');
  const asisteGroup = document.getElementById('asiste-group');
  const asisteInputs = form.querySelectorAll('input[name="asiste"]');
  const acompField = document.getElementById('acompanantes-field');
  const peopleList = document.getElementById('acompanantes-list');
  const personTemplate = document.getElementById('person-template');
  const addPersonBtn = document.getElementById('add-person');
  const maxNote = document.getElementById('acompanantes-max');
  const honeypot = document.getElementById('sitio_web');
  const formAlert = document.getElementById('form-alert');
  const submitBtn = document.getElementById('submit-btn');
  const submitLabel = submitBtn.querySelector('.btn__label');

  const result = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultText = document.getElementById('result-text');
  const againBtn = document.getElementById('again-btn');

  const SUBMIT_TEXT = submitLabel.textContent;
  const GROUP_FIELDS = ['asiste', 'acompanantes'];
  let sending = false;
  let client = null;
  let personSeq = 0;

  // Cuenta caracteres igual que char_length() de Postgres (los emojis cuentan 1).
  const charCount = (text) => Array.from(text).length;

  /* ---------- Configuración de Supabase ---------- */

  function configProblem() {
    if (!/^https:\/\/.+/.test(SUPABASE_URL) || SUPABASE_URL.includes('TU-PROYECTO') ||
        !SUPABASE_KEY || SUPABASE_KEY.startsWith('TU-')) {
      return 'missing';
    }
    if (SUPABASE_KEY.startsWith('sb_secret_')) return 'secret';
    const parts = SUPABASE_KEY.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.role === 'service_role') return 'secret';
      } catch (_) { /* no es un JWT legible: seguimos */ }
    }
    return null;
  }

  function getClient() {
    if (client) return client;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return client;
  }

  /* ---------- localStorage (con try/catch: puede estar bloqueado) ---------- */

  function readStored() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && typeof data.nombre === 'string' && typeof data.asiste === 'boolean') return data;
    } catch (_) { /* sin acceso o dato roto */ }
    return null;
  }

  function store(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* sin acceso: la confirmación igual quedó guardada */ }
  }

  /* ---------- Acompañantes (lista de nombres) ---------- */

  const personRows = () => Array.from(peopleList.children);
  const personInputs = () => personRows().map((li) => li.querySelector('input'));

  function renumberPeople() {
    personRows().forEach((li, i) => {
      li.querySelector('.person__label').textContent = `Acompañante ${i + 1}`;
      li.querySelector('.person__remove').setAttribute('aria-label', `Quitar acompañante ${i + 1}`);
    });
    const full = personRows().length >= MAX_ACOMPANANTES;
    addPersonBtn.hidden = full;
    maxNote.hidden = !full;
  }

  function addPerson() {
    if (personRows().length >= MAX_ACOMPANANTES) return null;
    const li = personTemplate.content.firstElementChild.cloneNode(true);
    const input = li.querySelector('input');
    const label = li.querySelector('.person__label');
    const id = `acompanante-${++personSeq}`;
    input.id = id;
    label.htmlFor = id;
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      setError('acompanantes', null);
    });
    li.querySelector('.person__remove').addEventListener('click', () => removePerson(li));
    peopleList.append(li);
    renumberPeople();
    return input;
  }

  function removePerson(li) {
    const index = personRows().indexOf(li);
    li.remove();
    renumberPeople();
    setError('acompanantes', null);
    const rest = personRows();
    const next = rest[index] || rest[index - 1];
    (next ? next.querySelector('input') : addPersonBtn).focus();
  }

  function clearPeople() {
    peopleList.replaceChildren();
    renumberPeople();
  }

  /* ---------- Campos ---------- */

  function selectedAsiste() {
    const checked = form.querySelector('input[name="asiste"]:checked');
    return checked ? checked.value === 'si' : null;
  }

  function syncAcompanantes() {
    acompField.hidden = selectedAsiste() !== true;
  }

  function setError(id, message) {
    const errorEl = document.getElementById(`${id}-error`);
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
    if (GROUP_FIELDS.includes(id)) {
      document.getElementById(`${id}-${id === 'asiste' ? 'group' : 'field'}`)
        .classList.toggle('is-invalid', Boolean(message));
    } else {
      const input = document.getElementById(id);
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors() {
    ['nombre', 'asiste', 'acompanantes'].forEach((id) => setError(id, null));
    personInputs().forEach((input) => input.removeAttribute('aria-invalid'));
  }

  function showAlert(message) {
    formAlert.textContent = message || '';
    formAlert.hidden = !message;
  }

  /* ---------- Validación (mismos límites que la tabla) ---------- */

  function validate() {
    const errors = []; // [campo, texto del error, elemento a enfocar]
    const nombre = nombreInput.value.trim();
    const asiste = selectedAsiste();
    let nombresAcompanantes = [];

    clearErrors();

    if (!nombre) {
      errors.push(['nombre', 'Escribí tu nombre así sé quién confirma.', nombreInput]);
    } else if (charCount(nombre) > MAX_NOMBRE) {
      errors.push(['nombre', `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`, nombreInput]);
    }

    if (asiste === null) {
      errors.push(['asiste', 'Elegí si venís o no.', asisteInputs[0]]);
    }

    if (asiste === true) {
      const inputs = personInputs();
      const empty = inputs.filter((input) => !input.value.trim());
      const tooLong = inputs.filter((input) => charCount(input.value.trim()) > MAX_NOMBRE);
      if (empty.length) {
        empty.forEach((input) => input.setAttribute('aria-invalid', 'true'));
        errors.push(['acompanantes', 'Escribí el nombre de cada acompañante o tocá «Quitar».', empty[0]]);
      } else if (tooLong.length) {
        tooLong.forEach((input) => input.setAttribute('aria-invalid', 'true'));
        errors.push(['acompanantes', `Cada nombre puede tener hasta ${MAX_NOMBRE} caracteres.`, tooLong[0]]);
      } else if (inputs.length > MAX_ACOMPANANTES) {
        errors.push(['acompanantes', `Podés sumar hasta ${MAX_ACOMPANANTES} acompañantes.`, inputs[MAX_ACOMPANANTES]]);
      }
      nombresAcompanantes = inputs.map((input) => input.value.trim());
    }

    errors.forEach(([id, message]) => setError(id, message));
    if (errors.length) {
      errors[0][2].focus();
      return null;
    }

    return {
      nombre,
      asiste,
      acompanantes: nombresAcompanantes.length,
      nombres_acompanantes: nombresAcompanantes,
    };
  }

  /* ---------- Envío ---------- */

  function setSending(isSending) {
    sending = isSending;
    submitBtn.disabled = isSending;
    form.setAttribute('aria-busy', String(isSending));
    submitLabel.textContent = isSending ? 'Enviando…' : SUBMIT_TEXT;
  }

  async function insertRsvp(row) {
    const db = getClient();
    if (!db) throw new Error('No cargó supabase-js');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // Solo insert: la policy no permite leer, así que no va .select() después.
      const { error } = await db.from('rsvps').insert(row).abortSignal(controller.signal);
      if (error) throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (sending) return;
    showAlert(null);

    const row = validate();
    if (!row) return;

    // Honeypot completo = bot. Se le muestra éxito pero no se guarda nada.
    if (honeypot.value.trim() !== '') {
      showResult('sent', row);
      return;
    }

    const problem = configProblem();
    if (problem) {
      console.error(problem === 'secret'
        ? 'SUPABASE_KEY es una clave secreta. Usá la publishable/anon key: la secreta nunca va en la página.'
        : 'Faltan SUPABASE_URL y SUPABASE_KEY al principio de script.js.');
      showAlert('Todavía no se pueden recibir confirmaciones: la página no está conectada. Avisale a Tomás.');
      return;
    }

    setSending(true);
    try {
      await insertRsvp(row);
      store({
        nombre: row.nombre,
        asiste: row.asiste,
        nombres_acompanantes: row.nombres_acompanantes,
        fecha: new Date().toISOString(),
      });
      showResult('sent', row);
    } catch (err) {
      console.error('No se pudo guardar la confirmación:', err);
      showAlert(navigator.onLine === false
        ? 'Parece que no tenés conexión. Revisá tu internet y tocá «Enviar confirmación» de nuevo.'
        : 'No se pudo enviar tu confirmación. Esperá unos segundos y tocá «Enviar confirmación» de nuevo.');
      submitBtn.focus();
    } finally {
      setSending(false);
    }
  }

  /* ---------- Resultado ---------- */

  function joinNames(names) {
    if (typeof Intl !== 'undefined' && Intl.ListFormat) {
      return new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(names);
    }
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names.join('');
  }

  function showResult(kind, data) {
    const nombre = data.nombre;
    const names = Array.isArray(data.nombres_acompanantes)
      ? data.nombres_acompanantes.filter((n) => typeof n === 'string' && n) : [];
    const conQuien = names.length ? ` con ${joinNames(names)}` : '';

    if (kind === 'sent') {
      if (data.asiste) {
        resultTitle.textContent = `¡Anotado, ${nombre}!`;
        resultText.textContent = `Te espero el viernes 23 a las 21:30${conQuien}.`;
      } else {
        resultTitle.textContent = `Gracias por avisar, ${nombre}`;
        resultText.textContent = 'Una pena que no puedas venir. ¡Brindamos por vos igual!';
      }
    } else {
      resultTitle.textContent = 'Ya confirmaste';
      resultText.textContent = data.asiste
        ? `Desde este dispositivo respondiste a nombre de ${nombre} que venís${conQuien}.`
        : `Desde este dispositivo respondiste a nombre de ${nombre} que no podés venir.`;
    }

    // Reinicia la animación del tilde
    result.querySelectorAll('.result__check path').forEach((p) => {
      p.style.animation = 'none';
      void p.getBoundingClientRect();
      p.style.animation = '';
    });

    form.hidden = true;
    result.hidden = false;
    if (kind === 'sent') resultTitle.focus();
  }

  function showForm() {
    const keepName = nombreInput.value;
    form.reset();
    nombreInput.value = keepName;
    clearPeople();
    clearErrors();
    showAlert(null);
    syncAcompanantes();
    result.hidden = true;
    form.hidden = false;
    nombreInput.focus();
  }

  /* ---------- Eventos ---------- */

  asisteInputs.forEach((input) => input.addEventListener('change', () => {
    setError('asiste', null);
    syncAcompanantes();
  }));

  addPersonBtn.addEventListener('click', () => {
    const input = addPerson();
    if (input) input.focus();
  });

  nombreInput.addEventListener('input', () => setError('nombre', null));

  form.addEventListener('submit', onSubmit);
  againBtn.addEventListener('click', showForm);

  /* ---------- Inicio ---------- */

  syncAcompanantes();
  renumberPeople();

  const stored = readStored();
  if (stored) {
    nombreInput.value = stored.nombre;
    showResult('stored', stored);
  }
})();

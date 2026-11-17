// Sites-opslag. Geen fallback naar browseropslag bij een serverfout.
(() => {
  'use strict';
  const base = '/api/leerplatform';
  const keys = ['leerplatform-techniek-content-v1', 'leerplatform-techniek-voortgang-v1', 'leerplatform-persoonlijk-concept-v1'];
  const cache = new Map(), queues = new Map();
  let ready = false;
  async function call(path, options = {}) {
    const response = await fetch(base + path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Leerplatform': '1', ...options.headers }, signal: options.signal || AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw Error(data.fout || 'De server is niet beschikbaar.');
    return data;
  }
  const meld = () => window.dispatchEvent(new CustomEvent('leerplatform-opslagfout'));
  function write(key, value, remove = false) {
    if (!ready || !cache.has(key)) return Promise.reject(Error('De online opslag is nog niet geladen.'));
    const vorige = queues.get(key) || Promise.resolve();
    const next = vorige.catch(() => {}).then(async () => {
      const record = cache.get(key);
      if (record.conflict) throw Error('Laad opnieuw om conflicterende wijzigingen te bekijken.');
      if (remove && record.revision === 0) return true;
      try {
        const result = await call('/opslag/' + encodeURIComponent(key), { method: remove ? 'DELETE' : 'PUT', body: JSON.stringify(remove ? { revision: record.revision } : { value, revision: record.revision }) });
        cache.set(key, { value: remove ? null : value, revision: result.revision });
        return true;
      } catch (e) { record.conflict = true; meld(); throw e; }
    });
    queues.set(key, next); return next;
  }
  window.storage = {
    async get(key) { if (!ready || !cache.has(key)) throw Error('Opslag niet geladen.'); const r = cache.get(key); return r.value === null || r.value === 'null' ? null : { value: r.value }; },
    set: (key, value) => write(key, value),
  };
  window.concept = { get: key => cache.get(key)?.value || null, set: (key, value) => write(key, value), remove: key => write(key, null, true) };
  window.startLeerplatform = async render => {
    try {
      const [status, ...documents] = await Promise.all([call('/status'), ...keys.map(key => call('/opslag/' + encodeURIComponent(key)))]);
      keys.forEach((key, i) => cache.set(key, documents[i]));
      window.PILOT_USER = status.user; window.LEERPLATFORM_AI = true; ready = true; render();
    } catch (e) {
      const root = document.getElementById('root'); root.replaceChildren();
      const text = document.createElement('p'); text.textContent = 'Je leerprogramma kon niet worden geladen. ' + e.message;
      const button = document.createElement('button'); button.textContent = 'Opnieuw proberen'; button.onclick = () => location.reload();
      root.append(text, button);
    }
  };
})();

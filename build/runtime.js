/* Browseropslag voor het zelfstandige leerplatform. Geen demo-antwoorden. */
(() => {
  'use strict';
  const meldFout = () => window.dispatchEvent(new CustomEvent('leerplatform-opslagfout'));
  window.storage = {
    async get(key) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? null : { value };
      } catch (error) { meldFout(); throw error; }
    },
    async set(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (error) { meldFout(); throw error; }
    },
  };
})();

// Modulo auxiliar para panel de Referencias y conexion modular de la UI del visor

export function initPanelsSlot(api) {
  const slotEl = document.getElementById('panels-slot');
  if (slotEl) {
    slotEl.dataset.ready = 'true';
  }

  const refToggle = document.getElementById('references-toggle');
  const refList = document.getElementById('references-list');

  if (refToggle && refList) {
    refToggle.addEventListener('click', () => {
      const expanded = refToggle.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      refToggle.setAttribute('aria-expanded', String(next));
      refList.hidden = !next;
    });
  }

  return {
    container: slotEl,
    api
  };
}

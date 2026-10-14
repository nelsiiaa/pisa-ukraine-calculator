/* Прості лінійні іконки (SVG, колір береться з тексту). */
(function (root) {
  'use strict';
  const svg = body => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  root.PisaIcons = {
    read: svg('<path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z"/><path d="M12 6v13.5"/>'),
    math: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7"/><path d="M8.5 11.5h1M14.5 11.5h1M8.5 15h1M14.5 15h1M8.5 18h1M14.5 18h1"/>'),
    scie: svg('<path d="M9.5 3h5M10.5 3v6.2L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3l-5.3-8.8V3"/><path d="M7.4 15h9.2"/>'),
    equity: svg('<path d="M12 3v17M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/><path d="M19 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/>'),
    school: svg('<path d="M3 10l9-6 9 6"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/><path d="M12 9.5h.01"/>'),
    people: svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.6A4.6 4.6 0 0 1 21 19"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.8h.01"/>'),
  };
})(typeof self !== 'undefined' ? self : this);

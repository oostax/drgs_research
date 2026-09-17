/* Presentation adapter. Original payload, calculations and handlers stay intact. */
(() => {
  'use strict';
  const hostOrigin = new URL(document.baseURI).origin;
  const mainViews = ['market', 'structure', 'risk'];
  const extraViews = ['fot', 'records', 'outside'];
  const notify = (event, extra = {}) => parent.postMessage({ type: 'smo:pulse', event, ...extra }, hostOrigin);
  if (typeof state === 'undefined' || typeof render !== 'function' || typeof P === 'undefined') {
    notify('error'); return;
  }
  let filtersVisible = false;
  let extrasVisible = false;
  let mainView = mainViews.includes(document.body.dataset.smoView) ? document.body.dataset.smoView : 'market';
  const extraNav = document.createElement('nav');
  extraNav.className = 'pulse-extra-materials';
  extraNav.setAttribute('aria-label', 'Дополнительные материалы исходного файла');
  extraNav.hidden = true;
  [['fot', 'ФОТ · Q4’25'], ['records', 'Реестр и контроль'], ['outside', 'Без участия · справочно']].forEach(([view, label]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.view = view; button.textContent = label;
    button.addEventListener('click', () => { state.tab = view; render(); window.scrollTo(0, 0); });
    extraNav.append(button);
  });
  document.getElementById('content').before(extraNav);
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16"/><path class="pulse-icon-segment p1" d="M7 15v-4"/><path class="pulse-icon-segment p2" d="M12 15V7"/><path class="pulse-icon-segment p3" d="M17 15V4"/></svg>';
  function decorate() {
    document.querySelectorAll('#content > .card > h2, #content > .card > summary > h2, #content .grid > .card > h2, #content .grid > .card > summary > h2').forEach(heading => {
      if (heading.querySelector('.pulse-panel-icon')) return;
      const badge = document.createElement('span');
      badge.className = 'pulse-panel-icon'; badge.setAttribute('aria-hidden', 'true'); badge.innerHTML = icon;
      heading.prepend(badge);
    });
    document.querySelectorAll('#content > .card, #content > .grid').forEach((card, index) => {
      card.style.setProperty('--pulse-enter-order', String(Math.min(index, 5)));
    });
    document.querySelector('.filters').hidden = !filtersVisible;
    document.body.dataset.smoFilters = String(filtersVisible);
    extraNav.hidden = !extrasVisible;
    extraNav.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === state.tab);
      button.setAttribute('aria-pressed', String(button.dataset.view === state.tab));
    });
    notify('theme', { dark: document.body.dataset.theme === 'dark' });
  }
  const originalTheme = chartTheme;
  chartTheme = () => {
    const theme = originalTheme();
    return { ...theme, font: { ...theme.font, family: 'Golos Text, Segoe UI, Arial, sans-serif' } };
  };
  const originalRender = render;
  render = function () { originalRender(); decorate(); };
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== hostOrigin || event.data?.type !== 'pulse:smo') return;
    const message = event.data;
    if (message.command === 'view' && mainViews.includes(message.view)) {
      mainView = message.view;
      if (state.tab !== mainView) {
        document.getElementById('detail').close();
        state.tab = mainView; render(); window.scrollTo(0, 0);
      }
    } else if (message.command === 'filters') {
      filtersVisible = message.visible === true; decorate();
    } else if (message.command === 'extras') {
      extrasVisible = message.visible === true;
      if (!extrasVisible && extraViews.includes(state.tab)) { state.tab = mainView; render(); }
      else decorate();
    } else if (message.command === 'theme') document.getElementById('theme-toggle').click();
    else if (message.command === 'print') window.print();
  });
  document.getElementById('tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-tab]');
    if (button && mainViews.includes(button.dataset.tab)) {
      mainView = button.dataset.tab; notify('view', { view: mainView });
    }
  });
  const pauseMotion = () => { document.body.dataset.motionPaused = String(document.hidden); };
  document.addEventListener('visibilitychange', pauseMotion); pauseMotion();
  state.tab = mainView;
  render();
  Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => {
    document.querySelectorAll('.js-plotly-plot').forEach(chart => { if (chart.data) Plotly.Plots.resize(chart); });
    notify('ready', { source: [P.source, `Строк: ${P.auctions.length}`, P.built ? `Сборка: ${P.built}` : ''].filter(Boolean).join(' · ') });
  }));
})();

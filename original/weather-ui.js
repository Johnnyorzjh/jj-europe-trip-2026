(function (root) {
  'use strict';
  const W = root.TripWeather;
  if (!W) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const value = (n, suffix = '') => Number.isFinite(n) ? Math.round(n) + suffix : '—';
  function iconSvg(name) {
    const cloud = '<path d="M7 17a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a3.5 3.5 0 0 1 0 7Z"/>';
    const paths = {
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
      moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
      cloud,
      'cloud-sun': '<path d="M7 2v2M2 7h2m-1-4 1.5 1.5M12 3l-1.5 1.5"/><path d="M5 10a4 4 0 1 1 6-5"/>' + cloud,
      rain: cloud + '<path d="m8 20-1 2m6-2-1 2m6-2-1 2"/>',
      snow: cloud + '<path d="M8 21h.01M13 21h.01M18 21h.01"/>',
      fog: cloud + '<path d="M5 20h14M8 23h8"/>',
      storm: cloud + '<path d="m13 16-3 4h4l-3 4"/>',
      unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 17h.01"/>'
    };
    return '<svg class="weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (paths[name] || paths.unknown) + '</svg>';
  }
  function fetchedTime(timestamp, cityId) {
    if (!timestamp) return '尚未获取';
    return new Intl.DateTimeFormat('zh-CN', { timeZone: W.cities[cityId].timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
  }
  function isStale(state, now) { return Boolean(state?.data && (state.stale || now - state.fetchedAt >= W.CACHE_TTL)); }
  function forecastMarkup(date, cityId, state, now) {
    const result = W.forecastState(state?.data, date, cityId, now);
    const city = '<span class="weather-city">' + esc(W.cities[cityId].name) + '</span>';
    if (result.kind !== 'forecast') {
      const message = result.kind === 'future' ? '尚未进入预报范围' : result.kind === 'past' ? '行程日期已过' : !state ? '正在加载天气…' : state.error ? '天气暂时无法更新' : '该日预报暂缺';
      return '<span class="weather-inline is-pending">' + city + '<span>' + message + '</span></span>';
    }
    const day = result.day;
    const weather = W.describeWeather(day.code);
    const stale = isStale(state, now);
    const futureDays = (Date.parse(date + 'T00:00:00Z') - Date.parse(W.localDate(now, W.cities[cityId].timezone) + 'T00:00:00Z')) / 86400000;
    const updated = esc(fetchedTime(state.fetchedAt, cityId));
    return '<span class="weather-inline" title="' + esc(date) + ' 当日预报；获取于 ' + updated + '（当地时间）">' +
      iconSvg(weather.icon) + city + '<span>' + esc(weather.label) + '</span>' +
      '<strong>' + value(day.low) + '–' + value(day.high) + '°C</strong><span>降雨 ' + value(day.rainProbability, '%') + '</span>' +
      (stale ? '<span class="weather-note is-stale">缓存 · ' + updated + '（当地）待更新</span>' : '') +
      (futureDays >= 7 ? '<span class="weather-note">远期</span>' : '') + '</span>';
  }
  root.TripWeatherView = Object.freeze({ forecastMarkup });
  if (!root.document) return;

  function mount() {
    const doc = root.document;
    const slots = [...doc.querySelectorAll('[data-weather-date]')];
    if (!slots.length) return;
    let disk = null;
    try { disk = root.localStorage; } catch { /* Storage is optional. */ }
    const store = W.createWeatherStore({ storage: disk });
    const states = new Map();
    const ids = [...new Set(slots.flatMap(slot => W.dayCities(slot.dataset.weatherDate)))];
    let busy = false;
    function render() {
      const now = Date.now();
      for (const slot of slots) {
        const markup = W.dayCities(slot.dataset.weatherDate).map(id => forecastMarkup(slot.dataset.weatherDate, id, states.get(id), now)).join('');
        if (slot.innerHTML !== markup) slot.innerHTML = markup;
      }
    }
    async function loadAll() {
      if (busy) return;
      busy = true;
      try {
        await Promise.all(ids.map(async id => { states.set(id, await store.get(id)); render(); }));
      } finally { busy = false; }
    }
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { render(); void loadAll(); } });
    root.addEventListener('online', () => { if (!doc.hidden) void loadAll(); });
    // Check age from retrieval, not page opening; fresh entries do not make network requests.
    root.setInterval(() => {
      if (doc.hidden) return;
      render();
      if ([...states.values()].some(state => !state.fetchedAt || Date.now() - state.fetchedAt >= W.CACHE_TTL)) void loadAll();
    }, 60000);
    render(); void loadAll();
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(globalThis);

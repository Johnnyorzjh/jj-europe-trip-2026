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
  function currentMarkup(cityId, state, now) {
    const name = esc(W.cities[cityId].name);
    if (!state) return '<div class="weather-empty">' + iconSvg('cloud') + '<div><strong>' + name + ' · 当前天气</strong><p>正在获取天气，不影响查看下方行程。</p></div></div>';
    if (!state.data) return '<div class="weather-empty">' + iconSvg('unknown') + '<div><strong>' + name + ' · 暂时无法获取天气</strong><p>请检查网络后重试。每日行程仍可正常查看。</p></div></div>';
    const current = state.data.current;
    const weather = W.describeWeather(current.code, current.isDay);
    const today = state.data.days.find(day => day.date === W.localDate(now, W.cities[cityId].timezone));
    const stale = isStale(state, now);
    return '<div class="weather-now"><div class="weather-condition-icon">' + iconSvg(weather.icon) + '</div><div><p class="weather-eyebrow">' + name + ' · 当前天气</p><div class="weather-temperature">' + value(current.temperature) + '<span>°C</span></div></div><div class="weather-condition"><strong>' + esc(weather.label) + '</strong><span>体感 ' + value(current.apparent, '°C') + '</span><span class="weather-badge' + (stale ? ' is-stale' : '') + '">' + (stale ? '缓存 · 待更新' : '当前可用数据') + '</span></div></div>' +
      '<dl class="weather-metrics"><div><dt>今日高 / 低温</dt><dd>' + value(today?.high, '°') + ' / ' + value(today?.low, '°') + '</dd></div><div><dt>今日最高降雨概率</dt><dd>' + value(today?.rainProbability, '%') + '</dd></div><div><dt>今日最大风速</dt><dd>' + value(today?.wind, ' km/h') + '</dd></div><div><dt>今日日落</dt><dd>' + (today?.sunset ? esc(today.sunset.slice(11)) : '—') + '</dd></div></dl>' +
      '<p class="weather-timestamp' + (stale ? ' is-stale' : '') + '">数据时刻 ' + esc(current.time.replace('T', ' ')) + ' · 获取于 ' + esc(fetchedTime(state.fetchedAt, cityId)) + '（均为当地时间）' + (stale ? ' · 更新未完成，请勿将缓存当作最新天气。' : '') + '</p>';
  }
  function forecastMarkup(date, cityId, state, now) {
    const result = W.forecastState(state?.data, date, cityId, now);
    const heading = '<div class="weather-chip-head"><strong>' + esc(W.cities[cityId].name) + '</strong><span>' + esc(date.slice(5)) + ' 当日预报</span></div>';
    if (result.kind !== 'forecast') {
      const message = result.kind === 'future' ? '尚未进入预报范围' : result.kind === 'past' ? '行程日期已过' : !state ? '正在加载天气…' : state.error ? '天气暂时无法更新' : '该日预报暂缺';
      const hint = result.kind === 'future' ? '临近出行后自动补齐，最长预报16天。' : result.kind === 'past' ? '不以旧预报代替历史实况。' : '不影响行程；可在天气模块稍后刷新。';
      return '<article class="weather-chip is-pending">' + heading + '<div class="weather-chip-main">' + iconSvg('unknown') + '<span>' + message + '</span></div><p class="weather-caption">' + hint + '</p></article>';
    }
    const day = result.day;
    const weather = W.describeWeather(day.code);
    const stale = isStale(state, now);
    const futureDays = (Date.parse(date + 'T00:00:00Z') - Date.parse(W.localDate(now, W.cities[cityId].timezone) + 'T00:00:00Z')) / 86400000;
    return '<article class="weather-chip">' + heading + '<div class="weather-chip-main">' + iconSvg(weather.icon) + '<span>' + esc(weather.label) + '</span><strong class="weather-range">' + value(day.high, '°') + ' / ' + value(day.low, '°') + '</strong></div><p class="weather-caption">降雨概率：' + value(day.rainProbability, '%') + ' · 最大风速：' + value(day.wind, ' km/h') + '</p><p class="weather-caption' + (stale ? ' is-stale' : '') + '">' + (stale ? '缓存 · ' : '') + '获取于 ' + esc(fetchedTime(state.fetchedAt, cityId)) + '（当地）' + (futureDays >= 7 ? ' · 远期趋势，临行前复核' : '') + '</p></article>';
  }
  root.TripWeatherView = Object.freeze({ currentMarkup, forecastMarkup });
  if (!root.document) return;

  function mount() {
    const doc = root.document;
    const select = doc.querySelector('#weatherCity');
    const panel = doc.querySelector('#weatherCurrent');
    const refresh = doc.querySelector('#weatherRefresh');
    const status = doc.querySelector('#weatherStatus');
    if (!select || !panel || !refresh || !status) return;
    let disk = null;
    try { disk = root.localStorage; } catch { /* Storage is optional. */ }
    const store = W.createWeatherStore({ storage: disk });
    const states = new Map();
    const slots = [...doc.querySelectorAll('[data-weather-date]')];
    const ids = [...new Set(slots.flatMap(slot => W.dayCities(slot.dataset.weatherDate)))];
    const optionGroup = (transit, title) => '<optgroup label="' + title + '">' + Object.entries(W.cities).filter(([, city]) => Boolean(city.transit) === transit).map(([id, city]) => '<option value="' + id + '">' + esc(city.name) + '</option>').join('') + '</optgroup>';
    select.innerHTML = optionGroup(false, '欧洲目的地') + optionGroup(true, '出发与转机城市');
    let savedCity;
    try { savedCity = disk?.getItem('europe-trip-weather-city-v1'); } catch { /* Optional preference. */ }
    select.value = Object.hasOwn(W.cities, savedCity) ? savedCity : W.recommendedCity(Date.now());
    let busy = false;
    let lastManual = 0;
    function render() {
      const now = Date.now();
      panel.innerHTML = currentMarkup(select.value, states.get(select.value), now);
      for (const slot of slots) slot.innerHTML = W.dayCities(slot.dataset.weatherDate).map(id => forecastMarkup(slot.dataset.weatherDate, id, states.get(id), now)).join('');
    }
    async function loadAll(force = false) {
      if (busy) return;
      busy = true; refresh.disabled = true;
      refresh.textContent = '更新中…'; panel.setAttribute('aria-busy', 'true');
      status.textContent = '正在检查天气数据；行程可照常查看。';
      try {
        await Promise.all(ids.map(async id => { states.set(id, await store.get(id, { force })); render(); }));
        const failed = [...states.values()].filter(state => state.error).length;
        status.textContent = failed ? failed + '个城市暂时无法更新，已有缓存会保留并标注。可稍后重试。' : '已载入目的地天气 · 页面可见时每30分钟自动检查，数据获取时间见各卡片。';
      } finally {
        busy = false; refresh.disabled = false; refresh.textContent = '刷新天气'; panel.setAttribute('aria-busy', 'false');
      }
    }
    select.addEventListener('change', () => {
      try { disk?.setItem('europe-trip-weather-city-v1', select.value); } catch { /* Optional preference. */ }
      render();
    });
    refresh.addEventListener('click', () => {
      if (Date.now() - lastManual < 60000) { status.textContent = '刚刚检查过天气，请一分钟后再试。'; return; }
      lastManual = Date.now(); void loadAll(true);
    });
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden) { render(); void loadAll(); } });
    root.addEventListener('online', () => { if (!doc.hidden) void loadAll(); });
    root.setInterval(() => { if (!doc.hidden) { render(); void loadAll(); } }, W.CACHE_TTL);
    render(); void loadAll();
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(globalThis);

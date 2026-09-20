/* Free, keyless weather. All dates refer to the destination's local calendar. */
(function (root) {
  'use strict';
  const CACHE_TTL = 30 * 60 * 1000;
  const RETRY_DELAY = 60 * 1000;
  const cities = Object.freeze({
    paris: { name: '巴黎', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
    milan: { name: '米兰', latitude: 45.4642, longitude: 9.19, timezone: 'Europe/Rome' },
    florence: { name: '佛罗伦萨', latitude: 43.7696, longitude: 11.2558, timezone: 'Europe/Rome' },
    pisa: { name: '比萨', latitude: 43.716, longitude: 10.3966, timezone: 'Europe/Rome' },
    rome: { name: '罗马 / 梵蒂冈', latitude: 41.9028, longitude: 12.4964, timezone: 'Europe/Rome' },
    budapest: { name: '布达佩斯', latitude: 47.4979, longitude: 19.0402, timezone: 'Europe/Budapest' },
    hongkong: { name: '香港', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong', transit: true },
    bangkok: { name: '曼谷', latitude: 13.7563, longitude: 100.5018, timezone: 'Asia/Bangkok', transit: true },
    dubai: { name: '迪拜', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', transit: true }
  });
  const schedule = {
    '2026-09-26': ['hongkong', 'bangkok'], '2026-09-27': ['bangkok', 'paris'],
    '2026-09-28': ['paris'], '2026-09-29': ['paris', 'milan'],
    '2026-09-30': ['milan', 'florence'], '2026-10-01': ['pisa', 'florence'],
    '2026-10-02': ['florence', 'rome'], '2026-10-03': ['rome'],
    '2026-10-04': ['rome'], '2026-10-05': ['rome'],
    '2026-10-06': ['rome', 'budapest'], '2026-10-07': ['budapest', 'dubai'],
    '2026-10-08': ['dubai', 'hongkong']
  };

  function localDate(now, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  }
  function dayCities(date) { return [...(schedule[date] || [])]; }
  function recommendedCity(now) {
    const date = localDate(now, 'Europe/Paris');
    if (date < '2026-09-26') return 'paris';
    if (date > '2026-10-07') return 'hongkong';
    const preferred = { '2026-09-26': 'hongkong', '2026-09-27': 'paris', '2026-10-02': 'rome', '2026-10-06': 'budapest' };
    return preferred[date] || dayCities(date)[0] || 'paris';
  }
  function describeWeather(code, isDay = 1) {
    const labels = {
      0: ['晴', isDay === 0 ? 'moon' : 'sun'], 1: ['大部晴朗', 'cloud-sun'],
      2: ['多云', 'cloud-sun'], 3: ['阴', 'cloud'], 45: ['有雾', 'fog'], 48: ['冻雾', 'fog'],
      51: ['轻微毛毛雨', 'rain'], 53: ['毛毛雨', 'rain'], 55: ['较强毛毛雨', 'rain'],
      56: ['冻毛毛雨', 'rain'], 57: ['较强冻毛毛雨', 'rain'],
      61: ['小雨', 'rain'], 63: ['中雨', 'rain'], 65: ['大雨', 'rain'], 66: ['冻雨', 'rain'], 67: ['较强冻雨', 'rain'],
      71: ['小雪', 'snow'], 73: ['中雪', 'snow'], 75: ['大雪', 'snow'], 77: ['雪粒', 'snow'],
      80: ['小阵雨', 'rain'], 81: ['阵雨', 'rain'], 82: ['强阵雨', 'rain'],
      85: ['阵雪', 'snow'], 86: ['强阵雪', 'snow'], 95: ['雷暴', 'storm'], 96: ['雷暴伴冰雹', 'storm'], 99: ['强雷暴伴冰雹', 'storm']
    };
    const result = Number.isInteger(code) ? labels[code] : null;
    return result ? { label: result[0], icon: result[1] } : { label: '天气状况暂缺', icon: 'unknown' };
  }
  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const value = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date;
  }
  function validTime(time) {
    return typeof time === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) && validDate(time.slice(0, 10));
  }
  function number(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null; }
  function normalize(payload, city) {
    if (!payload || payload.timezone !== city.timezone || !validTime(payload.current?.time) || !Array.isArray(payload.daily?.time)) throw new Error('Invalid weather response');
    if (payload.current_units?.temperature_2m !== '°C' || payload.current_units?.apparent_temperature !== '°C' || payload.daily_units?.temperature_2m_max !== '°C' || payload.daily_units?.temperature_2m_min !== '°C' || payload.daily_units?.precipitation_probability_max !== '%' || payload.daily_units?.wind_speed_10m_max !== 'km/h') throw new Error('Unexpected weather units');
    const dates = payload.daily.time;
    if (!dates.length || dates.length > 32 || dates.some((date, index) => !validDate(date) || (index && date <= dates[index - 1]))) throw new Error('Invalid forecast dates');
    const current = payload.current;
    const daily = payload.daily;
    return {
      current: { time: current.time, temperature: number(current.temperature_2m, -100, 70), apparent: number(current.apparent_temperature, -100, 80), code: number(current.weather_code, 0, 99), isDay: current.is_day === 0 ? 0 : 1 },
      days: dates.map((date, index) => ({
        date, code: number(daily.weather_code?.[index], 0, 99),
        high: number(daily.temperature_2m_max?.[index], -100, 70), low: number(daily.temperature_2m_min?.[index], -100, 70),
        rainProbability: number(daily.precipitation_probability_max?.[index], 0, 100), wind: number(daily.wind_speed_10m_max?.[index], 0, 400),
        sunset: validTime(daily.sunset?.[index]) ? daily.sunset[index] : null
      }))
    };
  }
  function forecastState(data, date, cityId, now) {
    const today = localDate(now, cities[cityId].timezone);
    const last = new Date(Date.parse(today + 'T00:00:00Z') + 15 * 86400000).toISOString().slice(0, 10);
    if (date < today) return { kind: 'past' };
    if (date > last) return { kind: 'future' };
    const day = data?.days.find(item => item.date === date);
    return day ? { kind: 'forecast', day } : { kind: 'missing' };
  }

  function createWeatherStore({ fetchImpl = root.fetch?.bind(root), storage = null, now = Date.now, timeoutMs = 12000 } = {}) {
    const memory = new Map();
    const pending = new Map();
    const attempts = new Map();
    const failures = new Map();
    function read(cityId) {
      if (memory.has(cityId)) return memory.get(cityId);
      try {
        const raw = storage?.getItem('europe-trip-weather-v1:' + cityId);
        if (!raw || raw.length > 75000) return null;
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || !Number.isFinite(saved.fetchedAt) || saved.fetchedAt <= 0 || saved.fetchedAt > now() + 60000) return null;
        const entry = { data: normalize(saved.payload, cities[cityId]), fetchedAt: saved.fetchedAt };
        memory.set(cityId, entry);
        return entry;
      } catch { return null; }
    }
    function snapshot(entry, error = null) {
      return { data: entry?.data || null, fetchedAt: entry?.fetchedAt || null, stale: Boolean(entry && (error || now() - entry.fetchedAt >= CACHE_TTL)), error };
    }
    async function get(cityId, { force = false } = {}) {
      const city = cities[cityId];
      if (!city) return snapshot(null, '未知目的地');
      if (pending.has(cityId)) return pending.get(cityId);
      const cached = read(cityId);
      if (!force && cached && now() - cached.fetchedAt < CACHE_TTL) return snapshot(cached, failures.get(cityId));
      if (attempts.has(cityId) && now() - attempts.get(cityId) < RETRY_DELAY) return snapshot(cached, failures.get(cityId));
      const operation = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        attempts.set(cityId, now());
        try {
          const url = new URL('https://api.open-meteo.com/v1/forecast');
          const params = {
            latitude: city.latitude, longitude: city.longitude, timezone: city.timezone, forecast_days: 16,
            temperature_unit: 'celsius', wind_speed_unit: 'kmh', timeformat: 'iso8601',
            current: 'temperature_2m,apparent_temperature,weather_code,is_day',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunset'
          };
          Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
          const response = await fetchImpl(url.toString(), { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
          if (!response.ok) throw new Error('Weather HTTP ' + response.status);
          const payload = await response.json();
          const entry = { data: normalize(payload, city), fetchedAt: now() };
          memory.set(cityId, entry); failures.delete(cityId);
          try { storage?.setItem('europe-trip-weather-v1:' + cityId, JSON.stringify({ version: 1, fetchedAt: entry.fetchedAt, payload })); } catch { /* Private mode / full storage: live weather still works. */ }
          return snapshot(entry);
        } catch {
          const error = '天气暂时无法更新'; failures.set(cityId, error);
          return snapshot(cached, error);
        } finally { clearTimeout(timer); }
      })();
      pending.set(cityId, operation);
      try { return await operation; } finally { pending.delete(cityId); }
    }
    return { get };
  }
  root.TripWeather = Object.freeze({ cities, localDate, dayCities, recommendedCity, describeWeather, forecastState, createWeatherStore, CACHE_TTL });
})(globalThis);

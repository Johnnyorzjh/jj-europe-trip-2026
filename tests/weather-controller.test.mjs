import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('inline forecasts load without a standalone panel and refresh a partly aged cache on expiry', async () => {
  const start = Date.parse('2026-09-27T10:00:00Z');
  let clock = start;
  let calls = 0;
  const timers = [];
  const element = () => ({ innerHTML: '', textContent: '', value: '', addEventListener() {}, setAttribute() {} });
  const slot = { ...element(), dataset: { weatherDate: '2026-09-28' } };
  const payload = {
    timezone: 'Europe/Paris',
    current_units: { temperature_2m: '°C', apparent_temperature: '°C' },
    current: { time: '2026-09-27T12:00', temperature_2m: 20, apparent_temperature: 19, weather_code: 3, is_day: 1 },
    daily_units: { temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%', wind_speed_10m_max: 'km/h' },
    daily: { time: ['2026-09-28'], temperature_2m_max: [23], temperature_2m_min: [14], weather_code: [3], precipitation_probability_max: [10], wind_speed_10m_max: [12] }
  };
  const disk = new Map([['europe-trip-weather-v1:paris', JSON.stringify({ version: 1, fetchedAt: start - 29 * 60000, payload })]]);
  const context = {
    URL, Intl, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return clock; } },
    document: { readyState: 'complete', hidden: false, querySelector: () => null, querySelectorAll: () => [slot], addEventListener() {} },
    localStorage: { getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value) },
    addEventListener() {},
    setInterval: (callback, delay) => { timers.push({ callback, delay, next: clock + delay }); },
    fetch: async () => { calls++; return { ok: true, json: async () => payload }; }
  };
  for (const file of ['weather.js', 'weather-ui.js']) vm.runInNewContext(fs.readFileSync(new URL('../original/' + file, import.meta.url), 'utf8'), context);
  await new Promise(setImmediate);
  assert.equal(calls, 0, 'fresh startup cache avoids a network request');
  assert.ok(slot.innerHTML.includes('14–23°C'), 'the itinerary displays weather without standalone controls');
  const target = start + 2 * 60000;
  for (const timer of timers) {
    while (timer.next <= target) {
      clock = timer.next;
      timer.next += timer.delay;
      timer.callback();
      await new Promise(setImmediate);
    }
  }
  clock = target;
  assert.equal(calls, 1, 'expiry triggers one refresh, not a second thirty-minute wait');
  assert.ok(slot.innerHTML.includes('12:01'));
});

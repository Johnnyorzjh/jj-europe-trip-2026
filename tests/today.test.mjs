import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = new URL('../original/today.js', import.meta.url);
const sandbox = { Date };
if (fs.existsSync(source)) vm.runInNewContext(fs.readFileSync(source, 'utf8'), sandbox);

test('today follows the device calendar across local midnight, not the UTC date', () => {
  assert.equal(typeof sandbox.TripToday?.localDate, 'function');
  const previous = process.env.TZ;
  try {
    for (const [zone, instant, expected] of [
      ['Asia/Hong_Kong', '2026-09-26T16:30:00Z', '2026-09-27'],
      ['Europe/Paris', '2026-09-26T22:30:00Z', '2026-09-27'],
      ['Europe/Rome', '2026-09-30T22:30:00Z', '2026-10-01'],
      ['Europe/Budapest', '2026-10-06T21:59:00Z', '2026-10-06'],
      ['Asia/Dubai', '2026-10-07T20:30:00Z', '2026-10-08'],
    ]) {
      process.env.TZ = zone;
      assert.equal(sandbox.TripToday.localDate(new Date(instant)), expected, zone);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('today requires the full year and date and does not invent a day outside the trip', () => {
  assert.equal(typeof sandbox.TripToday?.findDay, 'function');
  const cards = [
    { dataset: { date: '2026-09-26' } },
    { dataset: { date: '2026-10-08' } },
  ];
  assert.equal(sandbox.TripToday.findDay(cards, '2026-09-26'), cards[0]);
  assert.equal(sandbox.TripToday.findDay(cards, '2026-10-08'), cards[1]);
  for (const date of ['2026-09-25', '2026-10-09', '2027-09-26']) {
    assert.equal(sandbox.TripToday.findDay(cards, date), null);
  }
});

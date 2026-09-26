(function (root) {
  'use strict';

  // Use the device's local calendar: UTC would select tomorrow too early in Europe.
  function localDate(now = new Date()) {
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }
  function findDay(cards, date) {
    return cards.find(card => card.dataset.date === date) || null;
  }
  root.TripToday = Object.freeze({ localDate, findDay });
  if (!root.document) return;

  function mount() {
    const doc = root.document;
    const cards = [...doc.querySelectorAll('.day-card[data-date]')];
    const buttons = [...doc.querySelectorAll('[data-go-today]')];
    const status = doc.querySelector('#todayStatus');
    if (!cards.length) return;
    let lastDate = null;

    function refresh() {
      const date = localDate();
      const today = findDay(cards, date);
      cards.forEach(card => {
        const current = card === today;
        card.classList.toggle('is-today', current);
        const badge = card.querySelector('.today-badge');
        if (badge) badge.hidden = !current;
        if (current) card.setAttribute('aria-current', 'date');
        else card.removeAttribute('aria-current');
      });
      buttons.forEach(button => { button.disabled = !today; });
      if (status) {
        const message = today
          ? `今天 ${date.slice(5).replace('-', '/')} · 按设备当地日期定位`
          : date < cards[0].dataset.date
            ? '行程尚未开始 · 出发后将自动定位当天行程'
            : date > cards[cards.length - 1].dataset.date
              ? '本次行程已结束 · 可继续查看全部行程'
              : '今天没有安排 · 可继续查看全部行程';
        if (status.textContent !== message) status.textContent = message;
      }
      const changed = lastDate !== date;
      lastDate = date;
      return { today, changed };
    }

    function reveal(card, manual = false) {
      // Returning to today must work even if another city's filter hides the card.
      doc.querySelector('.filter-btn[data-filter="all"]')?.click();
      card.open = true;
      const summary = card.querySelector('summary');
      if (manual) summary?.focus({ preventScroll: true });
      const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: manual && !reducedMotion ? 'smooth' : 'instant', block: 'start' });
    }

    buttons.forEach(button => button.addEventListener('click', () => {
      const { today } = refresh();
      if (today) reveal(today, true);
    }));

    const { today } = refresh();
    // Explicit section/day links take priority over the automatic entry position.
    const linkedDay = cards.find(card => '#' + card.id === root.location.hash);
    if (linkedDay) reveal(linkedDay);
    else if (today && !root.location.hash) reveal(today);

    function checkDate() {
      if (doc.hidden) return;
      const result = refresh();
      // Same-day returns preserve manual browsing; only a calendar change relocates.
      if (result.changed && result.today) reveal(result.today);
    }
    doc.addEventListener('visibilitychange', checkDate);
    root.addEventListener('pageshow', checkDate);
    root.setInterval(checkDate, 60000);
  }

  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(typeof window === 'undefined' ? globalThis : window);

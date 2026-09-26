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
    const dateLinks = [...doc.querySelectorAll('[data-go-date]')];
    const dateRail = doc.querySelector('#dateRail');
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
      dateLinks.forEach(link => {
        const current = link.dataset.goDate === date;
        link.classList.toggle('is-today', current);
        const badge = link.querySelector('.date-today');
        if (badge) badge.hidden = !current;
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
      return { date, today, changed };
    }

    function reducedMotion() {
      return root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }

    function selectDate(card, manual) {
      let selected = null;
      dateLinks.forEach(link => {
        const current = link.dataset.goDate === card.dataset.date;
        link.classList.toggle('is-selected', current);
        if (current) {
          link.setAttribute('aria-current', 'true');
          selected = link;
        } else link.removeAttribute('aria-current');
      });
      if (!dateRail || !selected) return;
      const railBounds = dateRail.getBoundingClientRect();
      const linkBounds = selected.getBoundingClientRect();
      const margin = 8;
      const offset = linkBounds.left < railBounds.left + margin
        ? linkBounds.left - railBounds.left - margin
        : linkBounds.right > railBounds.right - margin
          ? linkBounds.right - railBounds.right + margin
          : 0;
      if (!offset) return;
      // Move only the rail; scrollIntoView here can also move the whole document.
      dateRail.scrollTo({
        left: Math.max(0, Math.min(dateRail.scrollWidth - dateRail.clientWidth, dateRail.scrollLeft + offset)),
        behavior: manual && !reducedMotion() ? 'smooth' : 'instant',
      });
    }

    function reveal(card, { manual = false, scroll = true, updateHash = false } = {}) {
      // Date navigation must work even if another city's filter hides the card.
      doc.querySelector('.filter-btn[data-filter="all"]')?.click();
      card.open = true;
      selectDate(card, manual);
      if (updateHash && root.history) {
        // Keep one history entry while letting copied URLs reopen the selected day.
        try { root.history.replaceState(root.history.state, '', '#' + card.id); }
        catch { /* Some local-file viewers do not allow history updates. */ }
      }
      const summary = card.querySelector('summary');
      if (manual) summary?.focus({ preventScroll: true });
      if (scroll) card.scrollIntoView({ behavior: manual && !reducedMotion() ? 'smooth' : 'instant', block: 'start' });
    }

    buttons.forEach(button => button.addEventListener('click', () => {
      const { today } = refresh();
      if (today) reveal(today, { manual: true, updateHash: true });
    }));

    dateLinks.forEach(link => link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const card = findDay(cards, link.dataset.goDate);
      if (!card) return;
      event.preventDefault();
      reveal(card, { manual: true, updateHash: true });
    }));

    function linkedDay() {
      return cards.find(card => '#' + card.id === root.location.hash);
    }

    root.addEventListener('hashchange', () => {
      const card = linkedDay();
      if (card) reveal(card, { manual: true });
    });

    const { date, today } = refresh();
    // Explicit section/day links take priority over the automatic entry position.
    const initialDay = linkedDay();
    if (initialDay) reveal(initialDay);
    else if (!root.location.hash) {
      if (today) reveal(today);
      else if (date < cards[0].dataset.date) reveal(cards[0], { scroll: false });
      else if (date > cards[cards.length - 1].dataset.date) reveal(cards[0], { scroll: false });
    }

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

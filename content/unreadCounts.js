// Unread count detection for each tab — DOM-only, no OAuth required.
//
// Strategy: Gmail already renders unread counts in the left sidebar for every
// label the user has. We read those badges rather than making any API call.
// For search-based tabs (e.g. "is:unread from:boss") that have no sidebar
// entry, we fall back to 0 — counts for arbitrary queries would require the
// Gmail REST API which is intentionally not used here.

const PinboxUnread = (() => {
  const cache = new Map();

  /**
   * Returns the unread count for a tab's query.
   * @param {Tab} tab
   * @returns {Promise<number>}
   */
  async function getCount(tab) {
    if (cache.has(tab.query)) return cache.get(tab.query);
    const count = fromDom(tab.query);
    cache.set(tab.query, count);
    return count;
  }

  function clearCache() {
    cache.clear();
  }

  // ---------------------------------------------------------------------------
  // DOM scraping
  // ---------------------------------------------------------------------------

  // Maps canonical query strings to Gmail's sidebar label names / aria patterns
  const QUERY_TO_LABEL = {
    'inbox':      'inbox',
    'is:starred': 'starred',
    'in:sent':    'sent',
    'in:drafts':  'drafts',
    'in:spam':    'spam',
    'in:trash':   'trash',
    'is:unread':  null,   // "All unread" — not a sidebar item, skip
  };

  function fromDom(query) {
    const q = query.trim().toLowerCase();

    // Resolve well-known views
    if (q in QUERY_TO_LABEL) {
      const labelName = QUERY_TO_LABEL[q];
      return labelName ? scrapeSidebar(labelName) : 0;
    }

    // Only scrape for pure label/in: queries — no colons in the label name
    // means no additional query operators (e.g. label:work is:unread is compound).
    const m = q.match(/^(?:label:|in:)([^:]+)$/);
    if (!m) return 0;
    return scrapeSidebar(m[1].trim());
  }

  /**
   * Searches Gmail's navigation sidebar for an element matching labelName
   * and extracts its unread count.
   *
   * Gmail renders sidebar items with aria-labels like:
   *   "Inbox 4 unread, 4 unread conversations"
   *   "Work"                          (no unread)
   *   "Newsletters 12 unread"
   *
   * It also renders a visible text badge (e.g. "4") inside the item.
   */
  function scrapeSidebar(labelName) {
    const raw        = labelName.toLowerCase();
    const normalized = raw.replace(/[-_]/g, ' ').trim();

    // Cast a wide net — Gmail uses several container/item patterns across versions.
    // nav and [role="navigation"] are both used; items may be a, li, or div.
    const candidates = document.querySelectorAll(
      'nav a, nav li, nav [data-tooltip], nav [title], ' +
      '[role="navigation"] a, [role="navigation"] li, ' +
      '[role="navigation"] [data-tooltip], [role="navigation"] [title]'
    );

    for (const el of candidates) {
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const tooltip   = (el.getAttribute('data-tooltip') || '').toLowerCase();
      const title     = (el.getAttribute('title') || '').toLowerCase();
      const text      = el.textContent.trim().toLowerCase();

      const matched =
        ariaLabel.startsWith(normalized) ||
        ariaLabel.startsWith(raw) ||
        tooltip === normalized ||
        tooltip === raw ||
        title === normalized ||
        title === raw ||
        text.startsWith(normalized + ' ') ||
        text === normalized ||
        text.startsWith(raw + ' ') ||
        text === raw;

      if (!matched) continue;

      // 1. Parse count from aria-label: "Inbox 4 unread" or "4 unread conversations"
      const ariaMatch = ariaLabel.match(/(\d+)\s*unread/);
      if (ariaMatch) return parseInt(ariaMatch[1], 10);

      // 2. Check aria-label on any descendant that mentions unread
      const unreadEl = el.querySelector('[aria-label*="unread"]');
      if (unreadEl) {
        const m = (unreadEl.getAttribute('aria-label') || '').match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }

      // 3. Gmail badge classes and data attributes across versions
      const badge = el.querySelector('.bsU, .nU, .aio, [data-count]');
      if (badge) {
        const n = parseInt(badge.textContent.trim() || badge.dataset.count, 10);
        if (!isNaN(n)) return n;
      }

      // 4. Last-resort: rightmost standalone integer span (Gmail's count badge)
      const spans = [...el.querySelectorAll('span')];
      for (const span of spans.reverse()) {
        const val = span.textContent.trim();
        if (/^\d+$/.test(val)) return parseInt(val, 10);
      }

      // Matched the label but no count badge found → 0 unread
      return 0;
    }

    return 0; // label not found in sidebar
  }

  return { getCount, clearCache };
})();

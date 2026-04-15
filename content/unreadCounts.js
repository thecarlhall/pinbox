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
    let labelName;
    if (q in QUERY_TO_LABEL) {
      labelName = QUERY_TO_LABEL[q];
    } else {
      const m = q.match(/^(?:label:|in:)(.+)$/);
      labelName = m ? m[1].trim() : null;
    }

    if (!labelName) return 0;
    return scrapeSidebar(labelName);
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
    const normalized = labelName.toLowerCase().replace(/[-_]/g, ' ');

    // Query every clickable nav item Gmail renders
    const candidates = document.querySelectorAll(
      '[role="navigation"] [role="menuitem"], ' +
      '[role="navigation"] li, ' +
      '[role="navigation"] a, ' +
      '[role="navigation"] [data-tooltip]'
    );

    for (const el of candidates) {
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const tooltip   = (el.getAttribute('data-tooltip') || '').toLowerCase();
      const text      = el.textContent.trim().toLowerCase();

      // Match by aria-label prefix, tooltip, or visible text start
      const matched =
        ariaLabel.startsWith(normalized) ||
        tooltip === normalized ||
        text.startsWith(normalized);

      if (!matched) continue;

      // 1. Parse count from aria-label: "Inbox 4 unread"
      const ariaMatch = ariaLabel.match(/(\d+)\s*unread/);
      if (ariaMatch) return parseInt(ariaMatch[1], 10);

      // 2. Look for a dedicated badge element Gmail renders inside the item
      //    Gmail uses several class patterns for the count badge across versions.
      const badge = el.querySelector(
        '[aria-label*="unread"], .bsU, .nU, .aio, [data-count]'
      );
      if (badge) {
        const n = parseInt(badge.textContent.trim() || badge.dataset.count, 10);
        if (!isNaN(n)) return n;
      }

      // 3. Look for a standalone numeric span as the last child (Gmail's badge)
      const children = [...el.querySelectorAll('span')];
      for (const span of children.reverse()) {
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

// Pinbox — Content Script Entry Point
// Loads after: shared/storage.js, shared/accounts.js,
//              content/theme.js, content/unreadCounts.js,
//              content/dragDrop.js, content/tabBar.js
// (see manifest.json content_scripts order)

(async function PinboxMain() {
  'use strict';

  // ── Prevent duplicate injection ──────────────────────────────────────────
  if (window.__pinboxLoaded) return;
  window.__pinboxLoaded = true;

  const POLL_INTERVAL_MS   = 30_000; // unread count polling
  const REINJECT_DELAY_MS  = 800;    // wait after SPA navigation before re-injecting

  let tabBarInstance = null;
  let currentAccount = null;
  let pollTimer = null;
  let reinjectTimer = null;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  await waitForGmail();
  await mount();
  watchNavigation();

  // ── Core lifecycle ────────────────────────────────────────────────────────

  async function mount() {
    currentAccount = PinboxAccounts.getActiveAccount();
    const tabs = await PinboxStorage.loadTabs(currentAccount);
    const settings = await PinboxStorage.loadSettings();

    tabBarInstance = new PinboxTabBar.TabBar(tabs, {
      onTabClick:       navigateTo,
      onTabsReordered:  (t) => PinboxStorage.saveTabs(currentAccount, t),
      onTabAdded:       (t) => PinboxStorage.saveTabs(currentAccount, t),
      onTabRemoved:     (t) => PinboxStorage.saveTabs(currentAccount, t),
    });

    const barEl = tabBarInstance.build();
    applySettingsTheme(settings.theme, barEl);

    const injected = inject(barEl);
    if (!injected) {
      console.warn('[Pinbox] Could not find injection point — will retry');
      return;
    }

    tabBarInstance.syncActiveTabFromUrl();

    if (settings.showUnreadCounts !== false) {
      startUnreadPolling(tabs);
    }

    PinboxTheme.watch((theme) => {
      if (settings.theme === 'system') tabBarInstance.applyTheme(theme);
    });

    // Listen for settings changes from the options page
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  /** Inject the tab bar into Gmail's DOM. Returns true on success. */
  function inject(barEl) {
    const target = findInjectionParent();
    if (!target) return false;

    // Remove any stale instance first
    document.getElementById('pinbox-root')?.remove();

    const { parent, before } = target;
    parent.insertBefore(barEl, before);
    return true;
  }

  /**
   * Find the injection point above Gmail's toolbar buttons.
   * Walk up from [role="main"] until we find an ancestor where the current
   * element is NOT the first child — meaning there are sibling elements
   * before it (the toolbar). Injecting at the top of that ancestor puts the
   * bar above both the toolbar and the message list.
   * Falls back to prepending inside [role="main"] if nothing suitable found.
   */
  function findInjectionParent() {
    const main = document.querySelector('[role="main"]');
    if (!main) return null;

    let current = main;
    let parent = main.parentElement;
    while (parent && parent !== document.documentElement) {
      if (parent.firstElementChild !== current) {
        // Something precedes current in this parent — inject above it all
        return { parent, before: parent.firstElementChild };
      }
      current = parent;
      parent = parent.parentElement;
    }

    // Fallback: prepend inside [role="main"]
    return { parent: main, before: main.firstElementChild };
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Navigate Gmail to a tab's query without a full page reload. */
  function navigateTo(tab) {
    const url = buildGmailUrl(tab.query);
    window.location.hash = url.hash;
    tabBarInstance.setActiveTab(tab.id);
  }

  function buildGmailUrl(query) {
    const q = query.trim().toLowerCase();
    const url = new URL(window.location.href);

    const shortcuts = {
      'inbox':       '#inbox',
      'is:starred':  '#starred',
      'in:sent':     '#sent',
      'in:drafts':   '#drafts',
      'in:trash':    '#trash',
      'in:spam':     '#spam',
      'all':         '#all',
    };

    if (shortcuts[q]) {
      url.hash = shortcuts[q];
      return url;
    }

    const labelMatch = q.match(/^(?:label:|in:)(\S+)$/);
    if (labelMatch) {
      url.hash = `#label/${encodeURIComponent(labelMatch[1])}`;
      return url;
    }

    // Generic search query
    url.hash = `#search/${encodeURIComponent(query.trim())}`;
    return url;
  }

  /** Watch for Gmail SPA navigation (hash changes) and re-sync active tab. */
  function watchNavigation() {
    window.addEventListener('hashchange', () => {
      tabBarInstance?.syncActiveTabFromUrl();

      // Re-inject if Gmail replaced the main container during navigation
      clearTimeout(reinjectTimer);
      reinjectTimer = setTimeout(ensureInjected, REINJECT_DELAY_MS);
    });

    // Also watch for Gmail's view container being replaced via MutationObserver
    const observer = new MutationObserver(() => {
      if (!document.getElementById('pinbox-root')) {
        clearTimeout(reinjectTimer);
        reinjectTimer = setTimeout(ensureInjected, REINJECT_DELAY_MS);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /** Re-inject the bar if it was removed by Gmail's own DOM mutations. */
  function ensureInjected() {
    if (document.getElementById('pinbox-root')) return; // still present
    if (!tabBarInstance) return;
    inject(tabBarInstance.root);
  }

  // ── Unread count polling ──────────────────────────────────────────────────

  function startUnreadPolling(tabs) {
    // Delay the first scrape — Gmail renders sidebar counts asynchronously
    // and they may not be present immediately after injection.
    setTimeout(() => refreshUnreadCounts(tabs), 2500);
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      PinboxUnread.clearCache();
      refreshUnreadCounts(tabs);
    }, POLL_INTERVAL_MS);
  }

  async function refreshUnreadCounts(tabs) {
    const counts = {};
    await Promise.all(
      tabs.map(async (tab) => {
        counts[tab.id] = await PinboxUnread.getCount(tab);
      })
    );
    tabBarInstance?.updateUnreadCounts(counts);
  }

  // ── Theme helpers ─────────────────────────────────────────────────────────

  function applySettingsTheme(theme, barEl) {
    if (theme === 'dark') {
      barEl.classList.add('pb-dark');
    } else if (theme === 'light') {
      barEl.classList.add('pb-light');
    } else {
      // 'system' — apply current detected theme
      barEl.classList.add(PinboxTheme.detect() === 'dark' ? 'pb-dark' : 'pb-light');
    }
  }

  // ── Storage change listener ───────────────────────────────────────────────

  async function onStorageChanged(changes, area) {
    if (area !== 'sync') return;

    const tabsKey = `tabs_${currentAccount}`;
    if (changes[tabsKey]) {
      tabBarInstance?.updateTabs(changes[tabsKey].newValue || []);
    }

    if (changes['settings']) {
      const newSettings = changes['settings'].newValue || {};
      if (tabBarInstance) {
        applySettingsTheme(newSettings.theme || 'system', tabBarInstance.root);
      }
    }
  }

  // ── Wait for Gmail to be ready ────────────────────────────────────────────

  function waitForGmail() {
    return new Promise((resolve) => {
      // Gmail is ready once [role="main"] exists and has content
      const check = () => {
        const main = document.querySelector('[role="main"]');
        if (main && main.children.length > 0) {
          resolve();
          return;
        }
        const observer = new MutationObserver(() => {
          const m = document.querySelector('[role="main"]');
          if (m && m.children.length > 0) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        check();
      } else {
        document.addEventListener('DOMContentLoaded', check);
      }
    });
  }
})();

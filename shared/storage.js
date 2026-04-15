// Typed wrappers around chrome.storage.sync.
// Consumed by both the content script (loaded via manifest) and the options page.

const PinboxStorage = (() => {
  const TABS_PREFIX = 'tabs_';
  const SETTINGS_KEY = 'settings';

  /** @returns {Promise<Tab[]>} */
  async function loadTabs(account) {
    const key = TABS_PREFIX + (account || 'default');
    const result = await chrome.storage.sync.get(key);
    return result[key] || getDefaultTabs();
  }

  /** @param {string} account @param {Tab[]} tabs */
  async function saveTabs(account, tabs) {
    const key = TABS_PREFIX + (account || 'default');
    await chrome.storage.sync.set({ [key]: tabs });
  }

  /** @returns {Promise<Settings>} */
  async function loadSettings() {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return { theme: 'system', showUnreadCounts: true, ...result[SETTINGS_KEY] };
  }

  /** @param {Partial<Settings>} settings */
  async function saveSettings(settings) {
    const current = await loadSettings();
    await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...current, ...settings } });
  }

  /** Export all data keyed by account as a JSON-serializable object. */
  async function exportAll() {
    return new Promise((resolve) => chrome.storage.sync.get(null, resolve));
  }

  /** Overwrite storage with imported data. */
  async function importAll(data) {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(data);
  }

  function getDefaultTabs() {
    return [
      { id: uid(), name: 'Inbox',   query: 'inbox',          icon: '📥' },
      { id: uid(), name: 'Starred', query: 'is:starred',     icon: '⭐' },
      { id: uid(), name: 'Sent',    query: 'in:sent',        icon: '📤' },
      { id: uid(), name: 'Unread',  query: 'is:unread',      icon: '🔵' },
    ];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return { loadTabs, saveTabs, loadSettings, saveSettings, exportAll, importAll, uid };
})();

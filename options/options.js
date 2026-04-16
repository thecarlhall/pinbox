// Pinbox — Options page script
// Runs in the options page context, which has full access to chrome.* APIs.
// PinboxStorage is loaded by the preceding <script src="../shared/storage.js"> tag.

const $ = (id) => document.getElementById(id);

// ── State ──────────────────────────────────────────────────────────────────
let currentAccount = 'default';
let tabs = [];
let settings = {};
let editingTabId = null;

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  settings = await PinboxStorage.loadSettings();
  await loadAccountOptions();
  applySettings();
  bindEvents();
}

async function loadAccountOptions() {
  // Read all storage keys to find per-account tab lists
  const all = await chrome.storage.sync.get(null);
  const accounts = Object.keys(all)
    .filter((k) => k.startsWith('tabs_'))
    .map((k) => k.replace('tabs_', ''));

  // Append 'default' rather than prepend so accounts with saved tabs are selected first
  if (!accounts.includes('default')) accounts.push('default');

  const sel = $('account-select');
  sel.innerHTML = '';
  accounts.forEach((acc) => {
    const opt = document.createElement('option');
    opt.value = acc;
    opt.textContent = acc === 'default' ? 'Default' : acc;
    sel.appendChild(opt);
  });

  currentAccount = accounts[0];
  await loadTabs();
}

async function loadTabs() {
  tabs = await PinboxStorage.loadTabs(currentAccount);
  renderTabsList();
}

// ── Rendering ──────────────────────────────────────────────────────────────

function renderTabsList() {
  const list = $('tabs-list');
  list.innerHTML = '';

  if (tabs.length === 0) {
    list.innerHTML = '<p class="empty-msg">No tabs yet. Click "+ Add tab" to get started.</p>';
    return;
  }

  tabs.forEach((tab, index) => {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.tabId = tab.id;
    row.draggable = true;

    row.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="tab-row-icon">${tab.icon || ''}</span>
      <span class="tab-row-name">${escHtml(tab.name)}</span>
      <span class="tab-row-query">${escHtml(tab.query)}</span>
      <div class="tab-row-actions">
        <button class="btn btn-sm" data-action="edit" data-index="${index}">Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete" data-index="${index}">Delete</button>
      </div>
    `;

    // Drag-and-drop reordering
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = index;
      if (fromIdx !== toIdx) {
        const [moved] = tabs.splice(fromIdx, 1);
        tabs.splice(toIdx, 0, moved);
        saveTabs();
        renderTabsList();
      }
    });

    list.appendChild(row);
  });
}

function applySettings() {
  // Theme
  const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme || 'system'}"]`);
  if (themeRadio) themeRadio.checked = true;

  // Unread counts
  $('show-unread').checked = settings.showUnreadCounts !== false;
}

// ── Event binding ──────────────────────────────────────────────────────────

function bindEvents() {
  $('account-select').addEventListener('change', async (e) => {
    currentAccount = e.target.value;
    await loadTabs();
  });

  $('add-tab-btn').addEventListener('click', () => openForm(null));

  $('tabs-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index, 10);
    if (btn.dataset.action === 'edit')   openForm(idx);
    if (btn.dataset.action === 'delete') deleteTab(idx);
  });

  $('form-save').addEventListener('click', saveFormTab);
  $('form-cancel').addEventListener('click', closeForm);

  // Theme radios
  document.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener('change', () => saveSettings());
  });

  $('show-unread').addEventListener('change', () => saveSettings());

  $('export-btn').addEventListener('click', exportConfig);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importConfig);

  $('generate-script-btn').addEventListener('click', generateScript);
  $('copy-script-btn').addEventListener('click', () => {
    navigator.clipboard.writeText($('script-code').textContent);
    showStatus('Copied to clipboard!');
  });
}

// ── Form ───────────────────────────────────────────────────────────────────

function openForm(index) {
  editingTabId = index !== null ? tabs[index]?.id : null;
  $('form-title').textContent = index !== null ? 'Edit tab' : 'Add tab';

  if (index !== null) {
    const tab = tabs[index];
    $('tab-name').value  = tab.name;
    $('tab-query').value = tab.query;
  } else {
    $('tab-name').value  = '';
    $('tab-query').value = '';
  }

  $('tab-form').classList.remove('hidden');
  $('tab-name').focus();
}

function closeForm() {
  $('tab-form').classList.add('hidden');
  editingTabId = null;
}

function saveFormTab() {
  const name  = $('tab-name').value.trim();
  const query = $('tab-query').value.trim();

  if (!name || !query) {
    showStatus('Name and query are required.', 'error');
    return;
  }

  if (editingTabId) {
    const idx = tabs.findIndex((t) => t.id === editingTabId);
    if (idx !== -1) tabs[idx] = { ...tabs[idx], name, query };
  } else {
    tabs.push({ id: PinboxStorage.uid(), name, query });
  }

  saveTabs();
  renderTabsList();
  closeForm();
  showStatus('Saved!');
}

function deleteTab(index) {
  if (tabs.length <= 1) {
    showStatus('You must keep at least one tab.', 'error');
    return;
  }
  if (!confirm(`Delete "${tabs[index].name}"?`)) return;
  tabs.splice(index, 1);
  saveTabs();
  renderTabsList();
  showStatus('Tab deleted.');
}

// ── Persistence ────────────────────────────────────────────────────────────

async function saveTabs() {
  await PinboxStorage.saveTabs(currentAccount, tabs);
}

async function saveSettings() {
  const theme = document.querySelector('input[name="theme"]:checked')?.value || 'system';
  const showUnreadCounts = $('show-unread').checked;
  settings = { theme, showUnreadCounts };
  await PinboxStorage.saveSettings(settings);
  showStatus('Settings saved.');
}

// ── Backup ─────────────────────────────────────────────────────────────────

async function exportConfig() {
  const data = await PinboxStorage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pinbox-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showStatus('Invalid JSON file.', 'error');
    return;
  }

  if (!confirm('This will overwrite all current settings. Continue?')) return;

  await PinboxStorage.importAll(data);
  await loadAccountOptions();
  applySettings();
  showStatus('Configuration imported!');
  e.target.value = '';
}

// ── Apps Script Generator ──────────────────────────────────────────────────

function generateScript() {
  const labelQuery = $('rule-label').value.trim() || 'label:inbox';
  const days       = parseInt($('rule-days').value, 10) || 30;
  const action     = $('rule-action').value;

  const actionCode = {
    archive:  'thread.moveToArchive();',
    trash:    'thread.moveToTrash();',
    markRead: 'thread.markRead();',
    star:     'thread.getMessages().forEach(m => m.star());',
  }[action];

  const comment = {
    archive:  'Archive (remove from inbox)',
    trash:    'Move to Trash',
    markRead: 'Mark as read',
    star:     'Star all messages',
  }[action];

  const script = `/**
 * Pinbox — Automation Script
 * Auto-generated. Paste into https://script.google.com and run as a trigger.
 *
 * Action : ${comment}
 * Query  : ${labelQuery}
 * Older than ${days} days
 */
function gmailTabsCleanup() {
  var query = '${labelQuery} older_than:${days}d';
  var threads = GmailApp.search(query, 0, 500);
  var count = 0;

  threads.forEach(function(thread) {
    ${actionCode}
    count++;
  });

  Logger.log('Processed ' + count + ' thread(s) matching: ' + query);
}

// To run automatically, set up a time-based trigger:
//   Edit > Current project's triggers > Add trigger
//   Function: gmailTabsCleanup | Event: Time-driven | Every day/hour
`;

  $('script-code').textContent = script;
  $('script-output').classList.remove('hidden');
}

// ── Utilities ──────────────────────────────────────────────────────────────

function showStatus(msg, type = 'success') {
  const el = $('status-msg');
  el.textContent = msg;
  el.className = `status-msg status-${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; }, 3000);
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ───────────────────────────────────────────────────────────────────
init();

// TabBar: builds and manages the injected tab bar DOM inside Gmail.

const PinboxTabBar = (() => {
  const ROOT_ID = 'pinbox-root';

  class TabBar {
    constructor(tabs, callbacks) {
      this.tabs = tabs;
      this.callbacks = callbacks;
      this.activeTabId = null;
      this.root = null;
      this.tabsContainer = null;
      this.unreadCounts = {};
      this._openDropdown = null; // currently open dropdown element
    }

    build() {
      document.getElementById(ROOT_ID)?.remove();

      const root = document.createElement('div');
      root.id = ROOT_ID;
      root.setAttribute('role', 'tablist');
      root.setAttribute('aria-label', 'Pinbox');

      const tabsContainer = document.createElement('div');
      tabsContainer.className = 'pb-tabs';
      root.appendChild(tabsContainer);

      const addBtn = document.createElement('button');
      addBtn.className = 'pb-add-btn';
      addBtn.title = 'Add tab';
      addBtn.setAttribute('aria-label', 'Add tab');
      addBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 3.5a.5.5 0 0 1 .5.5v3.5H12a.5.5 0 0 1 0 1H8.5V12a.5.5 0 0 1-1 0V8.5H4a.5.5 0 0 1 0-1h3.5V4a.5.5 0 0 1 .5-.5z"/>
      </svg>`;
      addBtn.addEventListener('click', () => this._openAddTabInline(tabsContainer, addBtn));
      root.appendChild(addBtn);

      this.root = root;
      this.tabsContainer = tabsContainer;

      // Close any open dropdown when clicking outside the tab bar
      document.addEventListener('click', (e) => {
        if (this._openDropdown && !this._openDropdown.contains(e.target)) {
          this._closeDropdown();
        }
      }, true);

      PinboxDragDrop.enableContainer(tabsContainer, (from, to) => {
        const reordered = [...this.tabs];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        this.tabs = reordered;
        this._renderTabs();
        this.callbacks.onTabsReordered(this.tabs);
      });

      this._renderTabs();
      return root;
    }

    _renderTabs() {
      this._closeDropdown();
      const container = this.tabsContainer;
      container.innerHTML = '';
      this.tabs.forEach((tab) => {
        const el = this._buildTab(tab);
        container.appendChild(el);
        PinboxDragDrop.enable(el, container, () => {});
      });
    }

    _buildTab(tab) {
      const el = document.createElement('div');
      el.className = 'pb-tab';
      el.setAttribute('role', 'tab');
      el.setAttribute('draggable', 'true');
      el.dataset.tabId = tab.id;

      if (tab.id === this.activeTabId) {
        el.classList.add('pb-active');
        el.setAttribute('aria-selected', 'true');
      }

      if (tab.icon) {
        const icon = document.createElement('span');
        icon.className = 'pb-tab-icon';
        icon.textContent = tab.icon;
        el.appendChild(icon);
      }

      const label = document.createElement('span');
      label.className = 'pb-tab-label';
      label.textContent = tab.name;
      el.appendChild(label);

      const count = this.unreadCounts[tab.id];
      if (count) {
        const badge = document.createElement('span');
        badge.className = 'pb-badge';
        badge.textContent = count > 99 ? '99+' : String(count);
        el.appendChild(badge);
      }

      // Chevron dropdown trigger (replaces the old X close button)
      const chevron = document.createElement('button');
      chevron.className = 'pb-tab-chevron';
      chevron.setAttribute('aria-label', `Options for ${tab.name}`);
      chevron.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M1.5 3.5l3.5 3.5 3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>`;
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleDropdown(tab, el, chevron);
      });
      el.appendChild(chevron);

      el.addEventListener('click', () => {
        this.setActiveTab(tab.id);
        this.callbacks.onTabClick(tab);
      });

      return el;
    }

    // ── Dropdown menu ────────────────────────────────────────────────────────

    _toggleDropdown(tab, tabEl, chevron) {
      if (this._openDropdown) {
        const alreadyOpen = this._openDropdown.dataset.tabId === tab.id;
        this._closeDropdown();
        if (alreadyOpen) return;
      }
      this._openDropdownFor(tab, tabEl, chevron);
    }

    _openDropdownFor(tab, tabEl, chevron) {
      const menu = document.createElement('div');
      menu.className = 'pb-dropdown';
      menu.dataset.tabId = tab.id;

      const editItem = this._menuItem('Edit', () => {
        this._closeDropdown();
        this._openEditInline(tab, tabEl);
      });
      const removeItem = this._menuItem('Remove', () => {
        this._closeDropdown();
        this._removeTab(tab.id);
      });
      removeItem.classList.add('pb-menu-danger');

      menu.appendChild(editItem);
      menu.appendChild(removeItem);

      // Position below the chevron button
      tabEl.style.position = 'relative';
      tabEl.appendChild(menu);

      chevron.classList.add('pb-chevron-open');
      this._openDropdown = menu;
    }

    _closeDropdown() {
      if (!this._openDropdown) return;
      const tabId = this._openDropdown.dataset.tabId;
      this._openDropdown.remove();
      this._openDropdown = null;
      // Remove open class from chevron
      const chevron = this.tabsContainer?.querySelector(
        `[data-tab-id="${tabId}"] .pb-tab-chevron`
      );
      chevron?.classList.remove('pb-chevron-open');
    }

    _menuItem(label, onClick) {
      const item = document.createElement('button');
      item.className = 'pb-menu-item';
      item.textContent = label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return item;
    }

    // ── Inline edit form ─────────────────────────────────────────────────────

    _openEditInline(tab, tabEl) {
      // Remove any existing inline form first
      this.root.querySelector('.pb-edit-inline')?.remove();

      const form = document.createElement('div');
      form.className = 'pb-add-inline pb-edit-inline';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'pb-input';
      nameInput.value = tab.name;
      nameInput.maxLength = 32;
      nameInput.placeholder = 'Tab name';

      const queryInput = document.createElement('input');
      queryInput.type = 'text';
      queryInput.className = 'pb-input';
      queryInput.value = tab.query;
      queryInput.maxLength = 256;
      queryInput.placeholder = 'Label or search query';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'pb-btn pb-btn-primary';
      saveBtn.textContent = 'Save';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'pb-btn';
      cancelBtn.textContent = 'Cancel';

      form.appendChild(nameInput);
      form.appendChild(queryInput);
      form.appendChild(saveBtn);
      form.appendChild(cancelBtn);

      // Insert form on the next line, right after the tabs container
      this.tabsContainer.insertAdjacentElement('afterend', form);
      nameInput.focus();
      nameInput.select();

      const close = () => form.remove();
      cancelBtn.addEventListener('click', close);

      saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const query = queryInput.value.trim();
        if (!name || !query) return;
        const idx = this.tabs.findIndex((t) => t.id === tab.id);
        if (idx !== -1) {
          this.tabs[idx] = { ...this.tabs[idx], name, query };
        }
        this._renderTabs();
        this.callbacks.onTabAdded(this.tabs); // reuse save callback
        close();
      });

      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') close();
      });
    }

    // ── Inline add form ──────────────────────────────────────────────────────

    _openAddTabInline(container, addBtn) {
      if (this.root.querySelector('.pb-add-inline')) return;

      const form = document.createElement('div');
      form.className = 'pb-add-inline';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Tab name';
      nameInput.className = 'pb-input';
      nameInput.maxLength = 32;

      const queryInput = document.createElement('input');
      queryInput.type = 'text';
      queryInput.placeholder = 'Label or search query';
      queryInput.className = 'pb-input';
      queryInput.maxLength = 256;

      const saveBtn = document.createElement('button');
      saveBtn.className = 'pb-btn pb-btn-primary';
      saveBtn.textContent = 'Add';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'pb-btn';
      cancelBtn.textContent = 'Cancel';

      form.appendChild(nameInput);
      form.appendChild(queryInput);
      form.appendChild(saveBtn);
      form.appendChild(cancelBtn);

      addBtn.parentNode.insertBefore(form, addBtn);
      nameInput.focus();

      const close = () => form.remove();
      cancelBtn.addEventListener('click', close);

      saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const query = queryInput.value.trim();
        if (!name || !query) return;
        this.tabs.push({ id: PinboxStorage.uid(), name, query, icon: '' });
        this._renderTabs();
        this.callbacks.onTabAdded(this.tabs);
        close();
      });

      queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') close();
      });
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

    setActiveTab(tabId) {
      this.activeTabId = tabId;
      if (!this.tabsContainer) return;
      this.tabsContainer.querySelectorAll('.pb-tab').forEach((el) => {
        const isActive = el.dataset.tabId === tabId;
        el.classList.toggle('pb-active', isActive);
        el.setAttribute('aria-selected', String(isActive));
      });
    }

    syncActiveTabFromUrl() {
      const hash = window.location.hash.slice(1);
      let matched = null;
      for (const tab of this.tabs) {
        const q = tab.query.trim().toLowerCase();
        if (
          hash === q ||
          hash === `label/${q.replace('label:', '').replace('in:', '')}` ||
          hash === `search/${encodeURIComponent(q)}` ||
          (q === 'inbox'      && hash === 'inbox')   ||
          (q === 'is:starred' && hash === 'starred') ||
          (q === 'in:sent'    && hash === 'sent')    ||
          (q === 'in:drafts'  && hash === 'drafts')
        ) {
          matched = tab.id;
          break;
        }
      }
      if (matched) this.setActiveTab(matched);
    }

    updateUnreadCounts(counts) {
      this.unreadCounts = counts;
      if (!this.tabsContainer) return;
      this.tabsContainer.querySelectorAll('.pb-tab').forEach((el) => {
        const count = counts[el.dataset.tabId] || 0;
        let badge = el.querySelector('.pb-badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'pb-badge';
            el.insertBefore(badge, el.querySelector('.pb-tab-chevron'));
          }
          badge.textContent = count > 99 ? '99+' : String(count);
        } else {
          badge?.remove();
        }
      });
    }

    applyTheme(theme) {
      if (!this.root) return;
      this.root.classList.toggle('pb-dark', theme === 'dark');
      this.root.classList.toggle('pb-light', theme === 'light');
    }

    _removeTab(tabId) {
      if (this.tabs.length <= 1) return;
      this.tabs = this.tabs.filter((t) => t.id !== tabId);
      this._renderTabs();
      this.callbacks.onTabRemoved(this.tabs);
    }

    updateTabs(tabs) {
      this.tabs = tabs;
      this._renderTabs();
    }
  }

  return { TabBar };
})();

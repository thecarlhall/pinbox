// Horizontal (and multi-row) drag-and-drop reordering for the tab bar.
// Uses the HTML5 Drag and Drop API with pointer position to determine insertion slot.

const PinboxDragDrop = (() => {
  /**
   * Make a tab element draggable and wire up drop-zone logic for the container.
   * @param {HTMLElement} tabEl  - The individual tab element
   * @param {HTMLElement} container - The tabs wrapper element
   * @param {Function} onReorder - Called with (fromIndex, toIndex) after a drop
   */
  function enable(tabEl, container, onReorder) {
    tabEl.setAttribute('draggable', 'true');

    tabEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabEl.dataset.tabId);
      // Defer adding the class so the ghost image isn't affected
      requestAnimationFrame(() => tabEl.classList.add('pb-dragging'));
    });

    tabEl.addEventListener('dragend', () => {
      tabEl.classList.remove('pb-dragging');
      clearDropIndicator(container);
    });
  }

  /**
   * Wire the container to accept drops.
   * @param {HTMLElement} container
   * @param {Function} onReorder - (fromIndex, toIndex) => void
   */
  function enableContainer(container, onReorder) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      showDropIndicator(container, e.clientX, e.clientY);
    });

    container.addEventListener('dragleave', (e) => {
      // Only clear when leaving the container itself
      if (!container.contains(e.relatedTarget)) {
        clearDropIndicator(container);
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      clearDropIndicator(container);

      const draggedId = e.dataTransfer.getData('text/plain');
      const tabs = [...container.querySelectorAll('.pb-tab[data-tab-id]')];
      const fromIndex = tabs.findIndex((t) => t.dataset.tabId === draggedId);
      const toIndex = getDropIndex(tabs, e.clientX, e.clientY);

      if (fromIndex !== -1 && toIndex !== fromIndex) {
        onReorder(fromIndex, toIndex);
      }
    });
  }

  /** Determine which slot the cursor is closest to. */
  function getDropIndex(tabs, x, y) {
    for (let i = 0; i < tabs.length; i++) {
      const rect = tabs[i].getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      // For multi-row layouts, prefer row proximity then x position
      if (y < rect.bottom && x < midX) return i;
      if (y < rect.bottom && x >= midX) return i + 1;
    }
    return tabs.length;
  }

  let indicator = null;

  function showDropIndicator(container, x, y) {
    const tabs = [...container.querySelectorAll('.pb-tab[data-tab-id]')];
    const idx = getDropIndex(tabs, x, y);

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pb-drop-indicator';
    }

    // Insert indicator at the target slot
    const ref = tabs[idx] || null;
    container.insertBefore(indicator, ref);
  }

  function clearDropIndicator(container) {
    if (indicator && indicator.parentNode === container) {
      container.removeChild(indicator);
    }
  }

  return { enable, enableContainer };
})();

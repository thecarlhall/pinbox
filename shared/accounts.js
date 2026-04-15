// Detects the active Gmail account email and account index (u/0, u/1, …).

const PinboxAccounts = (() => {
  /** Returns the account index from the URL path (0-based). */
  function getAccountIndex() {
    const match = window.location.pathname.match(/\/mail\/u\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extracts the active account email from Gmail's DOM.
   * Gmail renders the account email in the top-right account switcher area.
   * Falls back to a synthetic key based on the account index.
   */
  function getActiveAccount() {
    // Try the account menu aria-label: "Google Account: user@example.com"
    const accountEl = document.querySelector('[aria-label^="Google Account:"]');
    if (accountEl) {
      const match = accountEl.getAttribute('aria-label').match(/:\s*(\S+@\S+)/);
      if (match) return match[1].toLowerCase();
    }

    // Try the profile image alt text
    const profileImg = document.querySelector('img.gb_8[alt*="@"]');
    if (profileImg) return profileImg.alt.toLowerCase();

    // Fallback to account index
    return `account_${getAccountIndex()}`;
  }

  return { getActiveAccount, getAccountIndex };
})();

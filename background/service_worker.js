// Pinbox — Service Worker (MV3)
// Minimal: just opens the options page when the toolbar icon is clicked.
// No OAuth or Gmail API calls — unread counts are read from Gmail's DOM directly.

'use strict';

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

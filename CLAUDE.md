# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Chrome extension** that injects a configurable tabs bar into Gmail, allowing users to pin labels, search queries, and custom views as tabs above their inbox.

## What We're Building

A Chrome MV3 extension that:
- Injects a tabs bar into Gmail's UI (below the search bar, above the message list)
- Each tab references a Gmail label or search query
- Supports drag-and-drop tab reordering (horizontal + multi-row)
- Shows live unread badge counts per tab (three-tier detection strategy)
- Supports Light / Dark / System themes mirroring Gmail's native dark mode
- Maintains independent tab configs per signed-in Gmail account (multi-account)
- Syncs config via `chrome.storage.sync`; supports export/import as JSON backup
- Includes an Options Dashboard with Google Apps Script code generation for automation rules (auto-trash, archive, mark-read, move emails by age)

## Key Architectural Decisions

- **MV3 content script** injects the tab bar DOM into Gmail. Use `MutationObserver` to detect when Gmail's inbox view renders (Gmail is a heavy SPA).
- **No background page** for core tab functionality — prefer content script + service worker (MV3) only when needed (e.g., badge counts via Gmail API or alarm-based polling).
- **Multi-account isolation**: key all `chrome.storage.sync` data by the active account's email address (extractable from Gmail's DOM or the `accounts.google.com` cookie).
- **Unread counts** come entirely from DOM scraping of Gmail's sidebar label badges — no OAuth or API calls needed. Counts work for named labels and standard views (Inbox, Starred, Sent, etc.). Arbitrary search-query tabs (e.g. `is:unread from:boss`) show no badge since Gmail has no sidebar entry for them.
- **Drag-and-drop**: implement with native HTML5 drag events or the Pointer Events API — avoid heavy DnD libraries to keep the extension lightweight.
- **Theme detection**: observe Gmail's `<html>` element for the `dark` attribute or data attribute that Gmail sets; mirror it in the injected tab bar.

## Extension Structure (to be created)

```
manifest.json          # MV3 manifest
content/               # Content script injected into mail.google.com
  main.js              # Entry point — bootstraps tab bar after Gmail loads
  tabBar.js            # Tab bar DOM creation and management
  dragDrop.js          # Drag-and-drop reordering logic
  unreadCounts.js      # Three-tier unread count detection
  theme.js             # Light/dark/system theme detection and application
background/
  service_worker.js    # Alarm-based tasks, OAuth token management if needed
options/
  index.html           # Options Dashboard UI
  options.js           # Settings, export/import, Apps Script code generator
shared/
  storage.js           # Typed wrappers around chrome.storage.sync
  accounts.js          # Active Gmail account detection
assets/
  icons/               # Extension icons (16, 32, 48, 128px)
  styles/              # CSS for injected tab bar (scoped to avoid Gmail conflicts)
```

## Permissions (manifest.json)

- `storage` — sync tab configs
- Host permission: `https://mail.google.com/*`

No `identity` or `oauth2` required. The extension is safe to deploy in corporate Google Workspace environments without a GCP project.

## Development

Since no build toolchain exists yet, keep it simple unless complexity demands otherwise:
- Plain ES modules in the content script (bundled via esbuild/rollup if imports grow)
- Load unpacked extension from Chrome's `chrome://extensions` with Developer Mode on
- Test by navigating to `mail.google.com` after loading the extension

To reload after changes: click the reload icon on `chrome://extensions` or use the Extensions Reloader extension during development.

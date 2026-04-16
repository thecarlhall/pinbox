# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pinbox** is a Chrome MV3 extension that injects a tab bar into Gmail, letting users pin labels and search queries as one-click tabs above the inbox toolbar.

## Features

- Tab bar injected above Gmail's own toolbar buttons, above the message list
- Each tab references a Gmail label or search query; clicking navigates to that view
- Tab names can include emoji directly (e.g. `📥 Inbox`) — no separate icon field
- Per-tab chevron (▼) opens an Edit / Remove dropdown; inline forms for add/edit
- Horizontal drag-and-drop reordering with insertion indicator
- Live unread badge counts scraped from Gmail's sidebar DOM
- Light/dark theme detection; defaults to light
- Config synced via `chrome.storage.sync`, keyed per Gmail account
- Options dashboard: manage tabs, theme picker, export/import JSON, Apps Script generator
- Default tabs: 📥 Inbox, ⭐ Starred, 🔵 Unread

## Extension Structure

```
manifest.json              # MV3 manifest — loads content scripts in order
content/
  content_script.js        # Entry point: waits for Gmail SPA, injects bar, handles navigation
  tabBar.js                # PinboxTabBar class — DOM, dropdown menus, inline forms
  dragDrop.js              # PinboxDragDrop — HTML5 drag events, insertion indicator
  unreadCounts.js          # PinboxUnread — DOM scraping of Gmail's sidebar badges
  theme.js                 # PinboxTheme — luminance-based dark mode detection
  tabBar.css               # All injected styles, scoped under #pinbox-root
shared/
  storage.js               # PinboxStorage — chrome.storage.sync wrappers
  accounts.js              # PinboxAccounts — active Gmail account detection from DOM
background/
  service_worker.js        # Opens options page on toolbar icon click
options/
  index.html / options.js / options.css   # Options dashboard
assets/icons/              # PNG icons at 16/32/48/128px (regenerate with generate_icons.py)
```

## Key Architecture

**Content script loading order matters** — the manifest loads files sequentially, so each global (`PinboxStorage`, `PinboxAccounts`, etc.) is available by the time `content_script.js` runs. No bundler is used; each file attaches its module to a global const.

**Injection point**: `findInjectionParent()` in `content_script.js` walks up from `[role="main"]` until it finds an ancestor where the current element is not the first child — meaning Gmail's toolbar siblings precede it. The bar is inserted as the first child of that ancestor, placing it above the toolbar. Falls back to prepending inside `[role="main"]` if no such ancestor is found. Uses `position: sticky; top: 0` so it stays visible while scrolling.

**SPA navigation**: Gmail fires `hashchange` on view switches. `content_script.js` listens for this and also runs a `MutationObserver` on `document.body` to re-inject the bar if Gmail's DOM replacements remove it.

**Theme detection**: reads computed `backgroundColor` from `[role="main"]` → `.nH` → `document.body`, checking luminance. Skips elements with alpha < 0.1 (transparent) to avoid false dark detection. Defaults to `'light'` if no opaque background is found.

**Unread counts**: DOM-only, no OAuth. Searches `[role="navigation"]` items for aria-labels like `"Inbox 4 unread"`. Works for named labels and standard views; search-query tabs show no badge.

**No OAuth / no GCP project required** — safe for corporate Google Workspace environments. The `identity` permission and `oauth2` manifest key are intentionally absent.

## Permissions

- `storage` — sync tab configs across browsers
- Host permission: `https://mail.google.com/*`

## CSS / Naming Conventions

- Root element id: `#pinbox-root`
- All CSS classes prefixed `pb-` (e.g. `pb-tab`, `pb-active`, `pb-dropdown`)
- CSS variables defined on `#pinbox-root`, overridden under `#pinbox-root.pb-dark`
- Tab shape: `border-radius: 6px` (squarish, not pill-shaped)

## Tab Data Shape

```js
{ id: string, name: string, query: string }
```
No separate `icon` field — emoji belong in `name` (e.g. `'📥 Inbox'`).

## URL Routing

`buildGmailUrl(query)` in `content_script.js` maps queries to Gmail hash URLs:
- Known shortcuts (`inbox`, `is:starred`, etc.) → direct hash (`#inbox`, `#starred`)
- Single-token `in:foo` or `label:foo` → `#label/foo`
- Everything else (including multi-term queries like `in:inbox is:unread`) → `#search/<encoded>`

The `label:` / `in:` regex uses `\S+` (not `.+`) to avoid matching compound queries.

## Development

Load unpacked from `chrome://extensions` with Developer Mode on. After any file change, click the reload icon on the extension card, then hard-refresh Gmail.

Regenerate icons (needed once after cloning):
```
python3 generate_icons.py
```

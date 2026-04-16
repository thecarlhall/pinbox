# Pinbox

A Chrome extension that adds a persistent tab bar to Gmail, letting you pin labels and search queries as one-click tabs above the inbox.

## Features

- **Tab bar above the inbox** — sits above Gmail's own toolbar, stays sticky while scrolling
- **Labels and search queries** — pin any Gmail label (`label:work`) or search (`in:inbox is:unread from:boss`)
- **Unread badges** — live counts scraped from Gmail's sidebar, no API required
- **Drag-to-reorder** — rearrange tabs with horizontal drag and drop
- **Inline editing** — add, edit, and remove tabs without leaving Gmail
- **Light/dark theme** — auto-detected from Gmail's background; override in options
- **Multi-account** — config stored per Gmail account via `chrome.storage.sync`
- **No OAuth required** — safe for corporate Google Workspace environments

## Default Tabs

| Tab | Query |
|-----|-------|
| 📥 Inbox | `inbox` |
| ⭐ Starred | `is:starred` |
| 🔵 Unread | `is:unread` |

Tab names support emoji — just type them directly into the name field.

## Installation

1. Clone or download this repo
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the repo directory

After any code change, click the reload icon on the extension card and hard-refresh Gmail.

## Options

Click the Pinbox toolbar icon to open the options dashboard where you can:

- Add, edit, delete, and reorder tabs
- Choose light, dark, or system theme
- Export and import your config as JSON
- Generate a Google Apps Script for automation

## Permissions

- `storage` — sync tab config across browsers
- `https://mail.google.com/*` — inject the tab bar into Gmail

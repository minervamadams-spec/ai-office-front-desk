# Data handling

AI Office Front Desk is a local-first desktop app. There is no server operated by the app maker,
no account, and no telemetry. Everything below reflects what the current build actually does —
not an aspiration.

## Where your data lives

Everything is stored on your own computer, in your own user-data folder:

| File | What's in it |
|---|---|
| `front-desk.sqlite` | Your desk name, timezone, appearance, card layout, and anything you've typed into Routines, Affirmations, or Quick Launch. |
| `connectors.sqlite` | Per-connector status, timestamps, cached display fields (see table below), and an opaque reference id — never the secret itself. |
| `secrets.sqlite` | Encrypted API tokens / OAuth refresh tokens, encrypted at rest via your OS's own key management (Keychain on macOS, DPAPI on Windows). This app never reads or transmits these values except to make the read-only request you approved. |

Nothing is uploaded anywhere. Deleting the app's data (Settings → "Delete local app data") removes
all three files.

## Per-connector data contract

| Connector | Reads | Cached fields | Retention / deletion |
|---|---|---|---|
| Jira | Ticket key, summary, status, priority, requester, for one saved search you choose | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Google | Gmail inbox-unread count; names/links/timestamps of 5 most recent Drive files | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Outlook | Inbox-unread count; subject/sender/timestamp of 5 most recent messages | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Weather | Current temperature and conditions for one location you type in | Resolved location name, temperature, conditions | Cleared immediately on Disconnect |
| RSS | Up to 10 most recent items (title, link, publish date) from one feed URL you provide | Same fields, replaced on each sync | Cleared immediately on Disconnect |

None of these connectors can create, edit, send, delete, or comment on anything in the connected
service — every request is read-only.

## Diagnostics export

Settings → "Export diagnostics" writes a file containing only: connector id, status, last-synced
timestamp, last error message, and (for Jira/RSS) an item count. It never includes ticket text,
message contents, file names, or feed item titles.

## What this app cannot see or send

- Your OS login password, or any password — this app never asks for one.
- Anything from other apps or the original browser-based Portfolio Dashboard — the two are
  fully isolated (separate app id, separate data directory, separate local server).
- Anything about you beyond what you explicitly typed into a connector's setup form.

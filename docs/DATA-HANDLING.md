# Data handling

AI Office Front Desk is a local-first desktop app. There is no server operated by the app maker,
no account, and no telemetry. Everything below reflects what the current build actually does —
not an aspiration.

## Which desk you're looking at

See the README's "Which desk am I looking at" section — most installs see the **generic
dashboard**, not the original built-in desk. The two store data differently; both sections below
are accurate for the one that applies to you.

## Where your data lives — original built-in desk

Everything is stored on your own computer, in your own user-data folder:

| File | What's in it |
|---|---|
| `front-desk.sqlite` | Your desk name, timezone, appearance, card layout, and anything you've typed into Routines, Affirmations, or Quick Launch. |
| `connectors.sqlite` | Per-connector status, timestamps, cached display fields (see table below), and an opaque reference id — never the secret itself. |
| `secrets.sqlite` | Encrypted API tokens / OAuth refresh tokens, encrypted at rest via your OS's own key management (Keychain on macOS, DPAPI on Windows). This app never reads or transmits these values except to make the read-only request you approved. |

Nothing is uploaded anywhere. Deleting the app's data (Settings → "Delete local app data") removes
all three files.

### Per-connector data contract — original built-in desk

| Connector | Reads | Cached fields | Retention / deletion |
|---|---|---|---|
| Jira | Ticket key, summary, status, priority, requester, for one saved search you choose | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Google | Gmail inbox-unread count; names/links/timestamps of 5 most recent Drive files | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Outlook | Inbox-unread count; subject/sender/timestamp of 5 most recent messages | Same fields, replaced on each sync | Cleared immediately on Disconnect |
| Weather | Current temperature and conditions for one location you type in | Resolved location name, temperature, conditions | Cleared immediately on Disconnect |
| RSS | Up to 10 most recent items (title, link, publish date) from one feed URL you provide | Same fields, replaced on each sync | Cleared immediately on Disconnect |

None of these connectors can create, edit, send, delete, or comment on anything in the connected
service — every request is read-only.

## Where your data lives — generic dashboard

Stored in this app's own private data folder, in plain files readable only by your local user
account (not additionally OS-keychain-encrypted — see PRIVACY.md):

| File | What's in it |
|---|---|
| `config/*.json`, `data/*.json` | Desk name, appearance, quick links, and anything you've typed in — starts empty, edited from inside the app. |
| `secrets/connector-<id>.json` | That connector's own credential(s) (a token, or a key+token pair) — never any other connector's, never shared between connectors. |
| `data/connector-state.json` | Per-connector status, last-synced timestamp, last error, and the cached display items listed below — no secret values. |

Nothing is uploaded anywhere except to the one service each connector talks to. Disconnecting a
connector deletes its secret file and clears its cached items immediately.

### Per-connector data contract — generic dashboard

| Connector | Reads | Cached fields | Retention / deletion |
|---|---|---|---|
| GitHub | Open issues/PRs from the repositories you list | Title, kind (issue/PR), state, url | Cleared immediately on Disconnect |
| Slack | Recent message previews from the public channels you list | Channel, author, a 140-character preview, url | Cleared immediately on Disconnect |
| Teams | Recent chat message previews | Chat id, author, a 140-character preview, timestamp, url | Cleared immediately on Disconnect |
| Notion | Recently edited pages you've shared with your integration | Title, last-edited time, url | Cleared immediately on Disconnect |
| Linear | Issues currently assigned to you | Identifier, title, state, url | Cleared immediately on Disconnect |
| Asana | Incomplete tasks assigned to you, across every workspace you belong to | Title, due date, url | Cleared immediately on Disconnect |
| Trello | Open cards assigned to you | Title, due date, url | Cleared immediately on Disconnect |

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

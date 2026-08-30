# Privacy policy

**Last updated:** 2026-08-30 · **Applies to:** AI Office Front Desk, version 0.1.0

## Summary

This app does not collect, transmit, sell, or share any of your data. It has no server, no
account system, and no analytics or telemetry of any kind. Everything it stores lives only on
your own computer, in a data folder unique to this app.

## What the app stores locally

See [DATA-HANDLING.md](./DATA-HANDLING.md) for the exact file-by-file, connector-by-connector
breakdown of what's cached and for how long.

## What the app sends over the network

Only requests you explicitly triggered, and only to the service you chose to connect:

- A read-only API call to Jira, Google, Microsoft, a weather service, or an RSS feed URL — each
  only after you complete that connector's own setup step.
- Nothing is sent to the app's developer. There is no app-maker-operated server this app talks to.

## Credentials

How your credentials are stored depends on which desk this app is showing you (see the README's
"Which desk am I looking at" section) — both keep tokens local-only and never transmit them
anywhere except the service you connected them to, but the storage mechanism differs:

- **The original built-in desk** encrypts API tokens and OAuth refresh tokens using your operating
  system's own credential protection (Keychain on macOS, DPAPI on Windows) before writing them to
  disk, storing only an opaque reference id — never the token itself — alongside connector status.
- **The generic dashboard** (what most installs actually see) stores each connector's credentials
  as a plain file in this app's own private data folder, readable only by your local user account
  via normal OS file permissions — not additionally encrypted by the OS keychain. This matches how
  the dashboard's own developer has always stored her personal connectors' credentials.

Either way, you can revoke any token at its source (e.g., your Atlassian account, Google account,
Trello account, or Microsoft account) at any time, independent of this app.

## Deleting your data

**Original built-in desk:** Settings → "Delete local app data" permanently removes this app's
profile, connector settings, cached display data, and encrypted secrets.

**Generic dashboard:** there is no in-app delete button for this yet. Quit the app and delete its
data folder yourself: `~/Library/Application Support/ai-office-front-desk/dashboard-instance` on
macOS (or the equivalent app-data location on Windows). This does not affect any other application
on your computer, including the separate browser-based Portfolio Dashboard this dashboard's code
is based on.

## Changes to this policy

Because this app has no server and no account system, there is no mechanism for this policy to
change without a new version of the app itself. Any change will be reflected in the version
number above and in [the changelog](../CHANGELOG.md).

## Contact

`[Installer note: add your own support contact here before distributing this app to others.]`

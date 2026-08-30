# Support

AI Office Front Desk has no app-maker-operated support desk — there is no company behind this
build, and no server it phones home to. Support is whatever the person distributing this app
sets up.

## Before asking for help

1. Check Settings → "Export diagnostics" for a redacted status report (connector status,
   timestamps, error codes — never message or ticket content) to include with a bug report.
2. Confirm which connector is involved and its exact status pill (Ready to connect / Needs
   provider setup / Unavailable in this installation / Connected / Error).
3. If a connector shows an error, the in-app message is written to be specific — include it
   verbatim.

## Common fixes

| Symptom | Likely cause |
|---|---|
| A connector won't connect | The provider (Google/Microsoft/Atlassian) may require a fresh API token or OAuth client — these expire or get revoked independently of this app. |
| The app asks for Keychain/credential access on every launch | The build is unsigned or ad-hoc signed; macOS re-prompts on every new signature. This resolves once the app is signed with a stable Developer ID. |
| A card looks empty | If you set up your own desk (rather than "Explore with examples") and haven't added anything yet, that's the real (correct) empty state, not a bug. |

## Reporting an issue

`[Installer note: add your own contact path (email, issue tracker, chat channel) here before
distributing this app to others.]`

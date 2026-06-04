# MailVault

> A power-user inbox cleanup tool for Gmail and Outlook. Local-only. No cloud, no telemetry.

MailVault is an Electron + React + TypeScript desktop app that connects directly to Gmail and Microsoft Graph using OAuth2 (PKCE for Microsoft, PKCE + client_secret for Google's Desktop client). It syncs mailbox metadata in a background worker, runs eight local intelligence analyzers, surfaces actionable suggestions, and gives you bulk-clean tools, folder management, rules, and optional **live sync** (background polling with approval-based auto-actions).

**Main areas**

| Area | What it does |
| --- | --- |
| **Dashboard** | KPIs, charts, and shortcuts into cleanup workflows |
| **Suggestions** | Intelligence feed (bulk senders, newsletters, junk rescue, folder/rule ideas, trust warnings, etc.) |
| **Analyze** | Time-range sync with live progress in the Sync Drawer |
| **Senders** | Grouped sender view for bulk delete / move |
| **Mailbox** | Folder tree + message list/preview (opened from Dashboard, Folders, or sidebar) |
| **Folders / Rules / Blocked** | Folder suggestions, rule builder, blocked-sender list |
| **Settings** | General, live sync, appearance (themes/layout/density), accounts, help |
| **Personalization** | First-run wizard + panel (⌘,) for themes and layout |

Brand assets live under `assets/brand/`; see [`resources/medias/BRAND_GUIDE.md`](resources/medias/BRAND_GUIDE.md) for logo rules and file naming.

```
┌──────────────────────────────────────────────────────────────────┐
│ MAILV△ULT  accounts…  + Add  🔔 Live  ?  ⊟                       │
├──────────┬───────────────────────────────────────────────────────┤
│ Dashboard│  Main route: Dashboard · Suggestions · Analyze ·      │
│ Suggest… │  Senders · Folders · Rules · Blocked · Settings        │
│ Analyze  │  (+ Mailbox when opened from a folder)                │
│ …        │                                                       │
├──────────┴───────────────────────────────────────────────────────┤
│ SyncDrawer (collapsible) · Reauth banner · Onboarding tour       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **macOS 13+** (Apple Silicon or Intel)
- **Node.js 18+** — `brew install node` or <https://nodejs.org>
- **Git**
- **OAuth client credentials** for Gmail and/or Outlook (free; instructions below)

---

## Setup

```bash
git clone https://github.com/<you>/mailvault.git
cd mailvault
npm install
cp .env.example .env
# → Edit .env with your Google + Microsoft OAuth credentials (see next section).
```

`npm install` runs `scripts/patch-electron-macos-brand.js` and `electron-builder install-app-deps` to rebuild `keytar` and `better-sqlite3` against Electron's native ABI.

---

## Getting OAuth Credentials

### Google (Gmail)

1. Open <https://console.cloud.google.com/> and create a project (or pick one).
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Add scopes: `gmail.readonly`, `gmail.modify`, `gmail.settings.basic`
   - Add **your personal Gmail as a Test User**
   - Leave the app in **Testing** status — verification is not required for personal use.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Desktop app**
   - Copy both the **Client ID** (ends in `.apps.googleusercontent.com`) and the **Client Secret**.

> The "secret" is bundled into the binary, so it isn't truly secret. Google still requires it on the token endpoint as an app identifier; PKCE protects the auth code itself.

### Microsoft (Hotmail / Outlook / Live / 365)

1. <https://portal.azure.com> → **Microsoft Entra ID → App registrations → New registration**.
2. Name: MailVault. Supported account types: **"Accounts in any organizational directory and personal Microsoft accounts"**.
   - This is **mandatory** for `@hotmail.com`, `@live.com`, `@outlook.com`. Selecting "work/school only" causes `AADSTS50020` on personal logins.
3. **Authentication → Add a platform → Mobile and desktop applications**:
   - Tick `http://localhost`. Microsoft accepts any loopback port at runtime once this base URI is registered.
4. **API permissions → Add → Microsoft Graph → Delegated**:
   - `openid`, `profile`, `email`, `offline_access`
   - `Mail.Read`, `Mail.ReadWrite`
   - `MailboxSettings.Read`, `MailboxSettings.ReadWrite`
   - `User.Read`
5. **Do NOT create a client secret.** Desktop apps use PKCE.
6. Copy the **Application (client) ID**.

> MailVault uses the `/consumers/` tenant for all Microsoft auth. This is the only tenant that reliably accepts personal Microsoft accounts in a public-client desktop flow.

### `.env`

```
# Google
VITE_GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=<secret>

# Microsoft
VITE_MICROSOFT_CLIENT_ID=<application-client-id>
```

---

## CLI Test Mode (no GUI)

The CLI runs the **same** OAuth + API code paths the GUI uses, but prints a step-by-step trace to your terminal so you can debug providers, scopes, and refresh tokens without opening the app. Tokens it writes go to your real OS keychain — these are **real** tests against **real** accounts.

```bash
# Local SQLite + bcrypt user-account smoke test
npm run cli -- --test=user

# Full Google OAuth flow + 4 API smoke tests
npm run cli -- --test=auth:google

# Full Microsoft OAuth flow + 4 API smoke tests
npm run cli -- --test=auth:microsoft

# 4 API tests using whatever account you've already authenticated
npm run cli -- --test=api:gmail
npm run cli -- --test=api:microsoft

# Everything in sequence (skips providers without creds)
npm run cli -- --test=all
```

Sample output (`--test=auth:google`):

```
  MailVault CLI Test Runner
  ─────────────────────────────────────────────
  Provider: Google (Gmail)

  [1/6] ✓ PKCE code_verifier generated (64 chars)
  [2/6] ✓ Auth URL constructed — opening browser…
        → https://accounts.google.com/o/oauth2/v2/auth?…
  [3/6] ✓ Authorization code received
  [4/6] ✓ Token exchange successful
        → access_token:  ya29.a0AfH6SM…  (truncated)
        → refresh_token: 1//0gLm…         (truncated)
        → expires_in:    3599s
  [5/6] ✓ Tokens stored in OS keychain (keytar)
  [6/6] ✓ Profile fetched: rafael <rafael@gmail.com>

  ─────────────────────────────────────────────
  API Smoke Tests:
  [1/4] ✓ GET /labels → 23 labels returned
  [2/4] ✓ GET /messages?q=in:inbox → 100 messages returned
  [3/4] ✓ GET /messages/{id} → metadata parsed (From, Subject, Date)
  [4/4] ✓ Token refresh → new access_token issued silently

  ─────────────────────────────────────────────
  ALL TESTS PASSED (6/6 auth, 4/4 api) ✓
```

> **How CLI mode works:** the same `electron dist-electron/main.js` entrypoint takes a `--cli` flag. When set, the main process skips creating any window and runs the test suite, then exits. This means the CLI uses the exact same native modules (keytar, better-sqlite3) that the GUI does, with no rebuild juggling.

---

## Run the GUI in Development

```bash
npm run dev
```

Vite serves the renderer at `http://localhost:5173`; `vite-plugin-electron` boots the main process. First run:

1. The **MailVault sign-in screen** appears. Create a local account (username, email, password — bcrypt-hashed, stored at `~/Library/Application Support/MailVault/users.db`).
2. A **personalization wizard** may run (themes, layout, density) before you link email.
3. If `.env` has no OAuth client IDs, an **OAuth setup** screen explains how to configure Google/Microsoft credentials; otherwise **Connect first account** is shown.
4. Click **+ Add** in the top bar and pick **Google** or **Outlook**. Your browser opens for consent; MailVault catches the redirect on `http://127.0.0.1:<random-port>`.
5. The account appears in the top bar. An **onboarding tour** may start. Use **Analyze** to sync, or open **Dashboard** / **Suggestions** after intelligence runs.

A MailVault user can link **up to 4** email accounts (Gmail and/or Outlook).

**Useful npm scripts:** `npm run dev`, `npm run build`, `npm run cli` / `npm run cli:fast`, `npm run lint`, `npm run rebuild`, `npm run gen-icons`, `npm run package:mac` (also `package:win`, `package:linux` — packaging targets exist; **macOS 13+ is the primary supported platform**).

---

## Build the macOS App

```bash
chmod +x scripts/build-mac.sh
./scripts/build-mac.sh
```

The script:

1. Verifies Node 18+, npm, macOS version, architecture.
2. Installs deps and rebuilds native modules for Electron's ABI.
3. Builds the React renderer + Electron main process.
4. Packages a **universal .app** (arm64 + x64) and a **.dmg** via electron-builder.
5. Optionally installs to `/Applications/`.

Output:
- `release/mac-universal/MailVault.app` — the app bundle
- `release/MailVault-<version>.dmg` — the installer disk image

> **Code signing & notarization:** if you export `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, the build script will sign and notarize. Otherwise the build is unsigned, which is fine for personal use and AirDrop sharing — the recipient just needs to right-click → Open the first time. See `scripts/notarize.js` for the notarization hook.

---

## Sharing with Other Macs

Two options:

**Option A — share the .dmg:**
1. Send the `.dmg` from `release/` (AirDrop, USB, Google Drive).
2. Recipient double-clicks → drags MailVault to /Applications.
3. First launch: right-click → **Open** (Gatekeeper bypass for unsigned apps).

**Option B — share the .app folder:**
1. Copy `release/mac-universal/MailVault.app` (zip it first for AirDrop reliability).
2. Recipient drops it in `/Applications`. Same first-launch caveat.

On the recipient's Mac:
1. Launch MailVault.
2. **Create a new MailVault account** (local to that Mac — usernames are independent across machines; nothing is synced anywhere).
3. **Link Gmail/Outlook** via the OAuth buttons.

Each user has their own SQLite users.db on their own Mac. Their tokens live in their own macOS Keychain, scoped to `com.mailvault.app`.

---

## Project Layout

```
mailvault/
├── README.md
├── package.json
├── vite.config.ts · tsconfig*.json · .env.example
├── scripts/
│   ├── build-mac.sh              # .app + .dmg (arm64 + x64)
│   ├── deploy.sh                 # mailvault-deploy pipeline
│   ├── install-cli.sh            # installs mailvault-deploy to PATH
│   ├── generate-icons.sh         # SVG → assets/icon.icns
│   ├── convert-assets.js         # optional PNG conversions
│   ├── patch-electron-macos-brand.js
│   ├── verify-electron-build.js
│   └── notarize.js
├── assets/
│   ├── brand/                    # SVG logos (shipped in extraResources)
│   ├── entitlements.mac.plist
│   └── icon.icns                 # generated from brand/app-icon-1024.svg
├── resources/medias/             # numbered source SVGs + BRAND_GUIDE.md
├── electron/
│   ├── main.ts · preload.ts · ipc.ts · store.ts
│   ├── auth/                     # pkce, google, microsoft
│   ├── services/
│   │   ├── syncEngine.ts         # spawns sync worker; forwards progress
│   │   ├── intelligenceEngine.ts # spawns intelligence worker after sync
│   │   ├── liveSyncEngine.ts     # background poll + notifications
│   │   ├── syncDb.ts · liveSyncDb.ts · dashboardData.ts
│   │   ├── gmail.ts · microsoft.ts · tokenManager.ts · keychain.ts
│   │   ├── userDb.ts · userSession.ts · broadcast.ts
│   │   ├── routingRules.ts · folderResolve.ts
│   │   └── liveSync/             # incomingAnalyzer, autoActionEngine
│   ├── workers/
│   │   ├── syncWorker.ts         # 5-stage pipeline (fetch → suggest)
│   │   ├── intelligenceWorker.ts # 8 analyzers → suggestions tables
│   │   ├── clients/              # gmailFetch, microsoftFetch (worker-safe)
│   │   └── analyzers/            # bulkSender, newsletter, junkRescue, …
│   ├── config/accountRoutingRules.ts
│   └── cli/                      # --cli test mode
├── shared/types.ts
└── src/                          # React renderer
    ├── App.tsx · components/ · hooks/ · lib/ · stores/
    └── types/window.d.ts         # typed window.mailvault bridge
```

---

## How Sync Works

`electron/services/syncEngine.ts` is a **main-process bridge** that spawns `electron/workers/syncWorker.ts` (Node `worker_threads`). The worker runs five stages and posts progress back; the main process forwards `SyncProgressEvent`s to the renderer and handles token refresh (keytar lives only in main).

| Stage | Label (UI) | What happens |
| --- | --- | --- |
| 1 | Probing mailbox | Estimate volume / incremental cursor |
| 2 | Fetching email metadata | List IDs in range, bulk-fetch headers. Gmail: HTTP `/batch` (100/call); Graph: paged list + JSON `$batch` (20/call) |
| 3 | Grouping by sender | Cluster by email + domain; persist to per-account SQLite (`syncDb`) |
| 4 | Analyzing patterns | Newsletters, categories, storage totals per sender |
| 5 | Finalizing & indexing | Folder suggestions + index for Senders/Dashboard |

Supports **incremental** sync (only messages newer than `maxReceivedAt`), cancellation between batches, and one active sync per account. The Sync Drawer log is a 200-entry ring buffer.

After sync completes, `intelligenceEngine.ts` automatically spawns `intelligenceWorker.ts`.

## Intelligence Engine

Eight **local** analyzers run in parallel against the sync SQLite snapshot (no extra API calls in the worker):

- Bulk senders, newsletters, junk rescue, folder suggestions, rule suggestions, large attachments, inbox clutter, sender trust

Results are scored, deduped, and stored in `suggestions` / `suggestion_groups` tables. The **Suggestions** route shows the feed; applying an action goes through main-process IPC (Gmail/Graph clients). The UI may auto-navigate to Suggestions when a run finishes if you are on Dashboard or Analyze (preference-gated).

## Live Sync

`electron/services/liveSyncEngine.ts` polls linked accounts on a timer (when enabled in **Settings → Live sync**). New messages are analyzed by `liveSync/incomingAnalyzer.ts`; high-confidence actions can run via `autoActionEngine.ts`, while others queue for **approval** (notification bell). State lives in `liveSyncDb.ts` (separate from sync DB). Polling backs off on errors and pauses when the window is unfocused (configurable).

## Architecture Notes

- **Renderer is sandbox-friendly.** Privileged work (network, OAuth, keychain, SQLite, workers) stays in the main process. The renderer uses a typed `window.mailvault` bridge (`electron/preload.ts` + `src/types/window.d.ts`).
- **Workers** must not import Electron or keytar. Sync and intelligence workers open their own SQLite handles; token refresh round-trips to main via `parentPort`.
- **Data on disk:** `users.db` (local accounts); per-account sync SQLite under Application Support; `liveSyncDb`; `electron-store` for preferences/metadata only — **never OAuth tokens in plaintext on disk**.
- **Token storage:** OS keychain via `keytar`, with Electron `safeStorage` fallback. Tokens are not logged and only go to provider endpoints.
- **Sessions:** MailVault user sessions are in-memory; closing the app signs you out. Linked email tokens persist in the keychain.
- **Token refresh** is coalesced in `tokenManager.ts`. On `invalid_grant` / `consent_required`, accounts get `needsReauth` and the Reconnect banner appears.
- **API resilience:** Gmail/Graph clients retry on 401 (refresh first) and on 429/5xx with backoff. Bulk Gmail trash/restore uses `batchModify` (1000 ids/call).
- **CSP** in `index.html` whitelists provider OAuth/API hosts for `connect-src`.
- **Preferences / themes:** `electron/store.ts` + `prefsStore` drive appearance (built-in themes, custom accent, layout templates, sidebar order). Preload applies theme CSS before first paint to avoid flash.

---

## Deploy CLI (`mailvault-deploy`)

One command to build, package, and install MailVault locally on macOS:

```bash
chmod +x scripts/install-cli.sh
./scripts/install-cli.sh

mailvault-deploy                  # patch bump + build + install
mailvault-deploy --minor
mailvault-deploy --no-version-bump
```

Or from the project root: `npm run deploy`, `npm run deploy:dry`, etc.

### mailvault-deploy: command not found

Run the installer first:

```bash
chmod +x scripts/install-cli.sh
./scripts/install-cli.sh
```

### TypeScript errors blocking deploy

Run to see all errors:

```bash
npx tsc --noEmit
npx tsc -p tsconfig.node.json --noEmit
```

### Vite build failed

Run to see full error:

```bash
npm run build:renderer
```

### electron-builder failed

Check the full log:

```bash
cat .deploy-log
```

Most common causes:

- Missing `assets/entitlements.mac.plist`
- Icon file not found (run `node scripts/convert-assets.js` or `npm run gen-icons` first)
- Native module ABI mismatch — run `npm run rebuild`

### App opens with "unidentified developer" warning

The deploy script runs `xattr -cr` automatically. If it still appears, run manually:

```bash
xattr -cr /Applications/MailVault.app
```

### Dock icon is grey (default Electron icon)

The `.icns` was not generated correctly. Run manually:

```bash
node scripts/convert-assets.js
npm run gen-icons
```

Then re-run `mailvault-deploy --no-version-bump`.

### Version not updating in the app

Verify the bundled build info:

```bash
cat /Applications/MailVault.app/Contents/Resources/dist/build-info.json
```

---

## Auth Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Browser says **Access blocked: MailVault has not completed Google verification** | Your Gmail isn't on the OAuth Test Users list | Add your email at Google Cloud → OAuth consent screen → Test users. No verification needed. |
| Microsoft shows **AADSTS50020: User account from identity provider does not exist in tenant** | Microsoft auth hit `/common/` instead of `/consumers/` | MailVault always uses `/consumers/`. If you still see this, your Azure App Registration must have *Accounts in any organizational directory and personal Microsoft accounts* selected. |
| Microsoft shows **AADSTS65001: consent required** | A required scope wasn't granted | Reconnect; consent to all permissions on the screen. |
| Google returns no `refresh_token` | `prompt=consent` was overridden, or you re-authorized too soon | Revoke MailVault at <https://myaccount.google.com/permissions> and reconnect. |
| Banner says **needs reconnect** out of the blue | Provider revoked the refresh token (security alert, password change, 6-month idle, etc.) | Click **Reconnect** in the banner. |
| **App can't be opened — Apple cannot check it for malicious software** | Unsigned build on someone else's Mac | Right-click MailVault.app → **Open**, or `xattr -cr /Applications/MailVault.app`. |
| Keychain prompts you on every launch | macOS doesn't trust the app's keychain access yet | Click **Always Allow** the first time. |
| `npm run cli -- --test=user` hangs | Almost certainly an issue rebuilding `better-sqlite3` | `npm run rebuild` then try again. |

---

## Development Caveats

- Gmail returns precise message size via `sizeEstimate`; Microsoft Graph approximates via header + preview length.
- Gmail and Outlook treat "filters"/"rules" differently. The rule model in `shared/types.ts` is a normalized superset; not every action is supported by both.
- Intelligence suggestions are computed locally from the last sync snapshot — run **Analyze** (or wait for live sync) before expecting fresh Suggestions.
- Live sync auto-actions respect confidence thresholds and user approval settings; undo is available for some bulk operations (⌘Z when an undo toast is active).
- This app is **local-only**. No telemetry. No backend. OAuth tokens stay in the OS keychain; MailVault user accounts, sync DBs, and preferences stay under `~/Library/Application Support/MailVault/` (paths differ slightly on Windows/Linux if you package there).

---

## License

MIT.

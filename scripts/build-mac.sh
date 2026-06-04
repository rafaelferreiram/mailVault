#!/usr/bin/env bash
# MailVault macOS build script.
# Produces a universal (arm64 + x64) .app bundle and a .dmg installer.
# Optional: copies the .app to /Applications.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

C_BOLD=$'\033[1m'
C_GREEN=$'\033[32m'
C_RED=$'\033[31m'
C_YELLOW=$'\033[33m'
C_DIM=$'\033[2m'
C_RESET=$'\033[0m'

ok()   { printf "    ${C_GREEN}✓${C_RESET} %s\n" "$1"; }
warn() { printf "    ${C_YELLOW}!${C_RESET} %s\n" "$1"; }
fail() { printf "    ${C_RED}✗${C_RESET} %s\n" "$1"; exit 1; }

echo
echo "${C_BOLD}🔨 MailVault macOS Build Script${C_RESET}"
echo "================================"
echo

# ─── 1. Dependencies ──────────────────────────────────────────────────
echo "[1/7] Checking dependencies..."
command -v node >/dev/null 2>&1 || fail "Node.js not found. Install via https://nodejs.org or 'brew install node'."
command -v npm  >/dev/null 2>&1 || fail "npm not found."

NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js 18+ required (found $(node -v))."
fi
ok "Node.js $(node -v)"
ok "npm $(npm -v)"
ok "macOS $(sw_vers -productVersion) ($(uname -m))"

# ─── 2. Install dependencies ──────────────────────────────────────────
# We pass --ignore-scripts so npm doesn't try to compile native modules
# (better-sqlite3, keytar) against the *Node* runtime that may not have
# prebuilt binaries for it. The next step rebuilds them against Electron's
# runtime, where prebuilds are reliable.
echo "[2/7] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund --ignore-scripts --silent
else
  npm install --no-audit --no-fund --ignore-scripts --silent
fi
ok "node_modules ready"

npx --no-install electron-builder install-app-deps >/dev/null 2>&1 \
  && ok "native modules rebuilt for Electron's ABI" \
  || fail "native module rebuild failed — try \`npx electron-builder install-app-deps\` manually"

# ─── 3. .env sanity check ─────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found. The packaged app will not be able to authenticate without OAuth credentials."
  warn "Copy .env.example to .env and fill in client IDs before sharing the build."
fi

# ─── 4. Build renderer + electron ─────────────────────────────────────
echo "[3/7] Building React renderer and Electron main..."
npm run build --silent
ok "dist/ + dist-electron/ ready"

# ─── 5. Ensure required assets exist (warn if not) ───────────────────
echo "[4/7] Checking macOS assets..."
[ -f assets/entitlements.mac.plist ] || fail "Missing assets/entitlements.mac.plist"
ok "entitlements.mac.plist present"

# Regenerate the .icns from the brand SVG when missing or stale (when the
# source SVG is newer). This keeps the dock icon in sync with whatever's in
# assets/brand/ without a separate manual step.
if [ ! -f assets/icon.icns ] \
   || [ "assets/brand/app-icon-1024.svg" -nt "assets/icon.icns" ]; then
  if command -v iconutil >/dev/null 2>&1 && command -v sips >/dev/null 2>&1; then
    echo "    generating assets/icon.icns from assets/brand/app-icon-1024.svg..."
    bash scripts/generate-icons.sh >/dev/null 2>&1 \
      && ok "assets/icon.icns regenerated" \
      || warn "icon regeneration failed — falling back to default Electron icon"
  else
    warn "assets/icon.icns missing and iconutil/sips unavailable — the .app will use the default Electron icon."
  fi
else
  ok "assets/icon.icns present"
fi

# ─── 6. Package with electron-builder ─────────────────────────────────
echo "[5/7] Packaging .app + .dmg with electron-builder..."
# Sign-and-notarize is OFF by default. Enable by exporting:
#   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
# Otherwise the build is unsigned (works on the user's own Mac after
# `xattr -cr` or Right-click → Open).
NOTARIZE_OPTS=()
if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  ok "Apple notarization credentials detected — will sign + notarize."
  export CSC_IDENTITY_AUTO_DISCOVERY=true
else
  warn "Apple notarization creds not set — building unsigned (still runs locally)."
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi

npx --no-install electron-builder \
  --mac \
  --arm64 --x64 \
  --publish never \
  ${NOTARIZE_OPTS[@]+"${NOTARIZE_OPTS[@]}"}
ok ".app + .dmg created in release/"

# ─── 7. Verify bundle ─────────────────────────────────────────────────
echo "[6/7] Verifying bundle..."
APP_PATH=""
for candidate in release/mac-universal/MailVault.app release/mac-arm64/MailVault.app release/mac/MailVault.app; do
  if [ -d "$candidate" ]; then
    APP_PATH="$candidate"
    break
  fi
done
[ -n "$APP_PATH" ] || fail ".app not found in release/"
ok "Bundle: $APP_PATH"
SIZE="$(du -sh "$APP_PATH" | awk '{print $1}')"
ok "Size:   $SIZE"

DMG_PATH="$(ls release/*.dmg 2>/dev/null | head -n1 || true)"
if [ -n "$DMG_PATH" ]; then
  ok "DMG:    $DMG_PATH"
fi

# ─── 8. Optional install ──────────────────────────────────────────────
echo "[7/7] Copy to /Applications? (y/N)"
read -r COPY_TO_APPS || COPY_TO_APPS="n"
COPY_TO_APPS="$(printf '%s' "$COPY_TO_APPS" | tr '[:upper:]' '[:lower:]')"
if [ "$COPY_TO_APPS" = "y" ] || [ "$COPY_TO_APPS" = "yes" ]; then
  rm -rf "/Applications/MailVault.app"
  cp -R "$APP_PATH" /Applications/
  # Strip quarantine attributes so first launch doesn't get blocked locally.
  xattr -cr "/Applications/MailVault.app" || true
  ok "Installed to /Applications/MailVault.app"
  echo "    ${C_DIM}→ Drag from Applications to your Dock to pin it.${C_DIM}${C_RESET}"
else
  echo "    ${C_DIM}→ App is at: $(pwd)/$APP_PATH${C_RESET}"
  echo "    ${C_DIM}→ Drag to /Applications, or copy the .dmg to share.${C_RESET}"
fi

echo
echo "${C_GREEN}${C_BOLD}✅ Build complete.${C_RESET}"
echo
echo "  To share with another Mac:"
echo "    • Send them the .dmg (release/*.dmg) — they drag MailVault → Applications."
echo "    • OR copy the .app folder via AirDrop / USB."
echo "    • First launch on a fresh Mac: right-click → Open (Gatekeeper bypass)."
echo "    • Each user creates their own MailVault account locally,"
echo "      then links their own Gmail/Outlook accounts via OAuth."
echo

#!/bin/bash
# MailVault Deploy CLI — development → signed-ready .app + .dmg + /Applications install.
# Usage: mailvault-deploy [--patch|--minor|--major|--no-version-bump]
set -euo pipefail

SECONDS=0
BUMP_TYPE="patch"
NO_BUMP=false
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$PROJECT_DIR/release"
LOG_FILE="$PROJECT_DIR/.deploy-log"

for arg in "$@"; do
  case $arg in
    --patch)            BUMP_TYPE="patch"  ;;
    --minor)            BUMP_TYPE="minor"  ;;
    --major)            BUMP_TYPE="major"  ;;
    --no-version-bump)  NO_BUMP=true       ;;
  esac
done

C_RESET=$'\033[0m'
C_BOLD=$'\033[1m'
C_DIM=$'\033[2m'
C_GREEN=$'\033[32m'
C_CYAN=$'\033[36m'
C_YELLOW=$'\033[33m'
C_RED=$'\033[31m'
C_WHITE=$'\033[97m'

TOTAL_STEPS=13

step()    { echo -e "\n${C_BOLD}${C_CYAN}[${1}/${TOTAL_STEPS}]${C_RESET} ${C_WHITE}${2}${C_RESET}"; }
ok()      { echo -e "    ${C_GREEN}✓${C_RESET} ${1}"; }
warn()    { echo -e "    ${C_YELLOW}!${C_RESET}  ${1}"; }
fail()    { echo -e "\n    ${C_RED}FAILED:${C_RESET} ${1}"; echo -e "\n${C_DIM}See log: $LOG_FILE${C_RESET}\n"; exit 1; }
info()    { echo -e "    ${C_DIM}→ ${1}${C_RESET}"; }
divider() { echo -e "${C_DIM}────────────────────────────────────────────────────────${C_RESET}"; }

cd "$PROJECT_DIR"
: > "$LOG_FILE"

clear 2>/dev/null || true
echo ""
echo -e "${C_BOLD}${C_CYAN}  MailVault Deploy  ${C_RESET}"
echo -e "${C_DIM}  $(date '+%Y-%m-%d %H:%M:%S')  macOS $(sw_vers -productVersion 2>/dev/null || echo '?')  $(uname -m)${C_RESET}"
divider
echo ""

# ── STEP 1: Pre-flight checks ──────────────────────────────────────────────

step 1 "Pre-flight checks"

NODE_VER=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [ "$NODE_VER" -ge 18 ] 2>/dev/null; then
  ok "Node.js $(node -v)"
else
  fail "Node.js 18+ required. Install: brew install node"
fi

command -v npm >/dev/null && ok "npm $(npm -v)" || fail "npm not found"

xcode-select -p >/dev/null 2>&1 \
  && ok "Xcode CLT: $(xcode-select -p)" \
  || fail "Xcode CLT required: xcode-select --install"

if [ -f "$PROJECT_DIR/.env" ]; then
  ok ".env found"
else
  warn ".env not found — using .env.example values"
  cp .env.example .env 2>/dev/null || true
fi

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  info "Running npm install..."
  npm install --silent >> "$LOG_FILE" 2>&1
  ok "npm install complete"
else
  ok "node_modules present"
fi

FREE_GB=$(df -g . | awk 'NR==2 {print $4}')
if [ "${FREE_GB:-0}" -ge 2 ]; then
  ok "Disk space: ${FREE_GB}GB free"
else
  fail "Need at least 2GB free disk space (have ${FREE_GB:-0}GB)"
fi

# ── STEP 2: Version bump ───────────────────────────────────────────────────

step 2 "Version management"

CURRENT_VERSION=$(node -p "require('./package.json').version")

if [ "$NO_BUMP" = true ]; then
  NEW_VERSION="$CURRENT_VERSION"
  warn "Version bump skipped — staying at v$CURRENT_VERSION"
else
  NEW_VERSION=$(node -e "
    const [major, minor, patch] = '$CURRENT_VERSION'.split('.').map(Number)
    const type = '$BUMP_TYPE'
    if (type === 'major') console.log((major+1) + '.0.0')
    else if (type === 'minor') console.log(major + '.' + (minor+1) + '.0')
    else console.log(major + '.' + minor + '.' + (patch+1))
  ")

  node -e "
    const fs = require('fs')
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    pkg.version = '$NEW_VERSION'
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
  "
  ok "Version: v$CURRENT_VERSION → v$NEW_VERSION ($BUMP_TYPE bump)"
fi

BUILD_DATE=$(date '+%Y-%m-%d %H:%M:%S')
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
info "Build: $BUILD_DATE  $GIT_BRANCH @ $GIT_HASH"

# ── STEP 3: Clean ─────────────────────────────────────────────────────────

step 3 "Cleaning build artifacts"

rm -rf "$PROJECT_DIR/dist"
rm -rf "$PROJECT_DIR/dist-electron"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
ok "Cleaned dist/, dist-electron/, release/"

# ── STEP 4: TypeScript type check ─────────────────────────────────────────

step 4 "TypeScript type check"

if npx tsc --noEmit >> "$LOG_FILE" 2>&1 && npx tsc -p tsconfig.node.json --noEmit >> "$LOG_FILE" 2>&1; then
  ok "No type errors"
else
  ERROR_COUNT=$(wc -l < "$LOG_FILE" | tr -d ' ')
  fail "TypeScript errors found ($ERROR_COUNT lines). Fix before deploying. Run: npx tsc --noEmit"
fi

# ── STEP 5: Lint ──────────────────────────────────────────────────────────

step 5 "Lint check"

if npx eslint src electron shared --ext .ts,.tsx --max-warnings 50 >> "$LOG_FILE.lint" 2>&1; then
  ok "Lint passed"
else
  WARN_COUNT=$(grep -cE "warning|error" "$LOG_FILE.lint" 2>/dev/null || echo "?")
  warn "Lint warnings: $WARN_COUNT — continuing (review later)"
fi

# ── STEP 6: Build renderer ────────────────────────────────────────────────

step 6 "Building React frontend (Vite)"

VITE_START=$SECONDS
if npm run build:renderer >> "$LOG_FILE" 2>&1; then
  VITE_TIME=$((SECONDS - VITE_START))
  DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "?")
  ok "Renderer built in ${VITE_TIME}s — ${DIST_SIZE}"
else
  fail "Vite build failed. Run: npm run build:renderer"
fi

# ── STEP 7: Verify Electron main ──────────────────────────────────────────

step 7 "Verifying Electron main process"

MAIN_START=$SECONDS
if npm run build:main >> "$LOG_FILE" 2>&1; then
  MAIN_TIME=$((SECONDS - MAIN_START))
  ok "Electron artifacts verified in ${MAIN_TIME}s"
else
  fail "Electron build verification failed. Run: npm run build:main"
fi

# Rebuild native modules for Electron's ABI (better-sqlite3, keytar).
info "Rebuilding native modules for Electron..."
if npx electron-builder install-app-deps >> "$LOG_FILE" 2>&1; then
  ok "Native modules ready"
else
  warn "electron-builder install-app-deps failed — packaging may still work"
fi

# ── STEP 8: Convert SVG assets ────────────────────────────────────────────

step 8 "Converting brand assets"

ICON_SVG="assets/brand/app-icon-1024.svg"
if [ ! -f "$ICON_SVG" ]; then
  fail "App icon SVG not found at $ICON_SVG"
fi

if node scripts/convert-assets.js >> "$LOG_FILE" 2>&1; then
  ok "PNG assets generated"
else
  warn "convert-assets.js failed — trying generate-icons.sh"
  bash scripts/generate-icons.sh >> "$LOG_FILE" 2>&1 || true
fi

ICONSET="build/MailVault.iconset"
mkdir -p "$ICONSET"

if [ -f "assets/brand/app-icon-1024.png" ]; then
  sips -z 16  16  assets/brand/app-icon-1024.png --out "$ICONSET/icon_16x16.png"        >/dev/null 2>&1 || true
  sips -z 32  32  assets/brand/app-icon-1024.png --out "$ICONSET/icon_16x16@2x.png"     >/dev/null 2>&1 || true
  sips -z 32  32  assets/brand/app-icon-1024.png --out "$ICONSET/icon_32x32.png"        >/dev/null 2>&1 || true
  sips -z 64  64  assets/brand/app-icon-1024.png --out "$ICONSET/icon_32x32@2x.png"     >/dev/null 2>&1 || true
  sips -z 128 128 assets/brand/app-icon-1024.png --out "$ICONSET/icon_128x128.png"      >/dev/null 2>&1 || true
  sips -z 256 256 assets/brand/app-icon-1024.png --out "$ICONSET/icon_128x128@2x.png"   >/dev/null 2>&1 || true
  sips -z 256 256 assets/brand/app-icon-1024.png --out "$ICONSET/icon_256x256.png"      >/dev/null 2>&1 || true
  sips -z 512 512 assets/brand/app-icon-1024.png --out "$ICONSET/icon_256x256@2x.png"   >/dev/null 2>&1 || true
  sips -z 512 512 assets/brand/app-icon-1024.png --out "$ICONSET/icon_512x512.png"      >/dev/null 2>&1 || true
  cp assets/brand/app-icon-1024.png "$ICONSET/icon_512x512@2x.png"
fi

if iconutil -c icns "$ICONSET" -o assets/icon.icns 2>/dev/null; then
  ok ".icns generated → assets/icon.icns"
else
  warn "iconutil failed — app will use fallback icon"
fi

# ── STEP 9: Write build info ──────────────────────────────────────────────

step 9 "Stamping build info"

node -e "
  const fs = require('fs')
  const info = {
    version:     '$NEW_VERSION',
    buildDate:   '$BUILD_DATE',
    gitHash:     '$GIT_HASH',
    gitBranch:   '$GIT_BRANCH',
    platform:    process.platform,
    arch:        process.arch,
    nodeVersion: process.version
  }
  fs.mkdirSync('dist', { recursive: true })
  fs.writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2))
"
ok "build-info.json written (v$NEW_VERSION  $GIT_HASH)"

# ── STEP 10: Package .app + .dmg ──────────────────────────────────────────

step 10 "Packaging .app and .dmg (electron-builder)"

BUILD_START=$SECONDS
ARCH=$(uname -m)

if [ "$ARCH" = "arm64" ]; then
  BUILD_ARCH="--arm64"
else
  BUILD_ARCH="--x64"
fi

export CSC_IDENTITY_AUTO_DISCOVERY=false

if npx electron-builder --mac dmg $BUILD_ARCH --publish never >> "$LOG_FILE" 2>&1; then
  BUILD_TIME=$((SECONDS - BUILD_START))
  ok "Packaged in ${BUILD_TIME}s"
else
  fail "electron-builder failed. Check: $LOG_FILE"
fi

# ── STEP 11: Verify output ────────────────────────────────────────────────

step 11 "Verifying output"

APP_PATH=""
for candidate in \
  "$RELEASE_DIR/mac-arm64/MailVault.app" \
  "$RELEASE_DIR/mac/MailVault.app" \
  "$RELEASE_DIR/mac-universal/MailVault.app"; do
  if [ -d "$candidate" ]; then
    APP_PATH="$candidate"
    break
  fi
done

# Fallback search
if [ -z "$APP_PATH" ]; then
  APP_PATH=$(find "$RELEASE_DIR" -name "MailVault.app" -maxdepth 4 2>/dev/null | head -1 || true)
fi

DMG_PATH=$(find "$RELEASE_DIR" -name "*.dmg" -maxdepth 2 2>/dev/null | head -1 || true)

if [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ]; then
  ok ".app found: $(basename "$APP_PATH")"
else
  fail ".app bundle not found in release/"
fi

if [ -n "$DMG_PATH" ] && [ -f "$DMG_PATH" ]; then
  ok ".dmg found: $(basename "$DMG_PATH")"
else
  warn ".dmg not found"
fi

APP_SIZE_MB=$(du -sm "$APP_PATH" | cut -f1)
if [ "$APP_SIZE_MB" -gt 50 ]; then
  ok ".app size: ${APP_SIZE_MB}MB"
else
  warn ".app size: ${APP_SIZE_MB}MB — suspiciously small, check build"
fi

if [ -n "$DMG_PATH" ]; then
  DMG_SIZE_MB=$(du -sm "$DMG_PATH" | cut -f1)
  ok ".dmg size: ${DMG_SIZE_MB}MB"
fi

BUNDLED_VERSION=$(defaults read "$APP_PATH/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "unknown")
if [ "$BUNDLED_VERSION" = "$NEW_VERSION" ]; then
  ok "Bundle version matches: $BUNDLED_VERSION"
else
  warn "Bundle version mismatch: expected $NEW_VERSION, got $BUNDLED_VERSION"
fi

# ── STEP 12: Install to /Applications ────────────────────────────────────

step 12 "Installing to /Applications"

if [ -d "/Applications/MailVault.app" ]; then
  info "Existing installation found — replacing..."
  rm -rf "/Applications/MailVault.app"
fi

cp -R "$APP_PATH" "/Applications/MailVault.app"
ok "Installed to /Applications/MailVault.app"

xattr -cr "/Applications/MailVault.app" 2>/dev/null || true
ok "Quarantine flag removed"

# ── STEP 13: Summary ──────────────────────────────────────────────────────

step 13 "Build complete"

TOTAL_TIME=$SECONDS
MINS=$((TOTAL_TIME / 60))
SECS=$((TOTAL_TIME % 60))

echo ""
divider
echo -e "${C_BOLD}${C_GREEN}  MailVault v$NEW_VERSION deployed successfully${C_RESET}"
divider
echo ""
echo -e "  ${C_DIM}Version   ${C_RESET} v$NEW_VERSION"
echo -e "  ${C_DIM}Git       ${C_RESET} $GIT_BRANCH @ $GIT_HASH"
echo -e "  ${C_DIM}Built at  ${C_RESET} $BUILD_DATE"
echo -e "  ${C_DIM}Duration  ${C_RESET} ${MINS}m ${SECS}s"
echo ""
echo -e "  ${C_DIM}.app      ${C_RESET} $APP_PATH"
if [ -n "$DMG_PATH" ]; then
  echo -e "  ${C_DIM}.dmg      ${C_RESET} $DMG_PATH"
fi
echo -e "  ${C_DIM}Installed ${C_RESET} /Applications/MailVault.app"
echo ""
echo -e "  To open:   open /Applications/MailVault.app"
echo -e "  To share:  AirDrop the .dmg file above"
echo ""
divider
echo ""

if [ "${DEPLOY_NO_PROMPT:-}" != "1" ] && [ -t 0 ]; then
  read -r -p "  Open MailVault now? (y/n) " OPEN_APP || OPEN_APP="n"
  if [ "$OPEN_APP" = "y" ] || [ "$OPEN_APP" = "Y" ]; then
    open /Applications/MailVault.app
    echo -e "  ${C_GREEN}Launched MailVault${C_RESET}"
  fi
fi

echo ""
exit 0

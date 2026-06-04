#!/usr/bin/env bash
# Regenerate MailVault app icons from the source SVG.
#
# Outputs:
#   assets/brand/app-icon-1024.png   — base PNG (used by main.ts in dev)
#   assets/icon.icns                  — macOS dock icon (electron-builder)
#   build/MailVault.iconset/          — intermediate macOS iconset
#
# Tools used:
#   - sharp-cli (npm, fetched on-demand via npx) for SVG → PNG
#   - sips + iconutil (built into macOS) for PNG → .icns
#
# Re-run this whenever resources/medias/06-macos-app-icon.svg changes, or
# any time you want to refresh the bundled icon.

set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

C_GREEN=$'\033[32m'
C_YELLOW=$'\033[33m'
C_RED=$'\033[31m'
C_RESET=$'\033[0m'

ok()   { printf "    ${C_GREEN}✓${C_RESET} %s\n" "$1"; }
warn() { printf "    ${C_YELLOW}!${C_RESET} %s\n" "$1"; }
fail() { printf "    ${C_RED}✗${C_RESET} %s\n" "$1"; exit 1; }

SRC="assets/brand/app-icon-1024.svg"
[ -f "$SRC" ] || fail "Missing $SRC — copy from resources/medias/06-macos-app-icon.svg first."

# ─── Tool checks ──────────────────────────────────────────────────────
command -v node     >/dev/null 2>&1 || fail "node not found"
command -v sips     >/dev/null 2>&1 || fail "sips not found (macOS only)"
command -v iconutil >/dev/null 2>&1 || fail "iconutil not found (macOS only)"

# ─── 1. SVG → 1024 PNG via sharp-cli ──────────────────────────────────
echo "[1/3] Rendering SVG → PNG (1024×1024)..."
npx --yes sharp-cli \
  --input  "$SRC" \
  --output "assets/brand/app-icon-1024.png" \
  resize 1024 1024 >/dev/null
ok "assets/brand/app-icon-1024.png"

# ─── 2. PNG → macOS iconset ───────────────────────────────────────────
echo "[2/3] Building MailVault.iconset..."
ICONSET="build/MailVault.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
sips -z 16  16  assets/brand/app-icon-1024.png --out "$ICONSET/icon_16x16.png"        >/dev/null
sips -z 32  32  assets/brand/app-icon-1024.png --out "$ICONSET/icon_16x16@2x.png"     >/dev/null
sips -z 32  32  assets/brand/app-icon-1024.png --out "$ICONSET/icon_32x32.png"        >/dev/null
sips -z 64  64  assets/brand/app-icon-1024.png --out "$ICONSET/icon_32x32@2x.png"     >/dev/null
sips -z 128 128 assets/brand/app-icon-1024.png --out "$ICONSET/icon_128x128.png"      >/dev/null
sips -z 256 256 assets/brand/app-icon-1024.png --out "$ICONSET/icon_128x128@2x.png"   >/dev/null
sips -z 256 256 assets/brand/app-icon-1024.png --out "$ICONSET/icon_256x256.png"      >/dev/null
sips -z 512 512 assets/brand/app-icon-1024.png --out "$ICONSET/icon_256x256@2x.png"   >/dev/null
sips -z 512 512 assets/brand/app-icon-1024.png --out "$ICONSET/icon_512x512.png"      >/dev/null
cp assets/brand/app-icon-1024.png "$ICONSET/icon_512x512@2x.png"
ok "$ICONSET (10 sizes)"

# ─── 3. iconset → .icns ───────────────────────────────────────────────
echo "[3/3] Compiling .icns..."
iconutil -c icns "$ICONSET" -o assets/icon.icns
ok "assets/icon.icns"

echo
echo "${C_GREEN}Icons regenerated.${C_RESET}"
echo "  • assets/brand/app-icon-1024.png   (used by BrowserWindow in dev)"
echo "  • assets/icon.icns                  (bundled into the .app)"

# MailVault — Brand Assets & Logo Integration Guide

## File Index

Source files in `resources/medias/` are copied (or synced) into `assets/brand/` for builds. Use the **`assets/brand/`** path in code.

| Source (`resources/medias/`) | Shipped (`assets/brand/`) | Description | Use Case |
|------|------|-------------|----------|
| `01-icon-mark.svg` | `icon-mark.svg` | Icon mark, transparent bg | General use |
| `02-icon-mark-dark-bg.svg` | `icon-mark-dark.svg` | Icon mark on dark bg | Splash, dark UI |
| `03-horizontal-lockup-light.svg` | `logo-horizontal-light.svg` | Horizontal lockup, light bg | Light theme chrome |
| `04-horizontal-lockup-dark.svg` | `logo-horizontal-dark.svg` | Horizontal lockup, dark bg | Dark theme chrome |
| `05-stacked-lockup-light.svg` | `logo-stacked-light.svg` | Stacked lockup | About, onboarding |
| `06-macos-app-icon.svg` | `app-icon-1024.svg` | 1024×1024 app icon source | `npm run gen-icons` → `assets/icon.icns` |
| `07-favicon-32.svg` | `favicon-32.svg` | 32×32 mark | `index.html` favicon |
| `08-menubar-template.svg` | `menubar-template.svg` | macOS template icon | Menu bar (when Tray is used) |
| `09-icon-accent-cyan.svg` | `icon-accent-cyan.svg` | Cyan accent on dark | Loading / accent states |

---

## Logo Construction Rules

### The Mark
- 4 horizontal bars of **decreasing width**, left-aligned, evenly spaced vertically
- 1 vertical bar anchored to the **right edge**, full height
- Bar height: always **equal** across all 5 elements
- Width step reduction: each bar is **12–14% shorter** than the one above
- Gap between vertical bar and last horizontal bar: **0px** (they share the right boundary)

### Proportions (on a 120×100 grid)
```
Bar 1 (top):    x=0,  y=8,  width=88, height=12
Bar 2:          x=12, y=30, width=76, height=12
Bar 3:          x=24, y=52, width=64, height=12
Bar 4 (bottom): x=36, y=74, width=52, height=12
Vertical bar:   x=104, y=0, width=10, height=100
```

### Wordmark
- Font: DM Sans (fallback: Helvetica Neue → Helvetica → Arial)
- Weight: `mail` = 300 (light), `vault` = 700 (bold)
- Size: proportional — wordmark height ≈ 52% of icon mark height
- Letter spacing: -0.02em (slightly tight)
- Case: all lowercase only — never capitalize

---

## Color Tokens

```
Dark background:    #080b0f   (Midnight theme default)
Surface dark:       #0d1a26   (App icon background)
Mark on dark:       #ffffff
Mark on light:      #1a1a1a
Accent (optional):  #00d4ff   (Midnight cyan — use sparingly)
```

---

## Usage Rules

### DO
- Use the icon mark alone at sizes below 80px
- Use horizontal lockup for all text-adjacent contexts
- Use the macOS app icon SVG as the source for generating `.icns`
- Keep mark monochrome — black on light, white on dark
- Maintain minimum clear space = 1× the height of the vertical bar on all sides

### DON'T
- Never rotate the mark
- Never apply gradients to the mark
- Never change individual bar widths or proportions
- Never use the wordmark without the icon mark
- Never place on a busy/patterned background without a solid backdrop
- Never use accent cyan on the mark itself — only on background or as tint

---

## AI Agent Prompt — Logo Integration

Use the following prompt when instructing an AI coding agent to integrate
the MailVault logo assets into the project:

---

```
Integrate the MailVault logo assets into the Electron + React + TypeScript project.
The assets are located in assets/brand/. Here is exactly what to do:

## FILE PLACEMENT

Copy all SVG files into the project:
  assets/
  └── brand/
      ├── icon-mark.svg                 (01 - transparent bg)
      ├── icon-mark-dark.svg            (02 - dark bg)
      ├── logo-horizontal-light.svg     (03 - horizontal, light)
      ├── logo-horizontal-dark.svg      (04 - horizontal, dark)
      ├── logo-stacked-light.svg        (05 - stacked, light)
      ├── app-icon-1024.svg             (06 - macOS app icon)
      ├── favicon-32.svg                (07 - favicon)
      ├── menubar-template.svg          (08 - menu bar)
      └── icon-accent-cyan.svg          (09 - cyan accent variant)

## 1. ELECTRON MAIN PROCESS — Window Icon
In electron/main.ts, set the app icon:
  import path from 'path'
  const iconPath = path.join(__dirname, '../../assets/brand/app-icon-1024.png')
  // Note: Electron requires .png or .icns for macOS dock icon
  // Convert app-icon-1024.svg to PNG using sharp at build time (see build script)
  const win = new BrowserWindow({ icon: iconPath, ... })

## 2. ELECTRON MAIN PROCESS — macOS Menu Bar Icon
In electron/main.ts, for the Tray (menu bar) icon:
  import { Tray, nativeImage } from 'electron'
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirname, '../../assets/brand/menubar-template.png')
  )
  trayIcon.setTemplateImage(true)  // REQUIRED for macOS dark/light adaptation
  const tray = new Tray(trayIcon)
  tray.setToolTip('MailVault')

## 3. REACT — App Splash / Login Screen
In src/components/Auth/LoginScreen.tsx:
  import LogoDark from '../../assets/brand/logo-horizontal-dark.svg?react'
  // Use as JSX: <LogoDark className="w-48" />
  // Vite handles SVG as React component via ?react suffix with @svgr/rollup plugin

## 4. REACT — Sidebar Logo
In src/components/Sidebar.tsx:
  Import the horizontal lockup and render at top of sidebar.
  Switch between dark/light variant based on current theme:
    const { theme } = useTheme()
    const isDark = ['midnight', 'obsidian', 'terminal'].includes(theme)
  Render:
    {isDark
      ? <LogoHorizontalDark className="h-8 w-auto" />
      : <LogoHorizontalLight className="h-8 w-auto" />
    }

## 5. REACT — About Window / Onboarding
Use the stacked lockup (logo-stacked-light.svg or dark variant).
Display centered at ~120px height on the About screen and the
onboarding Step 1 welcome modal.

## 6. HTML — Favicon
In index.html <head>:
  <link rel="icon" type="image/svg+xml" href="/assets/brand/favicon-32.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32.png" />

## 7. BUILD SCRIPT — SVG to PNG/ICNS conversion
In scripts/build-mac.sh, add before electron-builder runs:

  echo "Converting SVG assets to PNG..."
  # Requires: npm install --save-dev sharp
  node scripts/convert-assets.js

Create scripts/convert-assets.js:
  const sharp = require('sharp')
  const path = require('path')

  const conversions = [
    { input: 'assets/brand/app-icon-1024.svg', output: 'assets/brand/app-icon-1024.png', size: 1024 },
    { input: 'assets/brand/favicon-32.svg',    output: 'assets/brand/favicon-32.png',    size: 32  },
    { input: 'assets/brand/menubar-template.svg', output: 'assets/brand/menubar-template.png', size: 44 },
  ]

  async function convert() {
    for (const { input, output, size } of conversions) {
      await sharp(input).resize(size, size).png().toFile(output)
      console.log(`✓ ${output}`)
    }
  }
  convert()

  Then generate .icns using iconutil (macOS only):
  mkdir -p build/MailVault.iconset
  sips -z 16 16     assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_16x16.png
  sips -z 32 32     assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_16x16@2x.png
  sips -z 32 32     assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_32x32.png
  sips -z 64 64     assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_32x32@2x.png
  sips -z 128 128   assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_128x128.png
  sips -z 256 256   assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_128x128@2x.png
  sips -z 256 256   assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_256x256.png
  sips -z 512 512   assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_256x256@2x.png
  sips -z 512 512   assets/brand/app-icon-1024.png --out build/MailVault.iconset/icon_512x512.png
  cp assets/brand/app-icon-1024.png build/MailVault.iconset/icon_512x512@2x.png
  iconutil -c icns build/MailVault.iconset -o assets/brand/app-icon.icns
  echo "✓ app-icon.icns generated"

## 8. VITE CONFIG — SVG as React components
In vite.config.ts, add @svgr/rollup plugin:
  import svgr from '@svgr/rollup'
  export default defineConfig({
    plugins: [
      svgr({ exportType: 'named', ref: true, svgo: true }),
      react(),
      ...
    ]
  })

  Install: npm install --save-dev @svgr/rollup

## VALIDATION CHECKLIST
- [ ] App dock icon shows correctly in macOS Dock at all sizes
- [ ] Menu bar icon adapts to macOS dark/light mode (template image)
- [ ] Sidebar logo switches between dark/light SVG based on active theme
- [ ] Favicon shows in Electron window title bar
- [ ] About screen uses stacked lockup centered
- [ ] Onboarding Step 1 displays logo-horizontal-dark.svg
- [ ] build-mac.sh generates .icns without errors
- [ ] SVG files load without CORS issues in Electron renderer
- [ ] Logo never appears blurry — always served as SVG, PNG only for system use
```

---

## Minimum Sizes

| Context | Minimum | Recommended |
|---------|---------|-------------|
| Dock icon | 32×32px (PNG) | 1024×1024px source |
| Menu bar | 22×22px (template PNG) | 44×44px @2x |
| Sidebar | 24px height | 32px height |
| Splash / About | 80px height | 120px height |
| Favicon | 16×16px | 32×32px |
| README | 40px height | 60px height |

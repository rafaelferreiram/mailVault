// Optional Apple notarization hook for electron-builder.
// Wired in via package.json "build.afterSign": "scripts/notarize.js" (uncomment when ready).
//
// Required environment variables:
//   APPLE_ID                       — your Apple developer account email
//   APPLE_APP_SPECIFIC_PASSWORD    — generated at https://appleid.apple.com → Sign-In and Security → App-Specific Passwords
//   APPLE_TEAM_ID                  — your Apple Developer team identifier
//
// If any of these are missing, the script no-ops and the build continues unsigned.
//
// Notarization is only required if you plan to distribute the app *outside* of personal use.
// For your own Mac and AirDrop/USB sharing, the unsigned build works fine after first-launch
// "right-click → Open" or `xattr -cr /Applications/MailVault.app`.

import { notarize } from '@electron/notarize';

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not set — skipping.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  console.log(`[notarize] Submitting ${appPath} to Apple…`);

  await notarize({
    appBundleId: 'com.mailvault.app',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
  console.log('[notarize] Notarization complete.');
}

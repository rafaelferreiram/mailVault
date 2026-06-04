import { useEffect, useState } from 'react';
import {
  KeyRound,
  ExternalLink,
  Folder as FolderIcon,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';
import { GoogleIcon, OutlookIcon } from '../ui/ProviderIcon';
import { BrandMark } from '../Brand';
import { useUIStore } from '@/stores/uiStore';
import type { OAuthConfigStatus } from '@shared/types';

/**
 * Shown when OAuth credentials are missing. Walks the user through registering
 * a Google Cloud OAuth client + an Azure App Registration and pasting the
 * resulting IDs into the local `.env` file.
 *
 * Why an in-app screen instead of a docs page: zero context-switching cost,
 * and the "Open .env" button surfaces the right file in Finder so the user
 * doesn't have to hunt for the project root.
 */
export function OAuthSetupScreen({
  status,
  onRecheck,
}: {
  status: OAuthConfigStatus;
  onRecheck: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  const openEnv = async () => {
    const r = await window.mailvault.oauthOpenEnv();
    if (r.ok) {
      showToast('ok', 'Opened .env — paste your client IDs and save.');
    } else {
      showToast('err', `.env not found at ${r.path}`);
    }
  };

  const recheck = async () => {
    setBusy(true);
    await onRecheck();
    setBusy(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto drag-region">
      <div className="w-full max-w-4xl mx-auto p-6 lg:p-10 space-y-5 no-drag">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BrandMark className="h-3.5 w-auto text-fg" />
              <span className="px-2 h-[18px] inline-flex items-center bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.16em]">
                One-time setup
              </span>
            </div>
            <h1 className="text-[26px] leading-[32px] font-semibold tracking-tight">
              Connect MailVault to your providers
            </h1>
            <p className="mt-2 text-sm text-fg-muted max-w-xl">
              MailVault is a local app — it talks directly to Google &amp; Microsoft using
              <strong className="text-fg"> your own OAuth client IDs</strong>. We can't ship
              shared keys (they'd hit rate-limit ceilings, and Google &amp; Microsoft don't
              allow it for desktop apps anyway). Register a free OAuth client below — takes
              about 5 minutes and you only do it once.
            </p>
          </div>
          <button
            onClick={recheck}
            disabled={busy}
            className="btn btn-secondary"
            title="Re-read .env (after saving)"
          >
            <RefreshCw className={clsx('w-3 h-3', busy && 'animate-spin')} />
            {busy ? 'Checking…' : 'Re-check .env'}
          </button>
        </header>

        <div className="panel p-4 flex items-start gap-4">
          <KeyRound className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="label-mono-strong">Local config file</div>
            <div className="font-mono text-[11px] text-fg-muted mt-0.5 truncate">
              {status.envPath}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={openEnv} className="btn btn-primary">
                <FolderIcon className="w-3 h-3" />
                Open .env in Finder
              </button>
              <CopyChip
                label="Copy path"
                value={status.envPath}
                onCopied={() => showToast('ok', 'Path copied')}
              />
            </div>
            {!status.envExists && (
              <div className="mt-2 text-[11px] text-warn flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                .env doesn't exist yet — clicking "Open" will create it from .env.example.
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <ProviderCard
            provider="google"
            ok={status.google.configured}
            missing={[
              !status.google.clientId && 'VITE_GOOGLE_CLIENT_ID',
              !status.google.clientSecret && 'VITE_GOOGLE_CLIENT_SECRET',
            ].filter(Boolean) as string[]}
          />
          <ProviderCard
            provider="microsoft"
            ok={status.microsoft.configured}
            missing={[
              !status.microsoft.clientId && 'VITE_MICROSOFT_CLIENT_ID',
            ].filter(Boolean) as string[]}
          />
        </div>

        <div className="panel p-4">
          <div className="label-mono mb-2">Important security notes</div>
          <ul className="text-[12px] text-fg-muted space-y-1.5 leading-relaxed">
            <li>
              · The "client secret" Google asks for in Desktop apps is{' '}
              <strong className="text-fg">not actually secret</strong> — it's bundled in
              every electron app. PKCE (which MailVault uses) is what defends against code
              interception. Google still requires it for app identification.
            </li>
            <li>
              · MailVault never sees your password. OAuth happens entirely between you and
              Google / Microsoft in the system browser. The app receives only short-lived
              tokens, stored in the macOS Keychain.
            </li>
            <li>
              · Keep your app in <span className="text-fg">"Testing"</span> status on
              Google. It works for personal use without going through Google's verification
              process — just add yourself as a Test User.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Per-provider card ──────────────────────────────────────────────

function ProviderCard({
  provider,
  ok,
  missing,
}: {
  provider: 'google' | 'microsoft';
  ok: boolean;
  missing: string[];
}) {
  const isGoogle = provider === 'google';
  return (
    <div className={clsx('panel p-4 space-y-3', ok && 'border-ok/40')}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isGoogle ? <GoogleIcon size={16} /> : <OutlookIcon size={16} />}
          <h2 className="text-[15px] font-semibold">
            {isGoogle ? 'Google (Gmail)' : 'Microsoft (Hotmail / Outlook / Live)'}
          </h2>
        </div>
        {ok ? (
          <span className="px-2 h-5 inline-flex items-center gap-1 bg-ok/10 border border-ok/40 text-ok font-mono text-[10px] uppercase tracking-widest">
            <Check className="w-2.5 h-2.5" />
            Configured
          </span>
        ) : (
          <span className="px-2 h-5 inline-flex items-center gap-1 bg-warn/10 border border-warn/40 text-warn font-mono text-[10px] uppercase tracking-widest">
            <AlertTriangle className="w-2.5 h-2.5" />
            Missing
          </span>
        )}
      </header>

      {!ok && missing.length > 0 && (
        <div className="text-[11px] font-mono text-warn">
          Missing in .env: {missing.join(', ')}
        </div>
      )}

      <div className="text-[12px] text-fg-muted">
        {isGoogle ? <GoogleSteps /> : <MicrosoftSteps />}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {isGoogle ? (
          <>
            <ExternalChip
              label="Open Google Cloud Console"
              href="https://console.cloud.google.com/apis/credentials"
            />
            <ExternalChip
              label="OAuth consent screen"
              href="https://console.cloud.google.com/apis/credentials/consent"
            />
            <ExternalChip
              label="Enable Gmail API"
              href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
            />
          </>
        ) : (
          <>
            <ExternalChip
              label="Open Azure App Registrations"
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            />
            <ExternalChip
              label="New registration"
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade"
            />
          </>
        )}
      </div>
    </div>
  );
}

function GoogleSteps() {
  return (
    <ol className="space-y-1.5 list-decimal list-inside marker:text-fg-subtle marker:font-mono marker:text-[11px]">
      <li>Create a project (or pick one) in Google Cloud Console.</li>
      <li>
        Enable <span className="text-fg">Gmail API</span> in APIs &amp; Services → Library.
      </li>
      <li>
        Configure <span className="text-fg">OAuth consent screen</span> as External, add your
        email as a Test User. Add scopes: <code className="text-accent">gmail.readonly</code>,{' '}
        <code className="text-accent">gmail.modify</code>,{' '}
        <code className="text-accent">gmail.settings.basic</code>.
      </li>
      <li>
        Credentials → Create OAuth client ID → <span className="text-fg">Desktop app</span>. Copy{' '}
        <code className="text-accent">client_id</code> and{' '}
        <code className="text-accent">client_secret</code>.
      </li>
      <li>
        Paste into <code className="text-accent">.env</code> as{' '}
        <code className="text-accent">VITE_GOOGLE_CLIENT_ID</code> +{' '}
        <code className="text-accent">VITE_GOOGLE_CLIENT_SECRET</code>.
      </li>
    </ol>
  );
}

function MicrosoftSteps() {
  return (
    <ol className="space-y-1.5 list-decimal list-inside marker:text-fg-subtle marker:font-mono marker:text-[11px]">
      <li>Azure Portal → Microsoft Entra ID → App Registrations → New registration.</li>
      <li>
        Supported account types: <span className="text-fg">"any directory + personal MS accounts"</span>
        {' '}(required for @hotmail/@outlook/@live).
      </li>
      <li>
        Add a redirect URI under <span className="text-fg">Mobile and desktop applications</span>
        : <code className="text-accent">http://localhost</code>. Microsoft accepts any
        loopback port at runtime.
      </li>
      <li>
        API permissions → Microsoft Graph → Delegated:{' '}
        <code className="text-accent">offline_access, Mail.Read, Mail.ReadWrite, MailboxSettings.Read, MailboxSettings.ReadWrite, User.Read</code>.
      </li>
      <li>
        Copy <span className="text-fg">Application (client) ID</span> →{' '}
        <code className="text-accent">VITE_MICROSOFT_CLIENT_ID</code> in .env. No client
        secret needed (PKCE only).
      </li>
    </ol>
  );
}

// ─── Tiny helpers ──────────────────────────────────────────────────

function ExternalChip({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn btn-secondary text-[11px]"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
  );
}

function CopyChip({
  label,
  value,
  onCopied,
}: {
  label: string;
  value: string;
  onCopied: () => void;
}) {
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          onCopied();
        } catch {
          /* clipboard rejected — likely insecure context */
        }
      }}
      className="btn btn-ghost text-[11px]"
    >
      <Copy className="w-3 h-3" />
      {label}
    </button>
  );
}

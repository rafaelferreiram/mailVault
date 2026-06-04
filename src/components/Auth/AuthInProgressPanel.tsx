import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, Check } from 'lucide-react';
import clsx from 'clsx';
import { GoogleIcon, OutlookIcon } from '../ui/ProviderIcon';
import { useUIStore } from '@/stores/uiStore';

/**
 * Shown while a provider OAuth flow is mid-flight. Surfaces the auth URL so
 * the user can:
 *   - copy it again (it was auto-copied to clipboard when the flow started),
 *   - re-open it in their default browser if the original window closed or
 *     opened in the wrong browser profile,
 *   - paste it into a different browser entirely (handy when the default
 *     browser has a wrong account signed in).
 */
export function AuthInProgressPanel() {
  const [state, setState] = useState<{
    provider: 'google' | 'microsoft';
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    const offUrl = window.mailvault.onOAuthAuthUrl(({ provider, url }) => {
      setState({ provider, url });
      setCopied(true);
      // Reset the "copied" badge after 2s.
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    });
    const offDone = window.mailvault.onOAuthAuthDone(() => {
      setState(null);
    });
    return () => {
      offUrl?.();
      offDone?.();
    };
  }, []);

  if (!state) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      showToast('ok', 'Auth URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('err', 'Could not copy to clipboard');
    }
  };

  const onReopen = async () => {
    await window.mailvault.oauthReopenUrl(state.url);
    showToast('ok', 'Reopening in your default browser…');
  };

  const providerLabel = state.provider === 'google' ? 'Google' : 'Microsoft';

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[1040] flex items-center justify-center p-6 bg-black/70 backdrop-blur-[2px] animate-fade-in"
    >
      <div
        className="bg-bg-elevated border border-border w-[560px] max-w-full p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 mb-4">
          {state.provider === 'google' ? <GoogleIcon size={16} /> : <OutlookIcon size={16} />}
          <span className="label-mono text-accent">Authorizing — {providerLabel}</span>
          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin ml-auto" />
        </header>

        <h2 className="text-[18px] font-semibold tracking-tight">
          Sign in opened in your default browser
        </h2>
        <p className="mt-1.5 text-[12.5px] text-fg-muted leading-relaxed">
          Complete the sign-in there, then come back to MailVault — this dialog
          will close automatically. If the wrong browser opened (or the wrong
          profile), use the URL below.
        </p>

        <div className="mt-4 panel-inset p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="label-mono">Auth URL</span>
            <span
              className={clsx(
                'text-[10px] font-mono uppercase tracking-widest transition-colors',
                copied ? 'text-ok' : 'text-fg-subtle'
              )}
            >
              {copied ? '✓ Copied to clipboard' : 'Auto-copied when flow started'}
            </span>
          </div>
          <div className="font-term text-[10.5px] leading-[16px] text-fg break-all bg-bg-inset border border-border-subtle p-2 select-all max-h-[120px] overflow-y-auto">
            {state.url}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onCopy} className="btn btn-secondary">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            <button onClick={onReopen} className="btn btn-primary">
              <ExternalLink className="w-3 h-3" />
              Re-open in default browser
            </button>
          </div>
        </div>

        <div className="mt-4 text-[11.5px] text-fg-muted leading-relaxed">
          <strong className="text-fg">Tip:</strong> if the URL doesn't load,
          paste it into a private/incognito window — that bypasses any wrong
          account already signed into your browser.
        </div>
      </div>
    </div>
  );
}

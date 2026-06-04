import { Activity, Shield, Cpu } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';
import { GoogleIcon, OutlookIcon } from '../ui/ProviderIcon';
import { BrandLockupStacked } from '../Brand';

export function ConnectFirstAccount() {
  const login = useAccountsStore((s) => s.login);
  const loginInProgress = useAccountsStore((s) => s.loginInProgress);
  const error = useAccountsStore((s) => s.error);
  const showToast = useUIStore((s) => s.showToast);

  const onLogin = async (p: 'google' | 'microsoft') => {
    const profile = await login(p);
    if (profile) showToast('ok', `Connected ${profile.email}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center drag-region">
      <div className="w-full max-w-2xl panel p-10 no-drag animate-fade-in">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="text-fg">
            <BrandLockupStacked className="h-20 w-auto" />
          </div>
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span className="px-2 h-[18px] inline-flex items-center bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.16em]">
              Local-only
            </span>
            <span className="font-mono text-[10px] text-fg-muted uppercase tracking-[0.16em]">
              v0.1.0
            </span>
          </div>
        </div>

        <p className="text-fg-muted mt-4 max-w-md text-[12px]">
          A command-center for your inbox. Run a sync, watch it analyze every sender by storage and
          pattern, then bulk-clean with confidence.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6 mb-6">
          <Feature icon={Activity} title="Multi-stage sync" desc="Live progress, log, stats" />
          <Feature icon={Shield} title="Zero backend" desc="Tokens encrypted on disk" />
          <Feature icon={Cpu} title="Non-blocking" desc="Background workers, undo" />
        </div>

        <div className="space-y-2">
          <div className="label-mono">Connect your first account</div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              size="lg"
              onClick={() => onLogin('google')}
              disabled={!!loginInProgress}
              iconLeft={<GoogleIcon size={14} />}
            >
              {loginInProgress === 'google' ? 'Authorizing…' : 'Connect Gmail'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              size="lg"
              onClick={() => onLogin('microsoft')}
              disabled={!!loginInProgress}
              iconLeft={<OutlookIcon size={14} />}
            >
              {loginInProgress === 'microsoft' ? 'Authorizing…' : 'Connect Outlook'}
            </Button>
          </div>
          {error && <p className="text-[10px] text-danger font-mono mt-2">{error}</p>}
          <p className="text-[10px] text-fg-subtle font-mono mt-3 uppercase tracking-widest">
            Requires OAuth client IDs in <span className="text-fg-muted">.env</span> · See README
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Activity;
  title: string;
  desc: string;
}) {
  return (
    <div className="panel-inset p-3">
      <Icon className="w-3.5 h-3.5 text-accent mb-2" />
      <div className="font-mono text-[11px] font-semibold tracking-[0.08em] mb-0.5">{title}</div>
      <div className="text-[10px] text-fg-muted leading-snug">{desc}</div>
    </div>
  );
}

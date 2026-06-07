import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  Briefcase,
  RefreshCw,
  Sparkles,
  Inbox,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { JobOfferScanResult } from '@shared/jobOfferDetection';
import { JOB_OFFERS_FOLDER } from '@shared/jobOfferDetection';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore } from '@/stores/foldersStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { formatNumber, relativeTime } from '@/lib/format';

export function JobOffersOrganizer() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const loadFolders = useFoldersStore((s) => s.load);
  const showToast = useUIStore((s) => s.showToast);
  const setRoute = useUIStore((s) => s.setRoute);

  const [scan, setScan] = useState<JobOfferScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const runScan = useCallback(async () => {
    if (!activeId) return;
    setLoading(true);
    try {
      const result = await window.mailvault.scanJobOffers(activeId);
      setScan(result);
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeId, showToast]);

  useEffect(() => {
    void runScan();
  }, [runScan]);

  const onOrganize = async () => {
    if (!activeId) return;
    setOrganizing(true);
    try {
      const result = await window.mailvault.organizeJobOffers(activeId);
      if (result.error) {
        showToast('err', result.error);
        return;
      }
      await loadFolders(activeId);
      await runScan();
      const parts = [
        `Moved ${formatNumber(result.moved)} email${result.moved === 1 ? '' : 's'}`,
        result.rulesCreated
          ? `created ${result.rulesCreated} routing rule${result.rulesCreated === 1 ? '' : 's'}`
          : null,
        result.failed ? `${result.failed} move failed` : null,
      ].filter(Boolean);
      showToast('ok', parts.join(' · '));
    } catch (e) {
      showToast('err', (e as Error).message);
    } finally {
      setOrganizing(false);
    }
  };

  if (!account) return null;

  const matches = scan?.matches ?? [];
  const visible = showAll ? matches : matches.slice(0, 8);
  const junkCount = scan?.byLocation.junk ?? 0;
  const inboxCount = scan?.byLocation.inbox ?? 0;

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Briefcase className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
              Job offers & recruiting
            </div>
            <p className="text-[12px] text-fg-muted mt-1 max-w-xl leading-relaxed">
              Scans sender, subject, and patterns for job alerts, recruiter outreach, and interview
              mail — including messages sitting in Junk from LinkedIn or direct emails.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<RefreshCw className={clsx('w-3 h-3', loading && 'animate-spin')} />}
            onClick={() => void runScan()}
            disabled={loading || organizing}
          >
            Scan
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Sparkles className="w-3 h-3" />}
            onClick={() => void onOrganize()}
            disabled={organizing || loading || !matches.length}
          >
            {organizing ? 'Organizing…' : 'Organize all'}
          </Button>
        </div>
      </div>

      {loading && !scan ? (
        <LoadingIndicator label="Scanning mailbox" variant="dots" className="py-4" />
      ) : scan?.needsSync ? (
        <div className="panel-inset p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-fg-muted">
            Run <span className="font-mono text-fg">Analyze</span> first so MailVault can scan your
            Inbox and Junk for job-related mail.
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRoute('analyze')}>
            Go to Analyze
          </Button>
        </div>
      ) : !matches.length ? (
        <div className="panel-inset p-4 text-[12px] text-fg-muted">
          No job-related emails found yet. After syncing, LinkedIn alerts, recruiter messages, and
          interview invites will appear here.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="panel-inset px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-fg-muted inline-flex items-center gap-1.5">
              <Inbox className="w-3 h-3" />
              {inboxCount} in Inbox
            </span>
            {junkCount > 0 && (
              <span className="panel-inset px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-warn inline-flex items-center gap-1.5 border-warn/20">
                <AlertTriangle className="w-3 h-3" />
                {junkCount} in Junk
              </span>
            )}
            <span className="panel-inset px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-fg-subtle">
              Folder: {JOB_OFFERS_FOLDER}
            </span>
          </div>

          {junkCount > 0 && (
            <p className="text-[11px] text-warn/90">
              {junkCount} job email{junkCount === 1 ? '' : 's'} found in Junk — Organize will rescue
              them, mark as not spam, move to “{JOB_OFFERS_FOLDER}”, and add routing rules.
            </p>
          )}

          <div className="panel-inset overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 border-b border-border-subtle text-left hover:bg-bg-hover/50"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="label-mono">
                {formatNumber(matches.length)} matched email{matches.length === 1 ? '' : 's'}
              </span>
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-fg-subtle" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-fg-subtle" />
              )}
            </button>

            {expanded && (
              <div className="divide-y divide-border-subtle max-h-[320px] overflow-y-auto">
                {visible.map((m) => (
                  <div key={m.id} className="px-3 py-2.5 text-[12px] animate-slide-up-in">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
                      <span className="font-medium text-fg truncate">
                        {m.subject || '(no subject)'}
                      </span>
                      <span className="text-[10px] font-mono text-fg-subtle shrink-0">
                        {relativeTime(m.receivedAt)}
                      </span>
                    </div>
                    <div className="text-[11px] text-fg-muted truncate">
                      {m.fromName ? `${m.fromName} · ` : ''}
                      {m.fromEmail}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {m.inJunk && (
                        <span className="text-[9px] font-mono uppercase tracking-widest text-warn">
                          Junk
                        </span>
                      )}
                      <span className="text-[9px] font-mono uppercase tracking-widest text-accent">
                        {Math.round(m.score * 100)}% match
                      </span>
                      {m.reasons[0] && (
                        <span className="text-[10px] text-fg-subtle truncate">{m.reasons[0]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {matches.length > 8 && expanded && (
              <button
                type="button"
                className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-fg-muted hover:text-accent hover:bg-bg-hover"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${matches.length}`}
              </button>
            )}
          </div>

          {(scan?.topDomains ?? []).length > 0 && (
            <div className="text-[10px] text-fg-subtle font-mono">
              Top sources:{' '}
              {(scan?.topDomains ?? []).map((d) => `${d.domain} (${d.count})`).join(' · ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

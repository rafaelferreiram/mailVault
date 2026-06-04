import { useEffect, useMemo, useState } from 'react';
import { TriangleAlert, CircleCheck } from 'lucide-react';
import clsx from 'clsx';
import { useLiveSyncStore } from '@/stores/liveSyncStore';
import { usePendingActions } from '@/hooks/useLiveSync';
import { usePrefsStore } from '@/stores/prefsStore';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { formatBytes } from '@/lib/format';

function confidenceDots(score: number) {
  const filled = Math.round(score * 5);
  return (
    <span className="inline-flex gap-0.5 text-[10px] font-mono text-fg-muted">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={clsx('w-1.5 h-1.5 rounded-full', i < filled ? 'bg-accent' : 'bg-border')} />
      ))}
      <span className="ml-1">{score >= 0.8 ? 'High confidence' : score >= 0.5 ? 'Medium confidence' : 'Low confidence'}</span>
    </span>
  );
}

export function ApprovalModal() {
  const open = useLiveSyncStore((s) => s.approvalOpen);
  const pendingId = useLiveSyncStore((s) => s.approvalPendingId);
  const setApprovalOpen = useLiveSyncStore((s) => s.setApprovalOpen);
  const resolvePending = useLiveSyncStore((s) => s.resolvePending);
  const pending = usePendingActions();
  const autoShow = usePrefsStore((s) => s.prefs.liveSync.notifications.autoShowModalOnFocus);
  const delay = usePrefsStore((s) => s.prefs.liveSync.notifications.autoShowModalDelay);
  const lastShown = useLiveSyncStore((s) => s.lastModalShownAt);

  const [index, setIndex] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);

  const queue = useMemo(
    () => pending.filter((p) => p.priority <= 2).sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt),
    [pending]
  );

  const current = pendingId
    ? pending.find((p) => p.id === pendingId) ?? queue[index]
    : queue[index];

  useEffect(() => {
    if (!open) setSuccess(null);
  }, [open]);

  // Auto-show on focus when priority-1 items exist
  useEffect(() => {
    if (!autoShow || open) return;
    const urgent = queue.filter((p) => p.priority === 1);
    if (urgent.length === 0) return;
    if (Date.now() - lastShown < 30 * 60_000) return;
    const t = setTimeout(() => {
      setApprovalOpen(true, urgent[0].id);
    }, delay);
    return () => clearTimeout(t);
  }, [autoShow, delay, queue, open, lastShown, setApprovalOpen]);

  if (!open || !current) return null;

  const isJunk = current.triggerType === 'junk_rescue';

  const act = async (resolution: 'approved' | 'rejected' | 'dismissed', msg: string) => {
    setSuccess(msg);
    await resolvePending(current.id, resolution);
    setTimeout(() => {
      setSuccess(null);
      if (index < queue.length - 1) setIndex((i) => i + 1);
      else setApprovalOpen(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setApprovalOpen(false)} />
      <div className="relative w-full max-w-[480px] bg-bg-elevated border border-border rounded-[10px] shadow-2xl animate-modal-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <Icon icon={TriangleAlert} size="md" className="text-warn" />
          <h2 className="text-[15px] font-medium text-fg flex-1">{current.actionLabel}</h2>
          <button type="button" onClick={() => setApprovalOpen(false)} className="text-fg-muted hover:text-fg">
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center gap-2 text-ok">
            <Icon icon={CircleCheck} size="lg" className="text-ok" />
            <p className="text-[13px]">{success}</p>
          </div>
        ) : (
          <>
            <div className="p-4 space-y-3">
              <div className="p-3 border border-border-subtle bg-bg-surface/30 rounded-md">
                <div className="flex gap-3">
                  <Avatar email={current.emailFrom} name={current.emailFromName} size={36} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-fg">{current.emailFromName}</div>
                    <div className="text-[11px] font-mono text-fg-muted">{current.emailFrom}</div>
                    <div className="text-[12px] text-fg mt-1 truncate">{current.emailSubject}</div>
                    <div className="text-[10px] text-fg-subtle mt-1">
                      Folder: {current.emailFolder} · {formatBytes(0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border border-border-subtle rounded-md text-[12px] text-fg-muted leading-relaxed">
                {current.explanation || 'This item needs your decision before MailVault can act.'}
                <div className="mt-2">{confidenceDots(current.confidence)}</div>
              </div>

              <div className="p-3 border border-accent/30 bg-accent/5 rounded-md">
                <div className="text-[10px] font-mono uppercase text-accent tracking-wider">Suggested</div>
                <div className="text-[13px] text-fg mt-1">{current.actionLabel}</div>
              </div>
            </div>

            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {isJunk ? (
                <>
                  <Button variant="primary" onClick={() => void act('approved', 'Done — moved to Inbox')}>
                    Move to Inbox + Create Rule
                  </Button>
                  <Button variant="secondary" onClick={() => void act('approved', 'Moved to Inbox')}>
                    Move to Inbox only
                  </Button>
                  <Button variant="ghost" onClick={() => void act('dismissed', 'Kept in Junk')}>
                    Keep in Junk
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="danger" onClick={() => void act('approved', 'Sender blocked')}>
                    Block & Delete
                  </Button>
                  <Button variant="secondary" onClick={() => void act('dismissed', 'Ignored')}>
                    Ignore for now
                  </Button>
                </>
              )}
            </div>

            {queue.length > 1 && (
              <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-fg-muted border-t border-border-subtle pt-2">
                <span>
                  {index + 1} of {queue.length} pending approvals
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="text-accent disabled:opacity-30">
                    ← Prev
                  </button>
                  <button
                    type="button"
                    disabled={index >= queue.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                    className="text-accent disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

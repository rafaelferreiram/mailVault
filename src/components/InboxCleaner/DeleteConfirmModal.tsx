import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Trash2, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useSyncStore } from '@/stores/syncStore';
import { useAccountsStore } from '@/stores/accountsStore';
import { groupBySender } from '@/lib/grouping';
import { formatBytes, formatNumber } from '@/lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { Avatar } from '../ui/Avatar';
import type { DeleteProgress } from '@shared/types';

export function DeleteConfirmModal() {
  const open = useUIStore((s) => s.reviewOpen);
  const setOpen = useUIStore((s) => s.setReviewOpen);
  const selected = useUIStore((s) => s.selectedSenders);
  const showToast = useUIStore((s) => s.showToast);
  const setPendingUndo = useUIStore((s) => s.setPendingUndo);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const activeId = useAccountsStore((s) => s.activeId);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const removeMessages = useSyncStore((s) => s.removeMessages);

  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DeleteProgress | null>(null);
  const [doneSummary, setDoneSummary] = useState<{ deleted: number; failed: number } | null>(null);
  const [deletionMode, setDeletionMode] = useState<'trash' | 'permanent'>('trash');

  useEffect(() => {
    if (!open) {
      setApprovals({});
      setReviewed(new Set());
      setRunning(false);
      setProgress(null);
      setDoneSummary(null);
    } else {
      const init: Record<string, boolean> = {};
      selected.forEach((email) => (init[email] = true));
      setApprovals(init);
      setReviewed(new Set());
      void window.mailvault.getSettings().then((s) => setDeletionMode(s.deletionMode));
    }
  }, [open, selected]);

  useEffect(() => {
    const off = window.mailvault.onDeleteProgress((p) => {
      if (p.accountId !== activeId) return;
      setProgress(p);
      if (p.done) {
        setDoneSummary({ deleted: p.deleted, failed: p.failed });
        setRunning(false);
      }
    });
    return off;
  }, [activeId]);

  const groups = useMemo(() => {
    if (!sync) return [];
    const allGroups = groupBySender(sync.messages);
    return allGroups.filter((g) => selected.has(g.email));
  }, [sync, selected]);

  const totalCount = groups.reduce((s, g) => (approvals[g.email] !== false ? s + g.count : s), 0);
  const totalBytes = groups.reduce((s, g) => (approvals[g.email] !== false ? s + g.totalBytes : s), 0);
  const allReviewed = groups.every((g) => reviewed.has(g.email));

  const onConfirm = async () => {
    if (!activeId) return;
    const approvedGroups = groups.filter((g) => approvals[g.email] !== false);
    const messages = approvedGroups.flatMap((g) =>
      g.messageIds.map((id) => ({ id, senderEmail: g.email }))
    );
    if (!messages.length) {
      showToast('err', 'Nothing approved for deletion.');
      return;
    }
    setRunning(true);
    setProgress({
      accountId: activeId,
      deleted: 0,
      failed: 0,
      total: messages.length,
      perSender: {},
      done: false,
    });

    try {
      const result = await window.mailvault.deleteEmails(activeId, {
        messages,
        mode: deletionMode,
      });
      // Optimistically remove from store.
      removeMessages(activeId, new Set(messages.map((m) => m.id)));

      // Register undo (only if Trash mode and Gmail/Graph supports restore for those ids).
      if (deletionMode === 'trash' && result.undoableIds.length > 0) {
        const senders = approvedGroups.length;
        setPendingUndo({
          id: `undo-${Date.now()}`,
          accountId: activeId,
          count: result.deleted,
          messageIds: result.undoableIds,
          expiresAt: Date.now() + 30_000,
          summary: `${senders} sender${senders === 1 ? '' : 's'} · ${formatBytes(totalBytes)}`,
        });
      } else {
        showToast(
          result.failed > 0 ? 'err' : 'ok',
          `Deleted ${result.deleted}${result.failed > 0 ? ` · ${result.failed} failed` : ''}`
        );
      }
      clearSelection();
      // Auto-close on success.
      setTimeout(() => setOpen(false), 600);
    } catch (e) {
      showToast('err', `Deletion failed: ${(e as Error).message}`);
      setRunning(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !running && setOpen(false)}
      title={running ? 'Deleting…' : doneSummary ? 'Done' : 'Review & Delete'}
      width="max-w-3xl"
      footer={
        running ? null : doneSummary ? (
          <Button variant="primary" onClick={() => setOpen(false)}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <div className="flex items-stretch border border-border bg-bg-elevated h-7 mr-2">
              <button
                onClick={() => setDeletionMode('trash')}
                className={`px-2.5 text-[10px] font-mono uppercase tracking-widest ${
                  deletionMode === 'trash' ? 'bg-accent/10 text-accent' : 'text-fg-muted hover:text-fg'
                }`}
              >
                Trash
              </button>
              <button
                onClick={() => setDeletionMode('permanent')}
                className={`px-2.5 text-[10px] font-mono uppercase tracking-widest border-l border-border-subtle ${
                  deletionMode === 'permanent' ? 'bg-danger/10 text-danger' : 'text-fg-muted hover:text-fg'
                }`}
              >
                Permanent
              </button>
            </div>
            <Button
              variant="danger"
              iconLeft={<Trash2 className="w-3 h-3" />}
              onClick={onConfirm}
              disabled={!allReviewed || totalCount === 0}
            >
              {allReviewed
                ? `Confirm · ${formatNumber(totalCount)}`
                : `Review all ${groups.length} senders`}
            </Button>
          </>
        )
      }
    >
      <div className="px-4 py-3 space-y-3">
        {/* Summary */}
        <div className="panel-inset p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <div className="flex-1 text-[12px] text-fg leading-relaxed">
              You are about to{' '}
              {deletionMode === 'permanent' ? (
                <span className="text-danger font-mono font-semibold">PERMANENTLY DELETE</span>
              ) : (
                <>
                  move to <span className="text-accent font-mono">TRASH</span>
                </>
              )}{' '}
              <span className="font-mono text-accent font-semibold">{formatNumber(totalCount)}</span>{' '}
              emails from{' '}
              <span className="font-mono text-accent font-semibold">
                {groups.filter((g) => approvals[g.email] !== false).length}
              </span>{' '}
              senders, freeing approximately{' '}
              <span className="font-mono text-accent font-semibold">{formatBytes(totalBytes)}</span>.
              {deletionMode === 'trash' && (
                <span className="ml-2 text-[10px] font-mono text-fg-subtle uppercase tracking-widest">
                  · 30s undo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        {(running || doneSummary) && progress && (
          <ProgressBar
            value={progress.total ? (progress.deleted + progress.failed) / progress.total : 0}
            label={`Deleted ${progress.deleted}/${progress.total}${progress.failed ? ` · ${progress.failed} failed` : ''}`}
            variant={progress.failed > 0 ? 'danger' : 'accent'}
          />
        )}

        {/* Per-sender list */}
        <div className="space-y-1.5">
          {groups.map((g) => {
            const ok = approvals[g.email] !== false;
            const r = reviewed.has(g.email);
            const senderProgress = progress?.perSender[g.email];
            return (
              <div
                key={g.email}
                className={`panel-inset p-2.5 transition-colors ${r ? 'border-accent/30' : ''} ${!ok ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar email={g.email} name={g.name} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{g.name}</div>
                    <div className="text-[10px] font-mono text-fg-subtle truncate">{g.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[12px] tabular-nums">
                      {formatNumber(g.count)} · {formatBytes(g.totalBytes)}
                    </div>
                    {senderProgress && (
                      <div className="text-[10px] font-mono text-fg-subtle">
                        {senderProgress.ok} ok{senderProgress.fail ? ` · ${senderProgress.fail} fail` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setApprovals({ ...approvals, [g.email]: true });
                        setReviewed(new Set([...reviewed, g.email]));
                      }}
                      disabled={running}
                      className={`p-1 transition-colors ${
                        ok ? 'text-ok bg-ok/10 border border-ok/40' : 'text-fg-subtle hover:text-ok hover:bg-ok/10 border border-transparent'
                      }`}
                      title="Approve"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setApprovals({ ...approvals, [g.email]: false });
                        setReviewed(new Set([...reviewed, g.email]));
                      }}
                      disabled={running}
                      className={`p-1 transition-colors ${
                        !ok ? 'text-danger bg-danger/10 border border-danger/40' : 'text-fg-subtle hover:text-danger hover:bg-danger/10 border border-transparent'
                      }`}
                      title="Skip"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {g.sampleSubjects.length > 0 && (
                  <div className="mt-1.5 pl-9 space-y-0.5">
                    {g.sampleSubjects.slice(0, 3).map((s, i) => (
                      <div key={i} className="text-[10px] font-mono text-fg-subtle truncate">
                        — {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

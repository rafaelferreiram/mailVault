import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, X, Loader2, Info } from 'lucide-react';
import type { Suggestion } from '@shared/types';
import { useSuggestionsStore } from '@/stores/suggestionsStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { formatBytes } from '@/lib/format';

interface Props {
  suggestion: Suggestion;
  accountId: string;
  /**
   * Visual layout:
   * - `row`  — original inline list row (kept for backward compat)
   * - `card` — square-ish card with stats + actions, used in the grid view
   * - `hero` — large featured card used in the "Top picks" strip
   */
  variant?: 'row' | 'card' | 'hero';
}

const PRIORITY_BADGE: Record<1 | 2 | 3 | 4 | 5, { label: string; cls: string }> = {
  1: { label: 'P1', cls: 'bg-danger/15 border-danger/30 text-danger' },
  2: { label: 'P2', cls: 'bg-warn/15 border-warn/30 text-warn' },
  3: { label: 'P3', cls: 'bg-accent/15 border-accent/30 text-accent' },
  4: { label: 'P4', cls: 'bg-bg-hover border-border text-fg-muted' },
  5: { label: 'P5', cls: 'bg-bg-hover border-border text-fg-muted' },
};

export function SuggestionItem({ suggestion: s, accountId, variant = 'row' }: Props) {
  const applying = useSuggestionsStore((st) => st.applying.has(s.id));
  const apply = useSuggestionsStore((st) => st.applySuggestion);
  const dismiss = useSuggestionsStore((st) => st.dismissSuggestion);
  const undismiss = useSuggestionsStore((st) => st.undismissSuggestion);
  const showToast = useUIStore((st) => st.showToast);
  const setPendingUndo = useUIStore((st) => st.setPendingUndo);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isApplied = s.appliedAt !== null;
  const isDismissed = s.dismissedAt !== null;
  const badge = PRIORITY_BADGE[s.priority];
  const isDestructive = s.actionType === 'delete' || s.actionType === 'block';

  const confidenceLabel = useMemo(() => {
    if (s.confidence >= 0.9) return 'High confidence';
    if (s.confidence >= 0.7) return 'Likely safe';
    return 'Review first';
  }, [s.confidence]);

  const onConfirmApply = async () => {
    setConfirmOpen(false);
    const result = await apply(accountId, s.id);
    if (!result.ok) {
      showToast('err', `Couldn't apply: ${result.error ?? 'unknown error'}`);
      return;
    }
    if (isDestructive && result.undoableIds && result.undoableIds.length > 0) {
      setPendingUndo({
        id: `undo-sug-${s.id}`,
        accountId,
        count: result.affected,
        messageIds: result.undoableIds,
        expiresAt: Date.now() + 30_000,
        summary: `${s.title}`,
      });
    } else {
      showToast(
        'ok',
        result.affected > 0
          ? `Done · ${result.affected.toLocaleString()} email${result.affected === 1 ? '' : 's'} affected`
          : 'Done.'
      );
    }
  };

  const onApplyClick = () => {
    if (isDestructive) setConfirmOpen(true);
    else void onConfirmApply();
  };

  const ActionButtons = (
    <>
      {!isApplied && !isDismissed && (
        <>
          <Button
            size="xs"
            variant="primary"
            onClick={onApplyClick}
            disabled={applying}
            iconLeft={applying ? <Loader2 className="w-3 h-3 animate-spin" /> : undefined}
          >
            {applying ? 'Working…' : s.actionLabel}
          </Button>
          <button
            onClick={() => void dismiss(accountId, s.id)}
            className="p-1 text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {isDismissed && (
        <Button
          size="xs"
          variant="secondary"
          iconLeft={<RotateCcw className="w-3 h-3" />}
          onClick={() => void undismiss(accountId, s.id)}
        >
          Restore
        </Button>
      )}
    </>
  );

  const ConfirmInline = confirmOpen && (
    <div className="mt-2.5 panel p-2.5 border-danger/30 bg-danger/5">
      <div className="text-xs text-fg">
        {s.actionType === 'block'
          ? `Block this sender and delete ${s.affectedCount.toLocaleString()} emails?`
          : `Delete ${s.affectedCount.toLocaleString()} emails? They move to Trash and can be undone for 30 seconds.`}
      </div>
      <div className="flex gap-1.5 mt-2">
        <Button size="xs" variant="primary" onClick={onConfirmApply}>
          Confirm
        </Button>
        <Button size="xs" variant="secondary" onClick={() => setConfirmOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );

  // ─── Hero variant — used in the "Top picks" strip ──────────────────
  if (variant === 'hero') {
    return (
      <div className="panel p-4 flex flex-col gap-3 border-accent/30 bg-bg-elevated">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 h-[18px] inline-flex items-center text-[10px] uppercase font-mono tracking-[0.12em] border ${badge.cls}`}
          >
            {badge.label}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted font-mono">
            {s.groupType}
          </span>
          {isApplied && <CheckCircle2 className="w-3.5 h-3.5 text-ok ml-auto" />}
        </div>
        <div>
          <div
            className={`text-sm font-medium leading-snug line-clamp-2 ${
              isApplied ? 'opacity-60 line-through' : ''
            }`}
          >
            {s.title}
          </div>
          <p className="text-xs text-fg-muted mt-1.5 line-clamp-2">{s.description}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-fg-muted font-mono mt-auto">
          <span>{s.affectedCount.toLocaleString()} emails</span>
          <span className="text-fg-subtle">·</span>
          <span>{formatBytes(s.sizeBytes)}</span>
          <span className="text-fg-subtle">·</span>
          <span title={`${(s.confidence * 100).toFixed(0)}% confidence`}>{confidenceLabel}</span>
        </div>
        {ConfirmInline}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border-subtle">
          {ActionButtons}
        </div>
      </div>
    );
  }

  // ─── Card variant — used in the paginated grid ─────────────────────
  if (variant === 'card') {
    return (
      <div className="panel p-3 flex flex-col gap-2 hover:border-border-strong transition-colors">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 h-[18px] inline-flex items-center text-[10px] uppercase font-mono tracking-[0.12em] border shrink-0 ${badge.cls}`}
          >
            {badge.label}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted font-mono truncate">
            {s.groupType}
          </span>
          {isApplied && <CheckCircle2 className="w-3 h-3 text-ok ml-auto shrink-0" />}
        </div>
        <div
          className={`text-[13px] font-medium leading-snug line-clamp-2 ${
            isApplied ? 'opacity-60 line-through' : ''
          }`}
          title={s.title}
        >
          {s.title}
        </div>
        <p className="text-[11px] text-fg-muted line-clamp-2" title={s.description}>
          {s.description}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-fg-muted font-mono">
          <span>{s.affectedCount.toLocaleString()}</span>
          <span className="text-fg-subtle">·</span>
          <span>{formatBytes(s.sizeBytes)}</span>
          <span
            className="ml-auto inline-flex items-center gap-1"
            title={`${(s.confidence * 100).toFixed(0)}% confidence`}
          >
            <Info className="w-3 h-3" />
            {Math.round(s.confidence * 100)}%
          </span>
        </div>
        {ConfirmInline}
        <div className="flex items-center gap-1.5 pt-2 border-t border-border-subtle mt-auto">
          {ActionButtons}
        </div>
      </div>
    );
  }

  // ─── Row variant (default — kept for any legacy use) ───────────────
  return (
    <div className="p-3.5 hover:bg-bg-hover transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`px-1.5 h-[18px] inline-flex items-center text-[10px] uppercase font-mono tracking-[0.12em] border shrink-0 mt-0.5 ${badge.cls}`}
        >
          {badge.label}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`text-sm font-medium truncate ${
                isApplied ? 'opacity-60 line-through' : ''
              }`}
            >
              {s.title}
            </div>
            {isApplied && <CheckCircle2 className="w-3.5 h-3.5 text-ok" />}
          </div>
          <p className="text-xs text-fg-muted mt-1 line-clamp-2">{s.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-fg-muted mt-1.5 font-mono">
            <span>{s.affectedCount.toLocaleString()} emails</span>
            <span>·</span>
            <span>{formatBytes(s.sizeBytes)}</span>
            <span>·</span>
            <span title={`${(s.confidence * 100).toFixed(0)}% confidence`}>{confidenceLabel}</span>
          </div>
          {ConfirmInline}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">{ActionButtons}</div>
      </div>
    </div>
  );
}

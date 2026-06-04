import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { suggestRules as suggestRulesType } from '@/lib/grouping';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAccountsStore } from '@/stores/accountsStore';
import { useRulesStore } from '@/stores/rulesStore';
import { useUIStore } from '@/stores/uiStore';

interface Props {
  suggestions: ReturnType<typeof suggestRulesType>;
}

export function RuleSuggestions({ suggestions }: Props) {
  const activeId = useAccountsStore((s) => s.activeId);
  const create = useRulesStore((s) => s.create);
  const showToast = useUIStore((s) => s.showToast);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const apply = async (s: Props['suggestions'][number]) => {
    if (!activeId) return;
    setBusy(s.group.email);
    const result = await create(activeId, {
      id: `suggested-${s.group.email}-${Date.now()}`,
      source: 'local',
      name: `Auto: ${s.group.email}`,
      fromContains: s.rule.fromContains,
      archive: s.rule.archive,
      delete: s.rule.delete,
      markRead: s.rule.markRead,
      addLabel: s.rule.addLabel,
      enabled: true,
      createdAt: Date.now(),
    });
    setBusy(null);
    if (result) {
      setApplied((p) => new Set([...p, s.group.email]));
      showToast('ok', `Rule applied for ${s.group.email}`);
    } else {
      showToast('err', `Failed to create rule`);
    }
  };

  return (
    <div className="space-y-1.5">
      {suggestions.map((s) => {
        const done = applied.has(s.group.email);
        return (
          <div
            key={s.group.email}
            className={`panel-inset px-3 py-2 flex items-center gap-3 transition-colors ${
              done ? 'border-ok/30 bg-ok/[0.03]' : ''
            }`}
          >
            <Avatar email={s.group.email} name={s.group.name} size={24} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate">{s.group.name}</div>
              <div className="text-[10px] font-mono text-fg-subtle truncate">{s.group.email}</div>
              <div className="text-[11px] text-fg-muted mt-0.5">{s.reason}</div>
            </div>
            <div className="font-mono text-[10px] text-warn uppercase tracking-widest mr-2">
              {[s.rule.archive && 'archive', s.rule.markRead && 'mark read', s.rule.delete && 'delete']
                .filter(Boolean)
                .join(' · ')}
            </div>
            {done ? (
              <Button variant="ghost" size="xs" iconLeft={<Check className="w-3 h-3" />} disabled>
                Applied
              </Button>
            ) : (
              <Button
                variant="primary"
                size="xs"
                iconLeft={<Plus className="w-3 h-3" />}
                onClick={() => void apply(s)}
                disabled={busy === s.group.email}
              >
                {busy === s.group.email ? 'Applying…' : 'Apply'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

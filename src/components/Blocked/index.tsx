import { useEffect, useState } from 'react';
import { ShieldOff, Trash2, RefreshCw } from 'lucide-react';
import type { BlockedSender } from '@shared/types';
import { useAccountsStore } from '@/stores/accountsStore';
import { useBlockedStore } from '@/stores/blockedStore';
import { useUIStore } from '@/stores/uiStore';

// Stable reference shared across renders. Returning a fresh `[]` from a
// Zustand selector makes `useSyncExternalStore` think the snapshot changed
// every render, which triggers a render loop ("Maximum update depth").
const EMPTY_BLOCKED: BlockedSender[] = [];
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { relativeTime } from '@/lib/format';
import { Checkbox } from '../ui/Checkbox';

export function Blocked() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const list =
    useBlockedStore((s) => (activeId ? s.byAccount[activeId] : undefined)) ??
    EMPTY_BLOCKED;
  const loading = useBlockedStore((s) => s.loading);
  const load = useBlockedStore((s) => s.load);
  const unblock = useBlockedStore((s) => s.unblock);
  const showToast = useUIStore((s) => s.showToast);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeId) void load(activeId);
  }, [activeId, load]);

  if (!account) return null;

  const toggle = (email: string) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setSelected(next);
  };

  const onBulkUnblock = async () => {
    if (!activeId) return;
    if (!confirm(`Unblock ${selected.size} sender${selected.size === 1 ? '' : 's'}?`)) return;
    let ok = 0;
    for (const email of selected) {
      const r = await unblock(activeId, email);
      if (r) ok++;
    }
    setSelected(new Set());
    showToast('ok', `Unblocked ${ok} sender${ok === 1 ? '' : 's'}`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Blocked Senders"
        subtitle={`${list.length} sender${list.length === 1 ? '' : 's'} blocked on ${account.email}`}
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => activeId && void load(activeId)}
              disabled={loading}
            >
              Refresh
            </Button>
            {selected.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                iconLeft={<ShieldOff className="w-3 h-3" />}
                onClick={onBulkUnblock}
              >
                Unblock {selected.size}
              </Button>
            )}
          </>
        }
      />

      <div className="page-content space-y-4">
        {loading && list.length === 0 ? (
          <div className="space-y-px">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : list.length === 0 ? (
          <div className="panel p-10 text-center">
            <ShieldOff className="w-6 h-6 text-fg-subtle mx-auto mb-3" />
            <div className="font-mono text-[12px] text-fg-muted">No blocked senders yet</div>
            <div className="text-[10px] font-mono text-fg-subtle uppercase tracking-widest mt-1">
              Block any sender from the Senders view via the shield icon
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="grid grid-cols-12 px-3 h-7 border-b border-border label-mono items-center">
              <div className="col-span-1" />
              <div className="col-span-6">Sender</div>
              <div className="col-span-3">Blocked</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <div className="zebra">
              {list.map((b) => (
                <div
                  key={b.email}
                  className={`grid grid-cols-12 px-3 grid-row items-center gap-2 text-[12px] ${
                    selected.has(b.email) ? 'bg-accent/[0.06]' : ''
                  }`}
                >
                  <div className="col-span-1">
                    <Checkbox
                      checked={selected.has(b.email)}
                      onChange={() => toggle(b.email)}
                      size="sm"
                    />
                  </div>
                  <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                    <Avatar email={b.email} name={b.name} size={20} />
                    <div className="min-w-0">
                      <div className="truncate">{b.name || b.email}</div>
                      <div className="text-[10px] font-mono text-fg-subtle truncate">
                        {b.email}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-3 text-[10px] font-mono uppercase tracking-widest text-fg-muted">
                    {relativeTime(b.blockedAt)}
                    {b.deletedHistorical ? ' · history removed' : ''}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={async () => {
                        if (!activeId) return;
                        const ok = await unblock(activeId, b.email);
                        showToast(ok ? 'ok' : 'err', ok ? `Unblocked ${b.email}` : 'Failed');
                      }}
                      className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Unblock"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

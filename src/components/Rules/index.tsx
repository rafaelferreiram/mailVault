import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Trash2, Power, RefreshCw, Filter } from 'lucide-react';
import { useAccountsStore } from '@/stores/accountsStore';
import { useRulesStore } from '@/stores/rulesStore';
import { useSyncStore } from '@/stores/syncStore';
import { useUIStore } from '@/stores/uiStore';
import { suggestRules } from '@/lib/grouping';
import { resolveSenderGroups } from '@/lib/senderGroups';
import { PageHeader } from '../PageHeader';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { RuleBuilder } from './RuleBuilder';
import { RuleSuggestions } from './RuleSuggestions';
import { CreateFolderRuleModal } from '../Folders/CreateFolderRuleModal';
import type { MailRule } from '@shared/types';
import { relativeTime } from '@/lib/format';

export function Rules() {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const state = useRulesStore((s) => (activeId ? s.byAccount[activeId] : null));
  const load = useRulesStore((s) => s.load);
  const update = useRulesStore((s) => s.update);
  const remove = useRulesStore((s) => s.remove);
  const sync = useSyncStore((s) => (activeId ? s.byAccount[activeId] : null));
  const showToast = useUIStore((s) => s.showToast);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [folderRuleOpen, setFolderRuleOpen] = useState(false);
  const [editing, setEditing] = useState<MailRule | null>(null);

  useEffect(() => {
    if (activeId) void load(activeId);
  }, [activeId, load]);

  const suggestions = useMemo(() => {
    if (!sync) return [];
    return suggestRules(resolveSenderGroups(sync.senderGroups, sync.messages));
  }, [sync]);

  if (!account) return null;

  const rules = state?.rules ?? [];
  const loading = state?.loading;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Rules"
        subtitle={`${rules.length} active filter${rules.length === 1 ? '' : 's'} on ${account.email}`}
        badge={account.provider === 'google' ? 'GMAIL' : 'OUTLOOK'}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              onClick={() => activeId && void load(activeId)}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Filter className="w-3.5 h-3.5" />}
              onClick={() => setFolderRuleOpen(true)}
            >
              Folder + rule
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditing(null);
                setBuilderOpen(true);
              }}
            >
              New rule
            </Button>
          </>
        }
      />

      <div className="page-content space-y-5">
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-warn" />
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg">
                  Suggested Rules
                </div>
                <div className="text-[11px] text-fg-subtle">
                  Heuristics over your top senders
                </div>
              </div>
            </div>
            <RuleSuggestions suggestions={suggestions} />
          </div>
        )}

        {/* Existing rules */}
        <div className="panel">
          <div className="px-3 h-7 border-b border-border label-mono flex items-center">
            Active rules
          </div>
          {loading && rules.length === 0 ? (
            <div className="space-y-px p-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : rules.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-fg-subtle font-mono text-[10px] uppercase tracking-widest">
              No rules yet
            </div>
          ) : (
            <div className="zebra">
              <div className="rules-table-header grid grid-cols-12 px-3 h-7 panel-inset items-center gap-3 label-mono border-b border-border-subtle">
                <div className="col-span-1" />
                <div className="col-span-7">Rule</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {rules.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditing(r);
                    setBuilderOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditing(r);
                      setBuilderOpen(true);
                    }
                  }}
                  className="rules-table-row grid grid-cols-12 px-3 grid-row items-center gap-3 text-[12px] cursor-pointer hover:bg-bg-hover/60 focus:outline-none focus:bg-bg-hover"
                  title="Edit rule"
                >
                  <div className="col-span-1">
                    <div className={`w-1 h-5 ${r.enabled ? 'bg-accent' : 'bg-fg-subtle'}`} />
                  </div>
                  <div className="col-span-7 min-w-0">
                    <div className="font-medium truncate">{r.name || describeRule(r)}</div>
                    <div className="text-[10px] font-mono text-fg-subtle truncate">
                      {describeRule(r)}
                    </div>
                  </div>
                  <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-fg-muted">
                    {r.source === 'remote' ? 'Provider' : `Local · ${relativeTime(r.createdAt)}`}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-0.5 rules-table-row__actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeId) void update(activeId, { ...r, enabled: !r.enabled });
                      }}
                      className={`p-1 transition-colors ${
                        r.enabled
                          ? 'text-accent hover:bg-accent/10'
                          : 'text-fg-subtle hover:text-fg hover:bg-bg-hover'
                      }`}
                      title={r.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!activeId) return;
                        if (!confirm(`Delete this rule?`)) return;
                        const ok = await remove(activeId, r);
                        showToast(ok ? 'ok' : 'err', ok ? 'Rule deleted' : 'Failed to delete');
                      }}
                      className="p-1 text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RuleBuilder
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          // Clear edit context so the next "New rule" starts blank.
          setEditing(null);
        }}
        existing={editing}
      />
      <CreateFolderRuleModal open={folderRuleOpen} onClose={() => setFolderRuleOpen(false)} />
    </div>
  );
}

function describeRule(r: MailRule): string {
  const conds: string[] = [];
  if (r.senderContains) conds.push(`from contains "${r.senderContains}"`);
  if (r.fromContains) conds.push(`from contains "${r.fromContains}"`);
  if (r.subjectContains) conds.push(`subject contains "${r.subjectContains}"`);
  if (r.bodyContains) conds.push(`body contains "${r.bodyContains}"`);
  if (r.hasAttachment) conds.push('has attachment');
  const acts: string[] = [];
  if (r.moveToFolderId) acts.push('move to folder');
  if (r.delete) acts.push('delete');
  if (r.archive) acts.push('archive');
  if (r.markRead) acts.push('mark read');
  if (r.addLabel) acts.push(`label "${r.addLabel}"`);
  if (r.forwardTo) acts.push(`forward → ${r.forwardTo}`);
  return `IF ${conds.join(' AND ') || 'any'} THEN ${acts.join(', ') || '—'}`;
}

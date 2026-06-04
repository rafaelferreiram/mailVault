import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { useAccountsStore } from '@/stores/accountsStore';
import { useRulesStore } from '@/stores/rulesStore';
import { useUIStore } from '@/stores/uiStore';
import type { MailRule } from '@shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: MailRule | null;
  prefill?: Partial<MailRule>;
}

export function RuleBuilder({ open, onClose, existing, prefill }: Props) {
  const activeId = useAccountsStore((s) => s.activeId);
  const create = useRulesStore((s) => s.create);
  const update = useRulesStore((s) => s.update);
  const showToast = useUIStore((s) => s.showToast);

  const [rule, setRule] = useState<MailRule>(emptyRule());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setRule(existing ? { ...existing } : { ...emptyRule(), ...prefill });
    }
  }, [open, existing, prefill]);

  const set = <K extends keyof MailRule>(k: K, v: MailRule[K]) =>
    setRule((r) => ({ ...r, [k]: v }));

  const onSave = async () => {
    if (!activeId) return;
    if (!rule.fromContains && !rule.subjectContains && !rule.bodyContains && !rule.hasAttachment) {
      showToast('err', 'Add at least one condition');
      return;
    }
    if (!rule.delete && !rule.archive && !rule.markRead && !rule.addLabel && !rule.forwardTo) {
      showToast('err', 'Add at least one action');
      return;
    }
    setBusy(true);
    const result = existing ? await update(activeId, rule) : await create(activeId, rule);
    setBusy(false);
    if (result) {
      showToast('ok', existing ? 'Rule updated' : 'Rule created');
      onClose();
    } else {
      showToast('err', useRulesStore.getState().byAccount[activeId]?.error ?? 'Failed');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit rule' : 'New rule'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : existing ? 'Update rule' : 'Create rule'}
          </Button>
        </>
      }
    >
      <div className="px-5 py-4 space-y-5">
        <div>
          <label className="label-mono block mb-1.5">Name (optional)</label>
          <input
            value={rule.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Newsletters → Archive"
            className="input"
          />
        </div>

        <div className="space-y-3">
          <div className="label-mono">If a message matches</div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="From"
              placeholder="sender@domain.com or @domain.com"
              value={rule.fromContains}
              onChange={(v) => set('fromContains', v || undefined)}
            />
            <Field
              label="Subject contains"
              placeholder="newsletter, receipt…"
              value={rule.subjectContains}
              onChange={(v) => set('subjectContains', v || undefined)}
            />
            <Field
              label="Body contains"
              placeholder="text in body"
              value={rule.bodyContains}
              onChange={(v) => set('bodyContains', v || undefined)}
            />
            <div className="flex items-end pb-1">
              <Checkbox
                checked={!!rule.hasAttachment}
                onChange={() => set('hasAttachment', !rule.hasAttachment)}
                label="Has attachment"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="label-mono">Then do</div>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              label="Move to Trash"
              danger
              value={!!rule.delete}
              onChange={() => set('delete', !rule.delete)}
            />
            <Toggle
              label="Archive (skip Inbox)"
              value={!!rule.archive}
              onChange={() => set('archive', !rule.archive)}
            />
            <Toggle
              label="Mark as read"
              value={!!rule.markRead}
              onChange={() => set('markRead', !rule.markRead)}
            />
            <Field
              label="Apply label / category"
              placeholder="Newsletters"
              value={rule.addLabel}
              onChange={(v) => set('addLabel', v || undefined)}
            />
            <Field
              label="Forward to"
              placeholder="someone@domain.com"
              value={rule.forwardTo}
              onChange={(v) => set('forwardTo', v || undefined)}
              full
            />
          </div>
        </div>

        <Checkbox
          checked={rule.enabled}
          onChange={() => set('enabled', !rule.enabled)}
          label="Rule enabled"
        />
      </div>
    </Modal>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  full,
}: {
  label: string;
  placeholder?: string;
  value: string | undefined;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="label-mono block mb-1.5">{label}</label>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  danger,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      className={`panel-inset p-3 text-left flex items-center justify-between transition-colors ${
        value
          ? danger
            ? 'border-danger/40 bg-danger/5'
            : 'border-accent/40 bg-accent/5'
          : 'hover:border-border-strong'
      }`}
    >
      <span className={`text-sm ${value ? (danger ? 'text-danger' : 'text-accent') : 'text-fg'}`}>
        {label}
      </span>
      <div
        className={`w-8 h-4 rounded-full relative transition-colors ${
          value ? (danger ? 'bg-danger/40' : 'bg-accent/40') : 'bg-border'
        }`}
      >
        <div
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform ${
            value ? (danger ? 'translate-x-4 bg-danger' : 'translate-x-4 bg-accent') : 'translate-x-0.5 bg-fg-subtle'
          }`}
        />
      </div>
    </button>
  );
}

function emptyRule(): MailRule {
  return {
    id: `local-${Date.now()}`,
    source: 'local',
    enabled: true,
    createdAt: Date.now(),
  };
}

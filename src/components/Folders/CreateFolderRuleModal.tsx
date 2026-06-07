import { useEffect, useMemo, useState } from 'react';
import { FolderInput, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { useAccountsStore } from '@/stores/accountsStore';
import { useFoldersStore, COLOR_PALETTE } from '@/stores/foldersStore';
import { useRulesStore } from '@/stores/rulesStore';
import { useUIStore } from '@/stores/uiStore';
import {
  buildFolderRoutingRule,
  describeSenderMatch,
  normalizeSenderMatch,
} from '@/lib/folderRules';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-fill sender match (e.g. from suggestions). */
  initialSender?: string;
  /** Pre-fill folder name. */
  initialFolderName?: string;
}

export function CreateFolderRuleModal({
  open,
  onClose,
  initialSender = '',
  initialFolderName = '',
}: Props) {
  const activeId = useAccountsStore((s) => s.activeId);
  const account = useAccountsStore((s) => s.accounts.find((a) => a.id === s.activeId));
  const createFolder = useFoldersStore((s) => s.create);
  const setColor = useFoldersStore((s) => s.setColor);
  const createRule = useRulesStore((s) => s.create);
  const showToast = useUIStore((s) => s.showToast);

  const [folderName, setFolderName] = useState('');
  const [senderMatch, setSenderMatch] = useState('');
  const [color, setColorState] = useState(COLOR_PALETTE[0]);
  const [skipInbox, setSkipInbox] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFolderName(initialFolderName);
      setSenderMatch(initialSender);
      setColorState(COLOR_PALETTE[0]);
      setSkipInbox(true);
    }
  }, [open, initialFolderName, initialSender]);

  const preview = useMemo(() => {
    const match = normalizeSenderMatch(senderMatch);
    const folder = folderName.trim();
    if (!match || !folder) return null;
    const provider = account?.provider ?? 'google';
    const inboxNote =
      skipInbox && provider === 'google'
        ? ' and skip Inbox'
        : provider === 'microsoft'
          ? ' (moved on arrival)'
          : '';
    return `When an email is from ${describeSenderMatch(senderMatch)}, move it to “${folder}”${inboxNote}.`;
  }, [senderMatch, folderName, skipInbox, account?.provider]);

  const onSubmit = async () => {
    if (!activeId || !account) return;
    const name = folderName.trim();
    const match = normalizeSenderMatch(senderMatch);
    if (!name) {
      showToast('err', 'Enter a folder name');
      return;
    }
    if (!match) {
      showToast('err', 'Enter who the emails are from (e.g. facebook.com)');
      return;
    }

    setBusy(true);
    try {
      const folder = await createFolder(activeId, name, color);
      if (!folder) {
        showToast('err', useFoldersStore.getState().byAccount[activeId]?.error ?? 'Failed to create folder');
        return;
      }
      setColor(activeId, folder.id, color);

      const rule = buildFolderRoutingRule(folder, senderMatch, account.provider, { skipInbox });
      const created = await createRule(activeId, rule);
      if (!created) {
        showToast(
          'info',
          `Folder “${folder.name}” created, but the routing rule failed — add it manually in Rules.`
        );
        onClose();
        return;
      }

      showToast('ok', `Created “${folder.name}” with routing rule for ${describeSenderMatch(senderMatch)}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New folder + routing rule"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onSubmit()} disabled={busy}>
            {busy ? 'Creating…' : 'Create folder & rule'}
          </Button>
        </>
      }
    >
      <div className="px-5 py-4 space-y-5">
        <p className="text-[12px] text-fg-muted leading-relaxed">
          Create a mailbox folder and a provider filter so matching mail is filed automatically — e.g.
          all Facebook notifications go to a dedicated folder.
        </p>

        <div>
          <label htmlFor="cfr-folder-name" className="label-mono block mb-1.5">
            Folder name
          </label>
          <input
            id="cfr-folder-name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Facebook"
            className="input"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="cfr-sender-match" className="label-mono block mb-1.5">
            Emails from
          </label>
          <input
            id="cfr-sender-match"
            value={senderMatch}
            onChange={(e) => setSenderMatch(e.target.value)}
            placeholder="facebook.com or @facebook.com"
            className="input"
            autoComplete="off"
          />
          <p className="text-[10px] text-fg-subtle mt-1.5">
            Matches the sender address or domain. Use <span className="font-mono">facebook.com</span>{' '}
            to catch all Facebook mail.
          </p>
        </div>

        <div>
          <span className="label-mono block mb-2">Folder color</span>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorState(c)}
                className={clsx(
                  'w-6 h-6 border transition-transform hover:scale-110',
                  color === c ? 'border-fg ring-2 ring-accent/40' : 'border-border-subtle'
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        {account?.provider === 'google' && (
          <Checkbox
            checked={skipInbox}
            onChange={() => setSkipInbox((v) => !v)}
            label="Skip Inbox (archive after labeling)"
          />
        )}

        {preview && (
          <div className="panel-inset p-3 flex gap-2.5 animate-slide-up-in">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <div>
              <div className="label-mono mb-1">Preview</div>
              <p className="text-[12px] text-fg leading-relaxed">{preview}</p>
              <p className="text-[10px] text-fg-subtle mt-1.5 flex items-center gap-1">
                <FolderInput className="w-3 h-3" />
                Rule is created on {account?.provider === 'google' ? 'Gmail' : 'Outlook'} via OAuth
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

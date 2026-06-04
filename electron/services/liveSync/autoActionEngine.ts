// Executes auto-actions via provider APIs and writes action_log entries.

import type { ActionLogRecord, EmailMessage, SuggestionActionPayload } from '../../../shared/types.js';
import { GmailClient } from '../gmail.js';
import { GraphClient } from '../microsoft.js';
import { insertActionLog } from '../liveSyncDb.js';

type Client =
  | { kind: 'google'; gmail: GmailClient }
  | { kind: 'microsoft'; graph: GraphClient };

export async function executeAutoAction(
  accountId: string,
  client: Client,
  msg: EmailMessage,
  actionType: string,
  payload: SuggestionActionPayload,
  summary: string
): Promise<ActionLogRecord> {
  const before = JSON.stringify({ folder: msg.folder, unread: msg.isUnread });
  let after = before;

  switch (actionType) {
    case 'trash': {
      const ids = payload.emailIds ?? [msg.id];
      if (client.kind === 'google') await client.gmail.batchTrash(ids);
      else {
        for (const id of ids) {
          try {
            await client.graph.deleteMessage(id, 'trash');
          } catch {
            // continue
          }
        }
      }
      after = JSON.stringify({ folder: 'trash' });
      break;
    }
    case 'archive_newsletter':
    case 'archive': {
      const ids = payload.emailIds ?? [msg.id];
      if (client.kind === 'google') await client.gmail.batchModifyLabels(ids, [], ['INBOX']);
      else {
        const folders = await client.graph.listMailFolders();
        const archive = folders.find((f) => /^archive$/i.test(f.name));
        if (archive) {
          for (const id of ids) {
            try {
              await client.graph.moveMessage(id, archive.id);
            } catch {
              // continue
            }
          }
        }
      }
      after = JSON.stringify({ folder: 'archive' });
      break;
    }
    case 'move_folder': {
      const ids = payload.emailIds ?? [msg.id];
      const folderId = payload.destinationFolderId;
      const folderName = payload.folderName ?? payload.destinationFolder;
      if (client.kind === 'microsoft' && folderId) {
        for (const id of ids) {
          try {
            await client.graph.moveMessage(id, folderId);
          } catch {
            // continue
          }
        }
        after = JSON.stringify({ folderId });
      } else if (client.kind === 'microsoft' && folderName) {
        const folders = await client.graph.listMailFolders();
        const dest = folders.find((f) => f.name.toLowerCase() === folderName.toLowerCase());
        if (dest) {
          for (const id of ids) {
            try {
              await client.graph.moveMessage(id, dest.id);
            } catch {
              // continue
            }
          }
        }
        after = JSON.stringify({ folder: folderName });
      } else if (client.kind === 'google' && folderName) {
        const labels = await client.gmail.listLabels();
        const label = labels.find((l) => l.name.toLowerCase() === folderName.toLowerCase());
        if (label) await client.gmail.batchModifyLabels(ids, [label.id], ['INBOX']);
        after = JSON.stringify({ folder: folderName });
      }
      break;
    }
    case 'apply_rule': {
      const ids = payload.emailIds ?? [msg.id];
      if (client.kind === 'google') await client.gmail.batchModifyLabels(ids, [], []);
      else if (payload.destinationFolderId) {
        for (const id of ids) {
          try {
            await client.graph.moveMessage(id, payload.destinationFolderId);
          } catch {
            // continue
          }
        }
        after = JSON.stringify({ folderId: payload.destinationFolderId });
      } else {
        after = JSON.stringify({ read: true });
      }
      break;
    }
    case 'mark_read': {
      const ids = payload.emailIds ?? [msg.id];
      if (client.kind === 'google') await client.gmail.batchModifyLabels(ids, [], []);
      after = JSON.stringify({ read: true });
      break;
    }
    default:
      break;
  }

  const now = Date.now();
  return insertActionLog({
    accountId,
    emailId: msg.id,
    actionType,
    beforeState: before,
    afterState: after,
    appliedAt: now,
    undoableUntil: now + 30 * 60_000,
    ruleId: null,
    summary,
  });
}

export async function undoActionLog(
  accountId: string,
  client: Client,
  log: ActionLogRecord
): Promise<boolean> {
  if (log.undoneAt || Date.now() > log.undoableUntil) return false;
  try {
    const before = JSON.parse(log.beforeState) as { folder?: string };
    if (client.kind === 'google') {
      if (before.folder === 'trash') {
        await client.gmail.batchModifyLabels([log.emailId], ['INBOX'], ['TRASH']);
      } else {
        await client.gmail.batchModifyLabels([log.emailId], ['INBOX'], []);
      }
    } else {
      await client.graph.restoreFromTrash(log.emailId);
    }
    return true;
  } catch {
    return false;
  }
}

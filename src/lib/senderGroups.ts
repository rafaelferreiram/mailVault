import type { EmailMessage, SenderGroup } from '@shared/types';
import { groupBySender } from '@/lib/grouping';

/** Prefer pre-aggregated sender groups from sync; fall back to grouping raw messages. */
export function resolveSenderGroups(
  senderGroups: SenderGroup[] | undefined,
  messages: EmailMessage[]
): SenderGroup[] {
  if (senderGroups && senderGroups.length > 0) return senderGroups;
  return groupBySender(messages);
}

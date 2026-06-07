/**
 * Per-account inbox routing — applied as Outlook/Gmail rules on first sync / rules list.
 * Match account by normalized email address.
 *
 * Personal presets live in accountRoutingRules.local.ts (gitignored).
 * Copy accountRoutingRules.local.example.ts to get started.
 */
export interface AccountRoutingRuleDef {
  /** Stable id for deduplication */
  id: string;
  name: string;
  /** Outlook messageRules senderContains */
  senderContains: string;
  /** MailVault local match (from address / display name substring) */
  fromMatch: string;
  /** Folder path from Inbox, e.g. ['Inbox', 'Work', 'Clients', 'Acme'] */
  folderPath: string[];
}

/** Default nested folder prefix for domainRule helpers — override paths per rule if needed. */
export const WORK_BASE = ['Inbox', 'Work'] as const;

export function domainRule(
  id: string,
  name: string,
  domain: string,
  folder: string,
  base: readonly string[] = WORK_BASE
): AccountRoutingRuleDef {
  const needle = domain.replace(/^@/, '').toLowerCase();
  return {
    id,
    name,
    senderContains: needle,
    fromMatch: `@${needle}`,
    folderPath: [...base, folder],
  };
}

import { LOCAL_ACCOUNT_ROUTING_BY_EMAIL } from './accountRoutingRules.local.js';

export const ACCOUNT_ROUTING_BY_EMAIL: Record<string, AccountRoutingRuleDef[]> =
  LOCAL_ACCOUNT_ROUTING_BY_EMAIL;

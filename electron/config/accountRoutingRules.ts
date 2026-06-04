/**
 * Per-account inbox routing — applied as Outlook/Gmail rules on first sync / rules list.
 * Match account by normalized email address.
 */
export interface AccountRoutingRuleDef {
  /** Stable id for deduplication */
  id: string;
  name: string;
  /** Outlook messageRules senderContains */
  senderContains: string;
  /** MailVault local match (from address / display name substring) */
  fromMatch: string;
  /** Folder path from Inbox, e.g. ['Inbox', 'RF-IT', 'Portugal', 'UNIPESSOAL'] */
  folderPath: string[];
}

export const ACCOUNT_ROUTING_BY_EMAIL: Record<string, AccountRoutingRuleDef[]> = {
  'rafah.26ferreira@hotmail.com': [
    {
      id: 'levels-unipessoal',
      name: 'Levels.pt → UNIPESSOAL',
      senderContains: 'levels.pt',
      fromMatch: '@levels.pt',
      folderPath: ['Inbox', 'RF-IT', 'Portugal', 'UNIPESSOAL'],
    },
    {
      id: 'bmw-car',
      name: 'BMW → Car',
      senderContains: 'bmw',
      fromMatch: 'bmw',
      folderPath: ['Inbox', 'RF-IT', 'Portugal', 'Car'],
    },
  ],
};

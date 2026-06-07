/**
 * Template for per-account inbox routing presets.
 *
 *   cp electron/config/accountRoutingRules.local.example.ts \\
 *      electron/config/accountRoutingRules.local.ts
 *
 * Edit accountRoutingRules.local.ts with your linked email and folder paths.
 * That file is gitignored and never committed.
 */
import type { AccountRoutingRuleDef } from './accountRoutingRules.js';
import { domainRule } from './accountRoutingRules.js';

export const LOCAL_ACCOUNT_ROUTING_BY_EMAIL: Record<string, AccountRoutingRuleDef[]> = {
  'user@example.com': [
    domainRule('acme-work', 'Acme Corp → Work', 'acme.com', 'Work'),
    domainRule('newsletters', 'Newsletters → Archive', 'newsletter.example.com', 'Archive'),
  ],
};

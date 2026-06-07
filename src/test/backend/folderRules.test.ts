// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildFolderRoutingRule, describeSenderMatch } from '@/lib/folderRules';

describe('folderRules', () => {
  it('builds Gmail label routing rule', () => {
    const rule = buildFolderRoutingRule(
      { id: 'lbl-fb', name: 'Facebook' },
      'facebook.com',
      'google'
    );
    expect(rule.fromContains).toBe('facebook.com');
    expect(rule.addLabel).toBe('lbl-fb');
    expect(rule.archive).toBe(true);
    expect(rule.name).toContain('Facebook');
  });

  it('builds Outlook folder move rule', () => {
    const rule = buildFolderRoutingRule(
      { id: 'fld-fb', name: 'Facebook' },
      '@facebook.com',
      'microsoft'
    );
    expect(rule.moveToFolderId).toBe('fld-fb');
    expect(rule.senderContains).toBe('facebook.com');
  });

  it('formats sender match for display', () => {
    expect(describeSenderMatch('facebook.com')).toBe('@facebook.com');
    expect(describeSenderMatch('user@gmail.com')).toBe('user@gmail.com');
  });
});

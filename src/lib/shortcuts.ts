// Single source of truth for documented keyboard shortcuts.
//
// Every entry rendered by `Shortcuts/index.tsx` (the `?`-overlay) and any
// onboarding cheat-sheet must live HERE. `App.tsx` registers the actual key
// handlers — when you add or change a shortcut there, update this list too,
// otherwise documentation will drift again (this file exists because it did).
//
// Closes audit item P0-4.

export interface ShortcutEntry {
  /** Keys to render (already in display order, e.g. ["⌘", "Z"]). */
  keys: string[];
  /** Human-readable description. */
  label: string;
}

export interface ShortcutSection {
  title: string;
  rows: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutSection[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: ['1'], label: 'Dashboard' },
      { keys: ['2'], label: 'Suggestions' },
      { keys: ['3'], label: 'Analyze' },
      { keys: ['4'], label: 'Senders' },
      { keys: ['5'], label: 'Folders' },
      { keys: ['6'], label: 'Rules' },
      { keys: ['7'], label: 'Blocked' },
      { keys: ['8'], label: 'Settings' },
      { keys: ['⌘', '1–4'], label: 'Switch active account' },
      { keys: ['⌘', ','], label: 'Open Personalization panel' },
    ],
  },
  {
    title: 'Sync',
    rows: [
      { keys: ['S'], label: 'Start sync (from Analyze)' },
      { keys: ['⇧', 'C'], label: 'Cancel running sync' },
      { keys: ['⌘', 'J'], label: 'Toggle sync drawer' },
    ],
  },
  {
    title: 'Global',
    rows: [
      { keys: ['?'], label: 'Open this overlay' },
      { keys: ['⌘', '⇧', '?'], label: 'Re-run onboarding tour' },
      { keys: ['⌘', 'D'], label: 'Toggle compact density' },
      { keys: ['⌘', 'Z'], label: 'Undo last delete' },
      { keys: ['Esc'], label: 'Close modal / clear selection' },
    ],
  },
];

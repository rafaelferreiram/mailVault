import { create } from 'zustand';
import type { Folder } from '@shared/types';
import { sortFoldersForDisplay } from '@/lib/folders';

const COLOR_PALETTE = [
  '#00d4ff',
  '#00e676',
  '#ffab00',
  '#ff3d57',
  '#9b8cff',
  '#ff7eb6',
  '#3ddc84',
  '#88c0ff',
];

const FOLDER_TTL_MS = 15 * 60_000;
const inFlight = new Map<string, Promise<void>>();

interface AccountFolders {
  folders: Folder[];
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
}

interface FoldersState {
  byAccount: Record<string, AccountFolders>;
  colors: Record<string, Record<string, string>>;
  load: (accountId: string, opts?: { force?: boolean }) => Promise<void>;
  create: (accountId: string, name: string, color?: string) => Promise<Folder | null>;
  setColor: (accountId: string, folderId: string, color: string) => void;
  reorder: (accountId: string, fromIndex: number, toIndex: number) => void;
  colorFor: (accountId: string, folderId: string, fallbackIndex: number) => string;
}

function filterFolders(folders: Folder[]): Folder[] {
  return folders.filter((f) => {
    if (!f.name) return false;
    if (f.id?.startsWith('CATEGORY_') && !['CATEGORY_PERSONAL', 'CATEGORY_PROMOTIONS'].includes(f.id))
      return false;
    if (f.id === 'CHAT' || f.id === 'CHATS') return false;
    return true;
  });
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  byAccount: {},
  colors: {},

  load: async (accountId, opts) => {
    const cur = get().byAccount[accountId];
    const fresh = cur?.loadedAt && Date.now() - cur.loadedAt < FOLDER_TTL_MS;
    if (!opts?.force && cur?.folders.length && fresh) return;

    const pending = inFlight.get(accountId);
    if (pending && !opts?.force) return pending;

    const run = (async () => {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            folders: s.byAccount[accountId]?.folders ?? [],
            loading: !s.byAccount[accountId]?.folders.length,
            error: null,
            loadedAt: s.byAccount[accountId]?.loadedAt ?? null,
          },
        },
      }));
      try {
        const folders = await window.mailvault.listFolders(accountId);
        const sorted = sortFoldersForDisplay(filterFolders(folders));
        set((s) => ({
          byAccount: {
            ...s.byAccount,
            [accountId]: { folders: sorted, loading: false, error: null, loadedAt: Date.now() },
          },
        }));
      } catch (e) {
        set((s) => ({
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              folders: s.byAccount[accountId]?.folders ?? [],
              loading: false,
              error: (e as Error).message,
              loadedAt: s.byAccount[accountId]?.loadedAt ?? null,
            },
          },
        }));
      } finally {
        inFlight.delete(accountId);
      }
    })();

    inFlight.set(accountId, run);
    return run;
  },

  create: async (accountId, name, color) => {
    try {
      const folder = await window.mailvault.createFolder(accountId, { name, color });
      set((s) => {
        const cur = s.byAccount[accountId]?.folders ?? [];
        const colors = { ...(s.colors[accountId] ?? {}) };
        if (color) colors[folder.id] = color;
        return {
          byAccount: {
            ...s.byAccount,
            [accountId]: {
              folders: [...cur, folder],
              loading: false,
              error: null,
              loadedAt: Date.now(),
            },
          },
          colors: { ...s.colors, [accountId]: colors },
        };
      });
      return folder;
    } catch (e) {
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: {
            folders: s.byAccount[accountId]?.folders ?? [],
            loading: false,
            error: (e as Error).message,
            loadedAt: s.byAccount[accountId]?.loadedAt ?? null,
          },
        },
      }));
      return null;
    }
  },

  setColor: (accountId, folderId, color) => {
    set((s) => {
      const cur = s.colors[accountId] ?? {};
      return { colors: { ...s.colors, [accountId]: { ...cur, [folderId]: color } } };
    });
  },

  reorder: (accountId, from, to) => {
    set((s) => {
      const list = s.byAccount[accountId]?.folders ?? [];
      const arr = [...list];
      const [moved] = arr.splice(from, 1);
      if (!moved) return s;
      arr.splice(to, 0, moved);
      return {
        byAccount: {
          ...s.byAccount,
          [accountId]: { ...s.byAccount[accountId], folders: arr },
        },
      };
    });
  },

  colorFor: (accountId, folderId, fallbackIndex) => {
    const explicit = get().colors[accountId]?.[folderId];
    if (explicit) return explicit;
    return COLOR_PALETTE[fallbackIndex % COLOR_PALETTE.length];
  },
}));

export { COLOR_PALETTE };

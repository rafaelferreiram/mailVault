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

interface FoldersState {
  byAccount: Record<string, { folders: Folder[]; loading: boolean; error: string | null }>;
  // Local color overrides for folders (Outlook doesn't natively color folders).
  colors: Record<string, Record<string, string>>; // accountId -> folderId -> color
  load: (accountId: string) => Promise<void>;
  create: (accountId: string, name: string, color?: string) => Promise<Folder | null>;
  setColor: (accountId: string, folderId: string, color: string) => void;
  reorder: (accountId: string, fromIndex: number, toIndex: number) => void;
  colorFor: (accountId: string, folderId: string, fallbackIndex: number) => string;
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  byAccount: {},
  colors: {},

  load: async (accountId) => {
    set((s) => ({
      byAccount: {
        ...s.byAccount,
        [accountId]: {
          folders: s.byAccount[accountId]?.folders ?? [],
          loading: true,
          error: null,
        },
      },
    }));
    try {
      const folders = await window.mailvault.listFolders(accountId);
      // Skip Gmail's noisy CATEGORY_ system labels and chat artifacts.
      const filtered = folders.filter((f) => {
        if (!f.name) return false;
        if (f.id?.startsWith('CATEGORY_') && !['CATEGORY_PERSONAL', 'CATEGORY_PROMOTIONS'].includes(f.id))
          return false;
        if (f.id === 'CHAT' || f.id === 'CHATS') return false;
        return true;
      });
      const sorted = sortFoldersForDisplay(filtered);
      set((s) => ({
        byAccount: {
          ...s.byAccount,
          [accountId]: { folders: sorted, loading: false, error: null },
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
          },
        },
      }));
    }
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
            [accountId]: { folders: [...cur, folder], loading: false, error: null },
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

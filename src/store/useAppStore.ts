import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from 'reactflow';
import { AppState, MindMapFile, LayoutMode, ThemeMode, Snapshot } from '@/types';

const PASSWORD = '2002';
const MAX_UNDO = 50;

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function defaultFile(
  name = 'Untitled Map',
  parentFileId: string | null = null,
  parentNodeId: string | null = null,
): MindMapFile {
  const id = uid();
  return {
    id,
    name,
    pinned: false,
    parentFileId,
    parentNodeId,
    nodes: [
      {
        id: 'root',
        type: 'editable',
        data: { label: 'Central Idea', isPortal: false, color: '' },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      /* ── auth ── */
      authenticated: false,
      login: (pw: string) => {
        if (pw === PASSWORD) {
          set({ authenticated: true });
          return true;
        }
        return false;
      },
      logout: () => set({ authenticated: false }),

      /* ── theme ── */
      theme: 'dark' as ThemeMode,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      /* ── files ── */
      files: [],
      activeFileId: null,
      breadcrumb: [],

      /* ── node color clipboard ── */
      colorClipboard: null,
      setColorClipboard: (color) => set({ colorClipboard: color }),

      createFile: (name, parentFileId = null, parentNodeId = null) => {
        const f = defaultFile(name ?? 'Untitled Map', parentFileId, parentNodeId);
        set((s) => ({
          files: [...s.files, f],
          activeFileId: f.id,
        }));
        return f.id;
      },

      deleteFile: (id) =>
        set((s) => {
          const remaining = s.files.filter((f) => f.id !== id && f.parentFileId !== id);
          return {
            files: remaining,
            activeFileId:
              s.activeFileId === id
                ? remaining[0]?.id ?? null
                : s.activeFileId,
          };
        }),

      renameFile: (id, name) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id ? { ...f, name, updatedAt: Date.now() } : f,
          ),
        })),

      setActiveFile: (id) => set({ activeFileId: id, breadcrumb: [id], undoStack: [], redoStack: [] }),

      pushBreadcrumb: (id) =>
        set((s) => ({
          activeFileId: id,
          breadcrumb: [...s.breadcrumb, id],
          undoStack: [],
          redoStack: [],
        })),

      popBreadcrumb: () =>
        set((s) => {
          const bc = [...s.breadcrumb];
          bc.pop();
          return {
            breadcrumb: bc,
            activeFileId: bc[bc.length - 1] ?? s.files[0]?.id ?? null,
            undoStack: [],
            redoStack: [],
          };
        }),

      togglePin: (id) =>
        set((s) => {
          const next = [...s.files];
          const idx = next.findIndex((f) => f.id === id);
          if (idx === -1) return { files: next };
          const file = next[idx];
          const updated = { ...file, pinned: !file.pinned, updatedAt: Date.now() };
          next.splice(idx, 1);

          // Keep portal sub-files in place; only reorder within same parentFileId group
          const group = next.filter((f) => f.parentFileId === file.parentFileId);
          const groupIndices = next
            .map((f, i) => ({ f, i }))
            .filter((x) => x.f.parentFileId === file.parentFileId)
            .map((x) => x.i);

          if (groupIndices.length === 0) {
            next.push(updated);
            return { files: next };
          }

          const insertIndex = (() => {
            const firstUnpinnedInGroup = groupIndices.find((gi) => !next[gi].pinned);
            if (updated.pinned) {
              return groupIndices[0];
            }
            return firstUnpinnedInGroup ?? (groupIndices[groupIndices.length - 1] + 1);
          })();

          next.splice(insertIndex, 0, updated);
          return { files: next };
        }),

      reorderFiles: (sourceId, targetId) =>
        set((s) => {
          if (sourceId === targetId) return {};
          const next = [...s.files];
          const sourceIndex = next.findIndex((f) => f.id === sourceId);
          const targetIndex = next.findIndex((f) => f.id === targetId);
          if (sourceIndex === -1 || targetIndex === -1) return {};
          const source = next[sourceIndex];
          const target = next[targetIndex];

          // only allow reordering within same parent group and same pinned group
          if (source.parentFileId !== target.parentFileId) return {};
          if (source.pinned !== target.pinned) return {};

          next.splice(sourceIndex, 1);
          const newTargetIndex = next.findIndex((f) => f.id === targetId);
          if (newTargetIndex === -1) return {};
          next.splice(newTargetIndex, 0, source);
          return { files: next };
        }),

      /* ── canvas helpers ── */
      setNodes: (nodes) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === s.activeFileId
              ? { ...f, nodes, updatedAt: Date.now() }
              : f,
          ),
        })),

      setEdges: (edges) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === s.activeFileId
              ? { ...f, edges, updatedAt: Date.now() }
              : f,
          ),
        })),

      updateNodes: (updater) => {
        const s = get();
        const file = s.files.find((f) => f.id === s.activeFileId);
        if (!file) return;
        s.setNodes(updater(file.nodes));
      },

      updateEdges: (updater) => {
        const s = get();
        const file = s.files.find((f) => f.id === s.activeFileId);
        if (!file) return;
        s.setEdges(updater(file.edges));
      },

      /* ── undo / redo ── */
      undoStack: [] as Snapshot[],
      redoStack: [] as Snapshot[],

      pushUndo: (snapshot) =>
        set((s) => ({
          undoStack: [...s.undoStack.slice(-MAX_UNDO), snapshot],
          redoStack: [],
        })),

      undo: () => {
        const s = get();
        if (s.undoStack.length === 0) return;
        const file = s.files.find((f) => f.id === s.activeFileId);
        if (!file) return;
        const current: Snapshot = { nodes: file.nodes, edges: file.edges };
        const prev = s.undoStack[s.undoStack.length - 1];
        set({
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, current],
        });
        s.setNodes(prev.nodes);
        s.setEdges(prev.edges);
      },

      redo: () => {
        const s = get();
        if (s.redoStack.length === 0) return;
        const file = s.files.find((f) => f.id === s.activeFileId);
        if (!file) return;
        const current: Snapshot = { nodes: file.nodes, edges: file.edges };
        const next = s.redoStack[s.redoStack.length - 1];
        set({
          redoStack: s.redoStack.slice(0, -1),
          undoStack: [...s.undoStack, current],
        });
        s.setNodes(next.nodes);
        s.setEdges(next.edges);
      },

      /* ── layout ── */
      layoutMode: 'mindmap' as LayoutMode,
      setLayoutMode: (m) => set({ layoutMode: m }),

      /* ── sidebar ── */
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'tinker-mindmap-storage',
      partialize: (s) => ({
        authenticated: s.authenticated,
        theme: s.theme,
        files: s.files,
        activeFileId: s.activeFileId,
        breadcrumb: s.breadcrumb,
        layoutMode: s.layoutMode,
        sidebarOpen: s.sidebarOpen,
      }),
    },
  ),
);

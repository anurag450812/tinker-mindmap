import { Node, Edge } from 'reactflow';

/* ────────── layout modes ────────── */
export type LayoutMode = 'mindmap' | 'orgchart' | 'logic';

/* ────────── theme ────────── */
export type ThemeMode = 'dark' | 'light';

/* ────────── node color presets ────────── */
export const NODE_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Sky', value: '#0ea5e9' },
] as const;

/* ────────── undo/redo snapshot ────────── */
export interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

/* ────────── single mind-map file ────────── */
export interface MindMapFile {
  id: string;
  name: string;
  pinned: boolean;
  parentFileId: string | null;   // null = top-level file
  parentNodeId: string | null;   // the portal-node that owns this sub-map
  nodes: Node[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

/* ────────── app-wide persisted state ────────── */
export interface AppState {
  /* auth */
  authenticated: boolean;
  login: (pw: string) => boolean;
  logout: () => void;

  /* theme */
  theme: ThemeMode;
  toggleTheme: () => void;

  /* files */
  files: MindMapFile[];
  activeFileId: string | null;
  breadcrumb: string[];          // stack of fileIds for nested navigation

  createFile: (name?: string, parentFileId?: string | null, parentNodeId?: string | null) => string;
  deleteFile: (id: string) => void;
  renameFile: (id: string, name: string) => void;
  setActiveFile: (id: string) => void;
  pushBreadcrumb: (id: string) => void;
  popBreadcrumb: () => void;
  togglePin: (id: string) => void;

  /* canvas – operates on the active file */
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodes: (updater: (nodes: Node[]) => Node[]) => void;
  updateEdges: (updater: (edges: Edge[]) => Edge[]) => void;

  /* undo / redo */
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  pushUndo: (snapshot: Snapshot) => void;
  undo: () => void;
  redo: () => void;

  /* layout */
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;

  /* sidebar */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

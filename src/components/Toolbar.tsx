'use client';

import { useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { exportJSON, exportPNG, exportSVG, importJSON } from '@/lib/exportUtils';
import { LayoutMode } from '@/types';

const LAYOUT_OPTIONS: { value: LayoutMode; label: string }[] = [
  { value: 'mindmap', label: 'Mind Map' },
  { value: 'orgchart', label: 'Org Chart' },
  { value: 'logic', label: 'Logic' },
];

export default function Toolbar() {
  const {
    files, activeFileId, layoutMode, setLayoutMode, setNodes, setEdges,
    toggleSidebar, sidebarOpen, logout, theme, toggleTheme,
    undoStack, redoStack,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  const activeFile = files.find((f) => f.id === activeFileId);

  const handleExportJSON = useCallback(() => {
    if (!activeFile) return;
    exportJSON(activeFile.nodes, activeFile.edges, activeFile.name);
  }, [activeFile]);

  const handleExportPNG = useCallback(() => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (el && activeFile) exportPNG(el, activeFile.name);
  }, [activeFile]);

  const handleExportSVG = useCallback(() => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (el && activeFile) exportSVG(el, activeFile.name);
  }, [activeFile]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { nodes, edges } = await importJSON(file);
      setNodes(nodes);
      setEdges(edges);
    } catch {
      alert('Failed to import: invalid JSON file');
    }
    e.target.value = '';
  }, [setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    const fn = (window as unknown as Record<string, () => void>).__applyLayout;
    if (fn) fn();
  }, []);

  const handleUndo = useCallback(() => {
    const fn = (window as unknown as Record<string, () => void>).__undoCanvas;
    if (fn) fn();
  }, []);

  const handleRedo = useCallback(() => {
    const fn = (window as unknown as Record<string, () => void>).__redoCanvas;
    if (fn) fn();
  }, []);

  return (
    <div className={`h-12 shrink-0 flex items-center justify-between px-3 border-b transition-colors ${
      isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-200 bg-white'
    }`}>
      {/* left: sidebar toggle + layout + undo/redo */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? 'hover:bg-white/[0.06] text-white/50 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
          }`}
          title="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {sidebarOpen
              ? <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>

        <div className={`h-5 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />

        {/* layout switcher */}
        <div className={`flex items-center rounded-lg p-0.5 gap-0.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLayoutMode(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                layoutMode === opt.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleAutoLayout}
          className={`px-2 py-1 rounded-lg text-xs transition-all ${
            isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title="Auto-layout"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>

        <div className={`h-5 w-px ${isDark ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />

        {/* undo / redo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-20 ${
            isDark ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-20 ${
            isDark ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* center: file name */}
      <div className={`text-xs truncate max-w-[200px] ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
        {activeFile?.name ?? 'No map selected'}
      </div>

      {/* right: export / import / theme / logout */}
      <div className="flex items-center gap-1">
        <button onClick={handleExportJSON} className={`toolbar-btn ${isDark ? '' : 'toolbar-btn-light'}`} title="Export JSON">
          <span className="text-[10px]">JSON</span>
        </button>
        <button onClick={handleExportPNG} className={`toolbar-btn ${isDark ? '' : 'toolbar-btn-light'}`} title="Export PNG">
          <span className="text-[10px]">PNG</span>
        </button>
        <button onClick={handleExportSVG} className={`toolbar-btn ${isDark ? '' : 'toolbar-btn-light'}`} title="Export SVG">
          <span className="text-[10px]">SVG</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className={`toolbar-btn ${isDark ? '' : 'toolbar-btn-light'}`} title="Import JSON">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        <div className={`h-5 w-px mx-1 ${isDark ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />

        {/* theme toggle */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button
          onClick={logout}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? '!text-red-400/60 hover:!text-red-400 hover:bg-white/[0.06]' : '!text-red-300 hover:!text-red-500 hover:bg-gray-100'
          }`}
          title="Lock app"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

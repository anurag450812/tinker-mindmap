'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

export default function Sidebar() {
  const {
    files, activeFileId, sidebarOpen,
    createFile, deleteFile, renameFile, setActiveFile, togglePin, theme,
  } = useAppStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  // only show top-level files, sorted: pinned first, then by creation date
  const topFiles = useMemo(() => {
    const top = files.filter((f) => f.parentFileId === null);
    return top.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [files]);

  useEffect(() => {
    if (renamingId) inputRef.current?.focus();
  }, [renamingId]);

  const startRename = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameVal(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameVal.trim()) {
      renameFile(renamingId, renameVal.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameVal, renameFile]);

  const handleNew = useCallback(() => {
    const id = createFile();
    setActiveFile(id);
  }, [createFile, setActiveFile]);

  if (!sidebarOpen) return null;

  return (
    <aside className={`w-60 shrink-0 h-full flex flex-col border-r transition-colors ${
      isDark ? 'border-white/[0.06] bg-white/[0.015]' : 'border-gray-200 bg-gray-50'
    }`}>
      {/* header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDark ? 'border-white/[0.06]' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <span className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-gray-700'}`}>Tinker</span>
        </div>
      </div>

      {/* file list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2 scrollbar-thin">
        {topFiles.length === 0 && (
          <p className={`text-xs text-center mt-6 ${isDark ? 'text-white/20' : 'text-gray-300'}`}>No maps yet</p>
        )}
        {topFiles.map((f) => {
          const isActive = f.id === activeFileId;
          const childCount = files.filter((cf) => cf.parentFileId === f.id).length;

          return (
            <div
              key={f.id}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all text-xs
                ${isActive
                  ? isDark ? 'bg-indigo-600/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                  : isDark ? 'text-white/50 hover:bg-white/[0.04] hover:text-white/70' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }
              `}
              onClick={() => setActiveFile(f.id)}
              onDoubleClick={() => startRename(f.id, f.name)}
            >
              {/* pin indicator */}
              {f.pinned && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="shrink-0 text-amber-400">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-50">
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="5" x2="12" y2="1" />
                <line x1="12" y1="23" x2="12" y2="19" />
                <line x1="5" y1="12" x2="1" y2="12" />
                <line x1="23" y1="12" x2="19" y2="12" />
              </svg>

              {renamingId === f.id ? (
                <input
                  ref={inputRef}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className={`flex-1 bg-transparent outline-none text-xs ${isDark ? 'text-white' : 'text-gray-800'}`}
                />
              ) : (
                <span className="flex-1 truncate">{f.name}</span>
              )}

              {childCount > 0 && (
                <span className={`text-[10px] ${isDark ? 'text-white/20' : 'text-gray-300'}`}>{childCount}</span>
              )}

              {/* pin button */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePin(f.id); }}
                className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${
                  f.pinned
                    ? 'text-amber-400 opacity-100'
                    : isDark ? 'text-white/30 hover:text-amber-400' : 'text-gray-300 hover:text-amber-500'
                }`}
                title={f.pinned ? 'Unpin' : 'Pin to top'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill={f.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>

              {/* delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this map?')) deleteFile(f.id);
                }}
                className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${
                  isDark ? 'hover:bg-red-500/20 text-white/30 hover:text-red-400' : 'hover:bg-red-50 text-gray-300 hover:text-red-500'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* new map button */}
      <div className={`p-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <button
          onClick={handleNew}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
            isDark
              ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-white/50 hover:text-white/80'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700 shadow-sm'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Map
        </button>
      </div>

      {/* shortcuts help */}
      <div className={`px-4 py-3 border-t space-y-1 ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
        <p className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-white/20' : 'text-gray-300'}`}>Shortcuts</p>
        <div className={`grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] ${isDark ? 'text-white/25' : 'text-gray-400'}`}>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>Click</kbd> Select</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>Tab</kbd> Child</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>Enter</kbd> Sibling</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>Del</kbd> Remove</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>P</kbd> Portal</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>Ctrl+Z</kbd> Undo</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>R-click</kbd> Menu</span>
          <span><kbd className={`kbd ${isDark ? '' : 'kbd-light'}`}>2x Click</kbd> Edit</span>
        </div>
      </div>
    </aside>
  );
}

'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '@/store/useAppStore';
import { NODE_COLORS } from '@/types';

function EditableNode({ id, data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateNodes = useAppStore((s) => s.updateNodes);
  const pushBreadcrumb = useAppStore((s) => s.pushBreadcrumb);
  const files = useAppStore((s) => s.files);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  const nodeColor = (data.color as string) || '';

  useEffect(() => {
    setLabel(data.label as string);
  }, [data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Auto-resize textarea
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [editing, label]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    updateNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    );
  }, [id, label, updateNodes]);

  const setColor = useCallback((color: string) => {
    updateNodes((nodes) =>
      nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color } } : n,
      ),
    );
    setShowColorPicker(false);
    setShowMenu(false);
  }, [id, updateNodes]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (data.isPortal) {
        const subFile = files.find(
          (f) => f.parentNodeId === id,
        );
        if (subFile) {
          pushBreadcrumb(subFile.id);
          return;
        }
      }
      setEditing(true);
    },
    [data.isPortal, files, id, pushBreadcrumb],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
    setShowColorPicker(false);
  }, []);

  const isPortal = data.isPortal as boolean;

  // Trigger custom event for actions (Canvas will listen)
  const triggerAction = useCallback((action: string, payload?: unknown) => {
    const event = new CustomEvent('nodeAction', {
      detail: { nodeId: id, action, payload },
    });
    window.dispatchEvent(event);
    setShowMenu(false);
  }, [id]);

  /* dynamic border/bg based on node color */
  const colorStyle: React.CSSProperties = nodeColor
    ? {
        borderColor: `${nodeColor}60`,
        backgroundColor: `${nodeColor}15`,
      }
    : {};

  const selectedStyle: React.CSSProperties = selected
    ? nodeColor
      ? { borderColor: nodeColor, boxShadow: `0 0 12px ${nodeColor}30` }
      : {}
    : {};

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{ ...colorStyle, ...selectedStyle }}
      className={`group relative px-4 py-2.5 min-w-[120px] max-w-[280px] rounded-xl border text-sm transition-all duration-150
        ${!nodeColor && selected
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
          : ''
        }
        ${!nodeColor && !selected
          ? isDark
            ? 'border-white/10 bg-white/[0.04] hover:border-white/20'
            : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
          : ''
        }
        ${!nodeColor && selected
          ? isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'
          : ''
        }
        ${isPortal ? 'border-dashed !border-violet-400/60' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2 !h-2 !border-0 !-left-1 ${isDark ? '!bg-white/30' : '!bg-gray-300'}`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2 !h-2 !border-0 !-right-1 ${isDark ? '!bg-white/30' : '!bg-gray-300'}`}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`!w-2 !h-2 !border-0 !-top-1 ${isDark ? '!bg-white/30' : '!bg-gray-300'}`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`!w-2 !h-2 !border-0 !-bottom-1 ${isDark ? '!bg-white/30' : '!bg-gray-300'}`}
      />

      {editing ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              commitLabel();
            }
            if (e.key === 'Escape') { setLabel(data.label as string); setEditing(false); }
            e.stopPropagation();
          }}
          className={`w-full bg-transparent outline-none text-center resize-none overflow-hidden ${isDark ? 'text-white' : 'text-gray-800'}`}
          rows={1}
          style={{ minHeight: '1.25rem' }}
        />
      ) : (
        <span className={`select-none text-center block whitespace-pre-wrap break-words ${
          isDark ? 'text-white/90' : 'text-gray-700'
        }`}>
          {data.label as string}
        </span>
      )}

      {isPortal && (
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </div>
      )}

      {/* node color indicator */}
      {nodeColor && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-full"
          style={{ backgroundColor: nodeColor }}
        />
      )}

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className={`fixed z-[9999] min-w-[180px] rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden ${
            isDark ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-gray-200'
          }`}
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Actions */}
          <div className="p-1">
            <button
              onClick={() => triggerAction('addChild')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M12 5v14" />
              </svg>
              Add Child
            </button>
            <button
              onClick={() => triggerAction('addParent')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              Add Parent
            </button>
            <button
              onClick={() => triggerAction('addSibling')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Add Sibling
            </button>
            <button
              onClick={() => triggerAction('duplicate')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Duplicate
            </button>
          </div>

          <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* Portal & Delete */}
          <div className="p-1">
            <button
              onClick={() => triggerAction('togglePortal')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              {isPortal ? 'Remove Portal' : 'Make Portal'}
            </button>
            <button
              onClick={() => triggerAction('delete')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Node
            </button>
          </div>

          <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

          {/* Color Picker */}
          <div className="p-1">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                Change Color
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${showColorPicker ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showColorPicker && (
              <div className={`px-2 pb-2 pt-1 flex flex-wrap gap-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-lg mt-1 mx-1`}>
                {NODE_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      nodeColor === c.value ? 'ring-2 ring-offset-2 ring-indigo-400' : ''
                    } ${
                      c.value === ''
                        ? isDark ? 'bg-white/10 border-white/20' : 'bg-gray-100 border-gray-300'
                        : 'border-transparent'
                    }`}
                    style={c.value ? { backgroundColor: c.value } : {}}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(EditableNode);

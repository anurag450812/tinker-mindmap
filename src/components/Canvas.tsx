'use client';

import { useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAppStore } from '@/store/useAppStore';
import EditableNode from './EditableNode';
import { applyLayout } from '@/lib/layoutEngine';
import { LayoutMode } from '@/types';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ── compute child position based on layout mode ── */
function getChildPosition(
  parent: Node,
  existingSiblingCount: number,
  mode: LayoutMode,
): { x: number; y: number } {
  switch (mode) {
    case 'mindmap': {
      // Circular placement around parent
      const radius = 200;
      const angleStep = (2 * Math.PI) / Math.max(existingSiblingCount + 1, 6);
      const angle = angleStep * existingSiblingCount - Math.PI / 2;
      return {
        x: parent.position.x + Math.cos(angle) * radius,
        y: parent.position.y + Math.sin(angle) * radius,
      };
    }
    case 'orgchart': {
      // Downward tree: children below parent, spread horizontally
      const gapX = 200;
      const offsetX = (existingSiblingCount - (existingSiblingCount > 0 ? (existingSiblingCount - 1) / 2 : 0)) * gapX;
      const startX = parent.position.x - ((existingSiblingCount) * gapX) / 2;
      return {
        x: startX + existingSiblingCount * gapX,
        y: parent.position.y + 140,
      };
    }
    case 'logic': {
      // To the right, stacked vertically with equal gaps
      const gapY = 80;
      const totalHeight = existingSiblingCount * gapY;
      const startY = parent.position.y - totalHeight / 2;
      return {
        x: parent.position.x + 280,
        y: startY + existingSiblingCount * gapY,
      };
    }
  }
}

/* ── get sibling position based on layout mode ── */
function getSiblingPosition(
  selected: Node,
  mode: LayoutMode,
): { x: number; y: number } {
  switch (mode) {
    case 'mindmap':
      return { x: selected.position.x, y: selected.position.y + 100 };
    case 'orgchart':
      return { x: selected.position.x + 200, y: selected.position.y };
    case 'logic':
      return { x: selected.position.x, y: selected.position.y + 80 };
  }
}

function edgeStyle(theme: 'dark' | 'light') {
  return {
    stroke: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    strokeWidth: 2,
  };
}

/* ── inner canvas (needs ReactFlowProvider ancestor) ── */
function CanvasInner() {
  const {
    files, activeFileId, setNodes: storeSetNodes, setEdges: storeSetEdges,
    layoutMode, createFile, pushBreadcrumb, breadcrumb,
    theme, pushUndo, undo, redo,
  } = useAppStore();

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? null,
    [files, activeFileId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(activeFile?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeFile?.edges ?? []);

  const { screenToFlowPosition, fitView } = useReactFlow();
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = theme === 'dark';

  /* sync store → local when activeFile changes */
  useEffect(() => {
    if (activeFile) {
      setNodes(activeFile.nodes);
      setEdges(activeFile.edges);
      setTimeout(() => fitView({ duration: 300 }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);

  /* sync from store on undo/redo */
  useEffect(() => {
    if (activeFile) {
      setNodes(activeFile.nodes);
      setEdges(activeFile.edges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.updatedAt]);

  /* auto-save: debounce local → store */
  useEffect(() => {
    if (!activeFileId) return;
    if (saveTimeout.current !== null) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      storeSetNodes(nodes);
      storeSetEdges(edges);
    }, 300);
    return () => { if (saveTimeout.current !== null) clearTimeout(saveTimeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const nodeTypes = useMemo(() => ({ editable: EditableNode }), []);

  /* ── snapshot before mutations ── */
  const snapshot = useCallback(() => {
    pushUndo({ nodes: [...nodes], edges: [...edges] });
  }, [nodes, edges, pushUndo]);

  /* ── connection ── */
  const onConnect = useCallback(
    (conn: Connection) => {
      snapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            type: 'smoothstep',
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: edgeStyle(theme),
          },
          eds,
        ),
      );
    },
    [setEdges, snapshot, theme],
  );

  /* ── double-click canvas → new root node ── */
  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      snapshot();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: Node = {
        id: uid(),
        type: 'editable',
        position,
        data: { label: 'New Node', isPortal: false, color: '' },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes, snapshot],
  );

  /* ── keyboard shortcuts ── */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      /* Ctrl+Z / Cmd+Z → undo */
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      /* Ctrl+Shift+Z or Ctrl+Y → redo */
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      const selected = nodes.find((n) => n.selected);
      if (!selected) return;

      /* Tab → child node */
      if (e.key === 'Tab') {
        e.preventDefault();
        snapshot();
        const childId = uid();
        // Count existing children of selected node
        const existingChildren = edges.filter((ed) => ed.source === selected.id).length;
        const pos = getChildPosition(selected, existingChildren, layoutMode);
        const newNode: Node = {
          id: childId,
          type: 'editable',
          position: pos,
          data: { label: 'Child', isPortal: false, color: '' },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) =>
          addEdge(
            {
              id: `e-${selected.id}-${childId}`,
              source: selected.id,
              target: childId,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              style: edgeStyle(theme),
            },
            eds,
          ),
        );
      }

      /* Enter → sibling node */
      if (e.key === 'Enter') {
        e.preventDefault();
        snapshot();
        const parentEdge = edges.find((ed) => ed.target === selected.id);
        const siblingId = uid();
        const pos = getSiblingPosition(selected, layoutMode);
        const newNode: Node = {
          id: siblingId,
          type: 'editable',
          position: pos,
          data: { label: 'Sibling', isPortal: false, color: '' },
        };
        const newEdges = parentEdge
          ? [
              {
                id: `e-${parentEdge.source}-${siblingId}`,
                source: parentEdge.source,
                target: siblingId,
                type: 'smoothstep' as const,
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                style: edgeStyle(theme),
              },
            ]
          : [];
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, ...newEdges]);
      }

      /* Delete / Backspace → remove node */
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        snapshot();
        setNodes((nds) => nds.filter((n) => n.id !== selected.id));
        setEdges((eds) =>
          eds.filter(
            (ed) => ed.source !== selected.id && ed.target !== selected.id,
          ),
        );
      }

      /* P → toggle portal */
      if (e.key === 'p' || e.key === 'P') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        snapshot();
        const isPortalNow = selected.data.isPortal;
        if (!isPortalNow) {
          const subFileId = createFile(
            `Sub: ${selected.data.label}`,
            activeFileId,
            selected.id,
          );
          setNodes((nds) =>
            nds.map((n) =>
              n.id === selected.id
                ? { ...n, data: { ...n.data, isPortal: true, subFileId } }
                : n,
            ),
          );
        } else {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === selected.id
                ? { ...n, data: { ...n.data, isPortal: false } }
                : n,
            ),
          );
        }
      }
    },
    [nodes, edges, setNodes, setEdges, createFile, activeFileId, layoutMode, theme, snapshot, undo, redo],
  );

  /* ── auto-layout ── */
  const applyAutoLayout = useCallback(() => {
    snapshot();
    const result = applyLayout(nodes, edges, layoutMode);
    setNodes(result.nodes);
    setEdges(result.edges);
    setTimeout(() => fitView({ duration: 400 }), 50);
  }, [nodes, edges, layoutMode, setNodes, setEdges, fitView, snapshot]);

  /* expose layout trigger for toolbar */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__applyLayout = applyAutoLayout;
    return () => { delete (window as unknown as Record<string, unknown>).__applyLayout; };
  }, [applyAutoLayout]);

  /* expose undo/redo for toolbar */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__undoCanvas = () => undo();
    (window as unknown as Record<string, unknown>).__redoCanvas = () => redo();
    return () => {
      delete (window as unknown as Record<string, unknown>).__undoCanvas;
      delete (window as unknown as Record<string, unknown>).__redoCanvas;
    };
  }, [undo, redo]);

  /* listen for context menu actions from nodes */
  useEffect(() => {
    const handleNodeAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string; action: string; payload?: unknown }>;
      const { nodeId, action } = customEvent.detail;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      snapshot(); // capture state before mutation

      switch (action) {
        case 'addChild': {
          const childId = uid();
          const existingChildren = edges.filter((ed) => ed.source === nodeId).length;
          const pos = getChildPosition(node, existingChildren, layoutMode);
          const newNode: Node = {
            id: childId,
            type: 'editable',
            position: pos,
            data: { label: 'Child', isPortal: false, color: '' },
          };
          setNodes((nds) => [...nds, newNode]);
          setEdges((eds) =>
            addEdge(
              {
                id: `e-${nodeId}-${childId}`,
                source: nodeId,
                target: childId,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                style: edgeStyle(theme),
              },
              eds,
            ),
          );
          break;
        }

        case 'addSibling': {
          const siblingId = uid();
          const parentEdge = edges.find((ed) => ed.target === nodeId);
          const pos = getSiblingPosition(node, layoutMode);
          const newNode: Node = {
            id: siblingId,
            type: 'editable',
            position: pos,
            data: { label: 'Sibling', isPortal: false, color: '' },
          };
          const newEdges = parentEdge
            ? [
                {
                  id: `e-${parentEdge.source}-${siblingId}`,
                  source: parentEdge.source,
                  target: siblingId,
                  type: 'smoothstep' as const,
                  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                  style: edgeStyle(theme),
                },
              ]
            : [];
          setNodes((nds) => [...nds, newNode]);
          setEdges((eds) => [...eds, ...newEdges]);
          break;
        }

        case 'duplicate': {
          const duplicateId = uid();
          const offsetPos = { x: node.position.x + 40, y: node.position.y + 40 };
          const newNode: Node = {
            id: duplicateId,
            type: 'editable',
            position: offsetPos,
            data: { ...node.data, label: `${node.data.label} (copy)` },
          };
          setNodes((nds) => [...nds, newNode]);
          break;
        }

        case 'delete': {
          setNodes((nds) => nds.filter((n) => n.id !== nodeId));
          setEdges((eds) =>
            eds.filter((ed) => ed.source !== nodeId && ed.target !== nodeId),
          );
          break;
        }

        case 'togglePortal': {
          const isPortalNow = node.data.isPortal;
          if (!isPortalNow) {
            const subFileId = createFile(
              `Sub: ${node.data.label}`,
              activeFileId,
              nodeId,
            );
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, isPortal: true, subFileId } }
                  : n,
              ),
            );
          } else {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, isPortal: false } }
                  : n,
              ),
            );
          }
          break;
        }
      }
    };

    window.addEventListener('nodeAction', handleNodeAction);
    return () => window.removeEventListener('nodeAction', handleNodeAction);
  }, [nodes, edges, setNodes, setEdges, layoutMode, theme, snapshot, createFile, activeFileId]);

  if (!activeFile) {
    return (
      <div className={`flex-1 flex items-center justify-center text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
        Create or select a mind map from the sidebar
      </div>
    );
  }

  return (
    <div className="flex-1 h-full" onKeyDown={onKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => {}}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: edgeStyle(theme),
        }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'}
        />
        <MiniMap
          nodeColor={(n) => {
            const c = n.data?.color as string;
            return c || '#6366f1';
          }}
          maskColor={isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
          className={isDark
            ? '!bg-white/[0.03] !border-white/10 !rounded-xl'
            : '!bg-black/[0.03] !border-black/10 !rounded-xl'
          }
          pannable
          zoomable
        />
        <Controls
          showInteractive={false}
          className={isDark
            ? '!bg-white/[0.05] !border-white/10 !rounded-xl !shadow-xl [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/10'
            : '!bg-white !border-gray-200 !rounded-xl !shadow-lg [&>button]:!bg-transparent [&>button]:!border-gray-200 [&>button]:!text-gray-500 [&>button:hover]:!bg-gray-100'
          }
        />
      </ReactFlow>

      {/* breadcrumb */}
      {breadcrumb.length > 1 && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-lg backdrop-blur-md text-xs
          ${isDark ? 'bg-white/[0.05] border border-white/10 text-white/60' : 'bg-white/80 border border-gray-200 text-gray-500 shadow-sm'}
        `}>
          {breadcrumb.map((fid, i) => {
            const f = files.find((ff) => ff.id === fid);
            return (
              <span key={fid} className="flex items-center gap-1">
                {i > 0 && <span className={isDark ? 'text-white/20' : 'text-gray-300'}>/</span>}
                <button
                  onClick={() => {
                    const store = useAppStore.getState();
                    while (store.breadcrumb.length > i + 1) store.popBreadcrumb();
                  }}
                  className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}
                >
                  {f?.name ?? 'Map'}
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── wrapper with ReactFlowProvider ── */
export default function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

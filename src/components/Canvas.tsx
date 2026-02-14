'use client';

import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
      const radius = 220;
      const angleStep = (2 * Math.PI) / Math.max(existingSiblingCount + 1, 6);
      const angle = angleStep * existingSiblingCount - Math.PI / 2;
      return {
        x: parent.position.x + Math.cos(angle) * radius,
        y: parent.position.y + Math.sin(angle) * radius,
      };
    }
    case 'orgchart': {
      // Downward tree: children below parent, spread horizontally
      const gapX = 280;
      const gapY = 170;
      const offsetX = (existingSiblingCount - (existingSiblingCount > 0 ? (existingSiblingCount - 1) / 2 : 0)) * gapX;
      const startX = parent.position.x - ((existingSiblingCount) * gapX) / 2;
      return {
        x: startX + existingSiblingCount * gapX,
        y: parent.position.y + gapY,
      };
    }
    case 'logic': {
      // To the right, stacked vertically with equal gaps
      const gapX = 300;
      const gapY = 120;
      const totalHeight = existingSiblingCount * gapY;
      const startY = parent.position.y - totalHeight / 2;
      return {
        x: parent.position.x + gapX,
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
      return { x: selected.position.x, y: selected.position.y + 120 };
    case 'orgchart':
      return { x: selected.position.x + 280, y: selected.position.y };
    case 'logic':
      return { x: selected.position.x, y: selected.position.y + 120 };
  }
}

function edgeStyle(theme: 'dark' | 'light') {
  return {
    stroke: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    strokeWidth: 2,
  };
}

function edgeTemplate(layoutMode: LayoutMode, theme: 'dark' | 'light') {
  const base = {
    type: (layoutMode === 'orgchart' || layoutMode === 'logic' ? 'step' : 'smoothstep') as Edge['type'],
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: edgeStyle(theme),
    pathOptions: layoutMode === 'orgchart' || layoutMode === 'logic' ? { offset: 40 } : undefined,
  };

  if (layoutMode === 'orgchart') {
    return {
      ...base,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    };
  }

  if (layoutMode === 'logic') {
    return {
      ...base,
      sourceHandle: 'right',
      targetHandle: 'left',
    };
  }

  return base;
}

const APPROX_NODE_W = 240;
const APPROX_NODE_H = 120;
const COLLISION_PAD = 40;

function resolveCollisions(
  inputNodes: Node[],
  mode: LayoutMode,
  lockedId?: string,
): Node[] {
  const nodes = inputNodes.map((n) => ({ ...n, position: { ...n.position } }));
  const rect = (n: Node) => ({
    x1: n.position.x,
    y1: n.position.y,
    x2: n.position.x + APPROX_NODE_W,
    y2: n.position.y + APPROX_NODE_H,
  });
  const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
    a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const a = nodes[i];
        const b = nodes[j];
        if (lockedId && b.id === lockedId) continue;
        if (!overlaps(rect(a), rect(b))) continue;

        const ax = a.position.x + APPROX_NODE_W / 2;
        const ay = a.position.y + APPROX_NODE_H / 2;
        const bx = b.position.x + APPROX_NODE_W / 2;
        const by = b.position.y + APPROX_NODE_H / 2;

        const pushRight = bx >= ax;
        const pushDown = by >= ay;

        const dx = (APPROX_NODE_W + COLLISION_PAD) * (pushRight ? 1 : -1);
        const dy = (APPROX_NODE_H + COLLISION_PAD) * (pushDown ? 1 : -1);

        if (mode === 'orgchart') {
          b.position.x += dx;
        } else if (mode === 'logic') {
          b.position.y += dy;
        } else {
          b.position.y += dy;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return nodes;
}

function getClientPoint(e: unknown): { x: number; y: number } {
  const ev = e as MouseEvent & TouchEvent;
  // TouchEvent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyEv = ev as any;
  if (anyEv?.changedTouches?.[0]) {
    return { x: anyEv.changedTouches[0].clientX, y: anyEv.changedTouches[0].clientY };
  }
  return { x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY };
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
  const canvasMenuRef = useRef<HTMLDivElement>(null);
  const connectStartRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  const isDark = theme === 'dark';

  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);

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

  /* close canvas menu when clicking outside */
  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as EventTarget | null;
      if (!target) return;
      if (canvasMenuRef.current && !canvasMenuRef.current.contains(target as unknown as globalThis.Node)) {
        setCanvasMenu(null);
      }
    };
    if (canvasMenu) {
      document.addEventListener('pointerdown', handleClickOutside, true);
      return () => document.removeEventListener('pointerdown', handleClickOutside, true);
    }
  }, [canvasMenu]);

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

  /* allow nodes to request a snapshot (for label/color edits) */
  useEffect(() => {
    const handler = () => snapshot();
    window.addEventListener('canvasSnapshot', handler);
    return () => window.removeEventListener('canvasSnapshot', handler);
  }, [snapshot]);

  /* global undo/redo so Ctrl+Z works without focusing canvas */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTyping) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  /* global shortcuts: Ctrl+X delete + type-to-edit */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable;
      if (isTyping) return;

      const selected = nodes.find((n) => n.selected);
      if (!selected) return;

      // Ctrl/Cmd+X deletes node
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        snapshot();
        setNodes((nds) => nds.filter((n) => n.id !== selected.id));
        setEdges((eds) => eds.filter((ed) => ed.source !== selected.id && ed.target !== selected.id));
        return;
      }

      // Type-to-edit: printable characters start editing and replace content
      const isPrintable =
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      if (isPrintable) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('nodeStartEdit', {
            detail: { nodeId: selected.id, text: e.key },
          }),
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, snapshot, setNodes, setEdges]);

  /* ── connection ── */
  const onConnect = useCallback(
    (conn: Connection) => {
      snapshot();
      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            ...edgeTemplate(layoutMode, theme),
          },
          eds,
        ),
      );
    },
    [setEdges, snapshot, theme, layoutMode],
  );

  const addChildNodeAt = useCallback(
    (sourceId: string, position: { x: number; y: number }) => {
      snapshot();
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const childId = uid();
      const newNode: Node = {
        id: childId,
        type: 'editable',
        position,
        data: {
          label: 'Child',
          isPortal: false,
          color: (sourceNode?.data as any)?.color ?? '',
        },
      };

      setNodes((nds) => resolveCollisions([...nds, newNode], layoutMode, childId));
      setEdges((eds) =>
        addEdge(
          {
            id: `e-${sourceId}-${childId}`,
            source: sourceId,
            target: childId,
            ...edgeTemplate(layoutMode, theme),
          },
          eds,
        ),
      );
    },
    [layoutMode, nodes, setEdges, setNodes, snapshot, theme],
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

  /* ── right-click canvas → context menu ── */
  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setCanvasMenu({ x: e.clientX, y: e.clientY, flowX: position.x, flowY: position.y });
    },
    [screenToFlowPosition],
  );

  /* ── add node from canvas context menu ── */
  const addNodeAtPosition = useCallback(
    (position: { x: number; y: number }) => {
      snapshot();
      const newNode: Node = {
        id: uid(),
        type: 'editable',
        position,
        data: { label: 'New Node', isPortal: false, color: '' },
      };
      setNodes((nds) => [...nds, newNode]);
      setCanvasMenu(null);
    },
    [setNodes, snapshot],
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
        const parentNode = parentEdge ? nodes.find((n) => n.id === parentEdge.source) : null;
        const siblingId = uid();
        const pos = parentNode
          ? getChildPosition(parentNode, edges.filter((ed) => ed.source === parentNode.id).length, layoutMode)
          : getSiblingPosition(selected, layoutMode);
        const newNode: Node = {
          id: siblingId,
          type: 'editable',
          position: pos,
          data: { label: 'Sibling', isPortal: false, color: (selected.data as any)?.color ?? '' },
        };
        const newEdges = parentEdge
          ? [
              {
                id: `e-${parentEdge.source}-${siblingId}`,
                source: parentEdge.source,
                target: siblingId,
                ...(edgeTemplate(layoutMode, theme) as object),
              },
            ]
          : [];
        setNodes((nds) => resolveCollisions([...nds, newNode], layoutMode, siblingId));
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

      /* Ctrl/Cmd+X → delete node */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        snapshot();
        setNodes((nds) => nds.filter((n) => n.id !== selected.id));
        setEdges((eds) =>
          eds.filter((ed) => ed.source !== selected.id && ed.target !== selected.id),
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
          setNodes((nds) => resolveCollisions([...nds, newNode], layoutMode, childId));
          setEdges((eds) =>
            addEdge(
              {
                id: `e-${nodeId}-${childId}`,
                source: nodeId,
                target: childId,
                ...edgeTemplate(layoutMode, theme),
              },
              eds,
            ),
          );
          break;
        }

        case 'addParent': {
          const parentId = uid();
          const parentPos = { x: node.position.x, y: node.position.y - 150 };
          const newParent: Node = {
            id: parentId,
            type: 'editable',
            position: parentPos,
            data: { label: 'Parent', isPortal: false, color: '' },
          };
          
          // Find all current parent edges of the node
          const currentParentEdges = edges.filter((ed) => ed.target === nodeId);
          
          // Remove old parent edges and add new ones
          const updatedEdges = edges.filter((ed) => ed.target !== nodeId);
          
          // Connect new parent to the node
          const newEdgeToNode = {
            id: `e-${parentId}-${nodeId}`,
            source: parentId,
            target: nodeId,
            ...(edgeTemplate(layoutMode, theme) as object),
          };
          
          // If node had parents before, connect them to new parent
          const newParentEdges = currentParentEdges.map((edge) => ({
            id: `e-${edge.source}-${parentId}`,
            source: edge.source,
            target: parentId,
            ...(edgeTemplate(layoutMode, theme) as object),
          }));
          
          setNodes((nds) => [...nds, newParent]);
          setEdges(() => [...updatedEdges, newEdgeToNode, ...newParentEdges]);
          break;
        }

        case 'addSibling': {
          const siblingId = uid();
          const parentEdge = edges.find((ed) => ed.target === nodeId);
          const parentNode = parentEdge ? nodes.find((n) => n.id === parentEdge.source) : null;
          const pos = parentNode
            ? getChildPosition(parentNode, edges.filter((ed) => ed.source === parentNode.id).length, layoutMode)
            : getSiblingPosition(node, layoutMode);
          const newNode: Node = {
            id: siblingId,
            type: 'editable',
            position: pos,
            data: { label: 'Sibling', isPortal: false, color: (node.data as any)?.color ?? '' },
          };
          const newEdges = parentEdge
            ? [
                {
                  id: `e-${parentEdge.source}-${siblingId}`,
                  source: parentEdge.source,
                  target: siblingId,
                  ...(edgeTemplate(layoutMode, theme) as object),
                },
              ]
            : [];
          setNodes((nds) => resolveCollisions([...nds, newNode], layoutMode, siblingId));
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
        onPaneContextMenu={onPaneContextMenu}
        onConnectStart={(_, params) => {
          connectStartRef.current = { nodeId: params.nodeId ?? null, handleId: params.handleId ?? null };
        }}
        onConnectEnd={(e) => {
          const start = connectStartRef.current;
          connectStartRef.current = null;
          if (!start?.nodeId) return;

          const target = e.target as Element | null;
          const pane = target?.closest?.('.react-flow__pane');
          if (!pane) return;

          const pt = getClientPoint(e);
          const pos = screenToFlowPosition({ x: pt.x, y: pt.y });
          addChildNodeAt(start.nodeId, pos);
        }}
        onNodeDragStart={() => snapshot()}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          ...edgeTemplate(layoutMode, theme),
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

      {/* canvas context menu */}
      {canvasMenu && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={canvasMenuRef}
            className={`fixed z-[9999] min-w-[180px] rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden ${
              isDark ? 'bg-gray-900/95 border-white/10' : 'bg-white/95 border-gray-200'
            }`}
            style={{ left: canvasMenu.x, top: canvasMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                onClick={() => addNodeAtPosition({ x: canvasMenu.flowX, y: canvasMenu.flowY })}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isDark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5v14" />
                </svg>
                Add Node Here
              </button>
            </div>
          </div>,
          document.body,
        )}

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

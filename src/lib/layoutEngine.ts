import dagre from '@dagrejs/dagre';
import { Node, Edge } from 'reactflow';
import { LayoutMode } from '@/types';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

interface LayoutOptions {
  direction: string; // TB, LR, RL, BT
  rankSep: number;
  nodeSep: number;
}

const LAYOUT_PRESETS: Record<LayoutMode, LayoutOptions> = {
  mindmap: { direction: 'LR', rankSep: 140, nodeSep: 80 },
  orgchart: { direction: 'TB', rankSep: 150, nodeSep: 120 },
  logic: { direction: 'LR', rankSep: 170, nodeSep: 120 },
};

export function applyLayout(
  nodes: Node[],
  edges: Edge[],
  mode: LayoutMode,
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const opts = LAYOUT_PRESETS[mode];
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutNodes, edges };
}

import { useEffect, useMemo, useRef } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  getStraightPath,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useInternalNode,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '../ui/Button.jsx';

const APP_NODE_WIDTH = 190;
const APP_NODE_HEIGHT = 52;
const CLIENT_NODE_WIDTH = 130;
const CLIENT_NODE_HEIGHT = 44;
const INFRA_PADDING_X = 80;
const INFRA_PADDING_TOP = 64;
const INFRA_PADDING_BOTTOM = 28;
const INFRA_MIN_WIDTH = 420;
const INFRA_MIN_HEIGHT = 168;
const LAYOUT_X_GAP = 270;
const LAYOUT_Y_GAP = 120;
const INFRA_X = 80;
const INFRA_Y = 36;

function ClientNode() {
  return (
    <>
      <Handle type="source" id="client-out" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="h-full w-full rounded-full border border-slate-300 bg-white text-slate-700 text-xs font-semibold flex items-center justify-center shadow-sm">
        Client
      </div>
    </>
  );
}

function InfraNode() {
  return (
    <>
      <Handle type="target" id="infra-in" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" id="infra-out" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="h-full w-full rounded-xl border-2 border-slate-300 bg-slate-50/60 relative">
        <div className="absolute -top-3 left-3 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
          Our Infra
        </div>
      </div>
    </>
  );
}

const getNodeSize = (node) => ({
  width: node?.measured?.width ?? node?.width ?? node?.style?.width ?? APP_NODE_WIDTH,
  height: node?.measured?.height ?? node?.height ?? node?.style?.height ?? APP_NODE_HEIGHT,
});

const withDynamicArchitectureFrame = (nodes, options = {}) => {
  const { repositionClient = true } = options;
  const appNodes = nodes.filter((n) => n.data?.kind === 'app');
  if (appNodes.length === 0) return nodes;

  const bounds = appNodes.reduce(
    (acc, node) => {
      const size = getNodeSize(node);
      acc.minX = Math.min(acc.minX, node.position.x);
      acc.minY = Math.min(acc.minY, node.position.y);
      acc.maxX = Math.max(acc.maxX, node.position.x + size.width);
      acc.maxY = Math.max(acc.maxY, node.position.y + size.height);
      return acc;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const infraX = bounds.minX - INFRA_PADDING_X;
  const infraY = bounds.minY - INFRA_PADDING_TOP;
  const infraWidth = Math.max(INFRA_MIN_WIDTH, bounds.maxX - bounds.minX + INFRA_PADDING_X * 2);
  const infraHeight = Math.max(
    INFRA_MIN_HEIGHT,
    bounds.maxY - bounds.minY + INFRA_PADDING_TOP + INFRA_PADDING_BOTTOM
  );
  const clientY = infraY + infraHeight / 2 - CLIENT_NODE_HEIGHT / 2;

  return nodes.map((node) => {
    if (node.id === 'infra') {
      return {
        ...node,
        position: { x: infraX, y: infraY },
        style: {
          ...node.style,
          width: infraWidth,
          height: infraHeight,
        },
      };
    }
    if (node.id === 'client') {
      if (!repositionClient) {
        return node;
      }
      return {
        ...node,
        position: {
          x: infraX - 220,
          y: clientY,
        },
      };
    }
    return node;
  });
};

const nodeRect = (node) => {
  const styleWidth = typeof node?.style?.width === 'number' ? node.style.width : undefined;
  const styleHeight = typeof node?.style?.height === 'number' ? node.style.height : undefined;
  const width = node?.measured?.width ?? node?.width ?? styleWidth ?? 1;
  const height = node?.measured?.height ?? node?.height ?? styleHeight ?? 1;
  const absolute = node?.internals?.positionAbsolute ?? node?.position ?? { x: 0, y: 0 };
  return {
    x: absolute.x,
    y: absolute.y,
    width,
    height,
    centerX: absolute.x + width / 2,
    centerY: absolute.y + height / 2,
  };
};

const sideFromPoint = (rect, point) => {
  const left = Math.abs(point.x - rect.x);
  const right = Math.abs(point.x - (rect.x + rect.width));
  const top = Math.abs(point.y - rect.y);
  const bottom = Math.abs(point.y - (rect.y + rect.height));
  const min = Math.min(left, right, top, bottom);
  if (min === left) return Position.Left;
  if (min === right) return Position.Right;
  if (min === top) return Position.Top;
  return Position.Bottom;
};

const rectIntersection = (fromNode, toNode) => {
  const from = nodeRect(fromNode);
  const to = nodeRect(toNode);
  const dx = to.centerX - from.centerX;
  const dy = to.centerY - from.centerY;
  const scale = Math.max(Math.abs(dx) / (from.width / 2), Math.abs(dy) / (from.height / 2)) || 1;

  return {
    x: from.centerX + dx / scale,
    y: from.centerY + dy / scale,
  };
};

function FloatingEdge({
  id,
  source,
  target,
  markerStart,
  markerEnd,
  style,
  label,
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sourcePoint = rectIntersection(sourceNode, targetNode);
  const targetPoint = rectIntersection(targetNode, sourceNode);
  const sourcePos = sideFromPoint(nodeRect(sourceNode), sourcePoint);
  const targetPos = sideFromPoint(nodeRect(targetNode), targetPoint);

  const [path, labelX, labelY] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePos,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: targetPos,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-600"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function FlowWithAutoFit({ initialNodes, initialEdges, onEdgeClickFlow }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);
  const nodeTypes = useMemo(() => ({ clientNode: ClientNode, infraNode: InfraNode }), []);
  const hasAutoLaidOutRef = useRef(false);

  const runAutoLayout = () => {
    setNodes((prevNodes) => {
      const appNodes = prevNodes.filter((n) => n.data?.kind === 'app');
      const nodeIds = appNodes.map((n) => n.id);
      const indegree = new Map(nodeIds.map((id) => [id, 0]));
      const adjacency = new Map(nodeIds.map((id) => [id, []]));
      const layers = new Map(nodeIds.map((id) => [id, 0]));

      edges.forEach((edge) => {
        if (edge.data?.synthetic) return;
        if (edge.data?.isBidirectional) return;
        if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
        adjacency.get(edge.source).push(edge.target);
        indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
      });

      // Keep highly-coupled nodes in the same tier when flow is bidirectional.
      edges.forEach((edge) => {
        if (edge.data?.synthetic) return;
        if (!edge.data?.isBidirectional) return;
        if (!layers.has(edge.source) || !layers.has(edge.target)) return;
        const commonLayer = Math.min(layers.get(edge.source) || 0, layers.get(edge.target) || 0);
        layers.set(edge.source, commonLayer);
        layers.set(edge.target, commonLayer);
      });

      const queue = nodeIds.filter((id) => (indegree.get(id) || 0) === 0);
      const processed = new Set();

      while (queue.length > 0) {
        const id = queue.shift();
        processed.add(id);
        const nextNodes = adjacency.get(id) || [];

        nextNodes.forEach((nextId) => {
          layers.set(nextId, Math.max(layers.get(nextId) || 0, (layers.get(id) || 0) + 1));
          indegree.set(nextId, (indegree.get(nextId) || 0) - 1);
          if ((indegree.get(nextId) || 0) === 0) {
            queue.push(nextId);
          }
        });
      }

      // Cycles or disconnected subgraphs: place any remaining nodes in later columns.
      const maxLayer = Math.max(...Array.from(layers.values()), 0);
      let spillLayer = maxLayer + 1;
      nodeIds.forEach((id) => {
        if (!processed.has(id) && (adjacency.get(id)?.length || 0) > 0) {
          layers.set(id, spillLayer);
          spillLayer += 1;
        }
      });

      const byLayer = new Map();
      appNodes.forEach((node) => {
        const layer = layers.get(node.id) || 0;
        if (!byLayer.has(layer)) byLayer.set(layer, []);
        byLayer.get(layer).push(node);
      });

      const xGap = LAYOUT_X_GAP;
      const yGap = LAYOUT_Y_GAP;
      const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);

      // Topology-aware row ordering (reduces "everything in a line" and some crossings).
      const rowByNode = new Map();
      sortedLayers.forEach((layer) => {
        const layerNodes = byLayer.get(layer) || [];
        layerNodes.sort((a, b) => {
          const parentsA = edges
            .filter((e) => !e.data?.synthetic && e.target === a.id)
            .map((e) => rowByNode.get(e.source))
            .filter((v) => Number.isFinite(v));
          const parentsB = edges
            .filter((e) => !e.data?.synthetic && e.target === b.id)
            .map((e) => rowByNode.get(e.source))
            .filter((v) => Number.isFinite(v));

          const avgA = parentsA.length ? parentsA.reduce((s, v) => s + v, 0) / parentsA.length : 0;
          const avgB = parentsB.length ? parentsB.reduce((s, v) => s + v, 0) / parentsB.length : 0;

          if (avgA !== avgB) return avgA - avgB;

          const degreeA = edges.filter((e) => !e.data?.synthetic && (e.source === a.id || e.target === a.id)).length;
          const degreeB = edges.filter((e) => !e.data?.synthetic && (e.source === b.id || e.target === b.id)).length;
          if (degreeA !== degreeB) return degreeB - degreeA;

          const aLabel = String(a.data?.label || '').toLowerCase();
          const bLabel = String(b.data?.label || '').toLowerCase();
          return aLabel.localeCompare(bLabel);
        });
        layerNodes.forEach((node, index) => rowByNode.set(node.id, index));
      });
      const layerCount = Math.max(sortedLayers.length, 1);
      const maxRows = Math.max(
        ...Array.from(byLayer.values()).map((layerNodes) => layerNodes.length),
        1
      );
      const infraWidth = Math.max(INFRA_MIN_WIDTH, INFRA_PADDING_X * 2 + (layerCount - 1) * xGap + APP_NODE_WIDTH);
      const infraHeight = Math.max(INFRA_MIN_HEIGHT, INFRA_PADDING_TOP + INFRA_PADDING_BOTTOM + (maxRows - 1) * yGap + APP_NODE_HEIGHT);

      const appPositions = new Map(
        appNodes.map((node) => {
          const layer = layers.get(node.id) || 0;
          const layerNodes = byLayer.get(layer) || [];
          const row = layerNodes.findIndex((n) => n.id === node.id);
          const yOffsetRows = (maxRows - layerNodes.length) / 2;
          return [
            node.id,
            {
              x: INFRA_X + INFRA_PADDING_X + sortedLayers.indexOf(layer) * xGap,
              y: INFRA_Y + INFRA_PADDING_TOP + (yOffsetRows + row) * yGap,
            },
          ];
        })
      );

      const nextNodes = prevNodes.map((node) => {
        if (node.id === 'infra') {
          return {
            ...node,
            position: { x: INFRA_X, y: INFRA_Y },
            style: {
              ...node.style,
              width: infraWidth,
              height: infraHeight,
            },
          };
        }
        if (node.id === 'client') {
          return {
            ...node,
            position: {
              x: INFRA_X - 220,
              y: INFRA_Y + infraHeight / 2 - CLIENT_NODE_HEIGHT / 2,
            },
          };
        }
        if (!appPositions.has(node.id)) return node;
        return { ...node, position: appPositions.get(node.id) };
      });

      return withDynamicArchitectureFrame(nextNodes);
    });

    requestAnimationFrame(() => {
      fitView({ duration: 300, padding: 0.2 });
    });
  };

  useEffect(() => {
    // Preserve current dragged positions when possible as topology updates.
    setNodes((prev) => {
      const previousById = new Map(prev.map((node) => [node.id, node]));
      const merged = initialNodes.map((node) => {
        const previous = previousById.get(node.id);
        if (!previous) return node;
        if (node.data?.kind !== 'app') return node;
        return { ...node, position: previous.position };
      });
      return withDynamicArchitectureFrame(merged);
    });
    setEdges(initialEdges);
    hasAutoLaidOutRef.current = false;
  }, [initialNodes, initialEdges, setEdges, setNodes]);

  useEffect(() => {
    if (hasAutoLaidOutRef.current) return;
    if (initialNodes.length === 0) return;
    hasAutoLaidOutRef.current = true;
    runAutoLayout();
  }, [initialNodes.length, runAutoLayout]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      fitView({ duration: 400, padding: 0.2 });
    }
  }, [initialNodes.length, initialEdges.length, fitView]);

  const onNodesChange = (changes) => {
    setNodes((prev) => {
      let next = applyNodeChanges(changes, prev);
      const infraChanged = changes.some((c) => c.id === 'infra' && c.type === 'position' && c.position);

      if (infraChanged) {
        const prevInfra = prev.find((n) => n.id === 'infra');
        const nextInfra = next.find((n) => n.id === 'infra');
        if (prevInfra && nextInfra) {
          const dx = nextInfra.position.x - prevInfra.position.x;
          const dy = nextInfra.position.y - prevInfra.position.y;
          if (dx !== 0 || dy !== 0) {
            next = next.map((node) => {
              if (node.data?.kind !== 'app') return node;
              return {
                ...node,
                position: {
                  x: node.position.x + dx,
                  y: node.position.y + dy,
                },
              };
            });
          }
        }
      }

      const changedIds = new Set(changes.map((c) => c.id).filter(Boolean));
      const appNodeChanged = next.some((node) => node.data?.kind === 'app' && changedIds.has(node.id));
      if (!appNodeChanged) {
        return next;
      }
      return withDynamicArchitectureFrame(next, { repositionClient: false });
    });
  };

  const onEdgesChange = (changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10">
        <Button size="sm" variant="secondary" className="nodrag nopan" onClick={runAutoLayout}>
          Auto Layout
        </Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={(_, edge) => {
          if (edge.data?.synthetic) return;
          onEdgeClickFlow?.(edge.id);
        }}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function ProductDataFlowGraph({ mappedApps, dataFlows, onEdgeClickFlow }) {
  const initialNodes = useMemo(() => {
    const columns = Math.max(Math.min(mappedApps.length, 4), 1);
    const appRows = Math.max(Math.ceil(mappedApps.length / columns), 1);
    const infraWidth = Math.max(
      INFRA_MIN_WIDTH,
      INFRA_PADDING_X * 2 + (columns - 1) * LAYOUT_X_GAP + APP_NODE_WIDTH
    );
    const infraHeight = Math.max(
      INFRA_MIN_HEIGHT,
      INFRA_PADDING_TOP + INFRA_PADDING_BOTTOM + (appRows - 1) * LAYOUT_Y_GAP + APP_NODE_HEIGHT
    );

    const infraNode = {
      id: 'infra',
      type: 'infraNode',
      position: { x: INFRA_X, y: INFRA_Y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: true,
      selectable: true,
      style: {
        width: infraWidth,
        height: infraHeight,
        borderRadius: 14,
        border: '2px solid #cbd5e1',
        background: 'rgba(241, 245, 249, 0.5)',
      },
      data: { kind: 'infra' },
    };

    const clientNode = {
      id: 'client',
      type: 'clientNode',
      data: { kind: 'client' },
      position: { x: INFRA_X - 220, y: INFRA_Y + infraHeight / 2 - CLIENT_NODE_HEIGHT / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Right,
      draggable: true,
      selectable: true,
      width: CLIENT_NODE_WIDTH,
      height: CLIENT_NODE_HEIGHT,
      style: {
        width: CLIENT_NODE_WIDTH,
        height: CLIENT_NODE_HEIGHT,
      },
    };

    const appNodes = mappedApps.map((app, index) => ({
      id: app.id,
      data: { label: app.name || 'Unnamed App', kind: 'app' },
      position: {
        x: INFRA_X + INFRA_PADDING_X + (index % columns) * LAYOUT_X_GAP,
        y: INFRA_Y + INFRA_PADDING_TOP + Math.floor(index / columns) * LAYOUT_Y_GAP,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        borderRadius: 9999,
        border: '1px solid #cbd5e1',
        background: '#ffffff',
        padding: '8px 12px',
        minWidth: APP_NODE_WIDTH,
        textAlign: 'center',
        fontWeight: 600,
        color: '#0f172a',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
      },
    }));

    return [clientNode, infraNode, ...appNodes];
  }, [mappedApps]);

  const initialEdges = useMemo(() => {
    const flowEdges = dataFlows
      .filter((flow) => flow.sourceApplicationId && flow.targetApplicationId)
      .filter((flow) => flow.sourceApplicationId !== flow.targetApplicationId)
      .map((flow) => {
        const isBidirectional = flow.direction === 'bidirectional';
        return {
          id: flow.id,
          source: flow.sourceApplicationId,
          target: flow.targetApplicationId,
          label: flow.flowName || '',
          type: 'floating',
          animated: false,
          style: { stroke: '#6b7280', strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6b7280',
          },
          ...(isBidirectional && {
            markerStart: {
              type: MarkerType.ArrowClosed,
              color: '#6b7280',
            },
          }),
          data: { isBidirectional },
        };
      });

    const clientToInfra = {
      id: 'client-to-infra',
      source: 'client',
      target: 'infra',
      sourceHandle: 'client-out',
      targetHandle: 'infra-in',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#334155', strokeWidth: 1.8 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#334155',
      },
      label: 'Ingress',
      selectable: false,
      focusable: false,
      data: { synthetic: true },
    };

    return [clientToInfra, ...flowEdges];
  }, [dataFlows]);

  return (
    <div className="h-[420px] border border-gray-200 rounded-lg bg-white">
      <ReactFlowProvider>
        <FlowWithAutoFit
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onEdgeClickFlow={onEdgeClickFlow}
        />
      </ReactFlowProvider>
    </div>
  );
}

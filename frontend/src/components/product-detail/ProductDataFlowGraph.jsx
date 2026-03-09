import { useEffect, useMemo } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
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

const nodeRect = (node) => {
  const width = node?.measured?.width ?? node?.width ?? 1;
  const height = node?.measured?.height ?? node?.height ?? 1;
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

  const runAutoLayout = () => {
    setNodes((prevNodes) => {
      const nodeIds = prevNodes.map((n) => n.id);
      const indegree = new Map(nodeIds.map((id) => [id, 0]));
      const adjacency = new Map(nodeIds.map((id) => [id, []]));
      const layers = new Map(nodeIds.map((id) => [id, 0]));

      edges.forEach((edge) => {
        if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) return;
        adjacency.get(edge.source).push(edge.target);
        indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
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
      prevNodes.forEach((node) => {
        const layer = layers.get(node.id) || 0;
        if (!byLayer.has(layer)) byLayer.set(layer, []);
        byLayer.get(layer).push(node);
      });

      byLayer.forEach((layerNodes) => {
        layerNodes.sort((a, b) => {
          const aLabel = String(a.data?.label || '').toLowerCase();
          const bLabel = String(b.data?.label || '').toLowerCase();
          return aLabel.localeCompare(bLabel);
        });
      });

      const xGap = 280;
      const yGap = 130;
      const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);

      return prevNodes.map((node) => {
        const layer = layers.get(node.id) || 0;
        const layerNodes = byLayer.get(layer) || [];
        const row = layerNodes.findIndex((n) => n.id === node.id);
        return {
          ...node,
          position: {
            x: sortedLayers.indexOf(layer) * xGap,
            y: row * yGap,
          },
        };
      });
    });

    requestAnimationFrame(() => {
      fitView({ duration: 300, padding: 0.2 });
    });
  };

  useEffect(() => {
    // Preserve current dragged positions when possible as topology updates.
    setNodes((prev) => {
      const previousById = new Map(prev.map((node) => [node.id, node]));
      return initialNodes.map((node) => {
        const previous = previousById.get(node.id);
        if (!previous) return node;
        return { ...node, position: previous.position };
      });
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setEdges, setNodes]);

  useEffect(() => {
    if (initialNodes.length > 0) {
      fitView({ duration: 400, padding: 0.2 });
    }
  }, [initialNodes.length, initialEdges.length, fitView]);

  const onNodesChange = (changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
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
        onEdgeClick={(_, edge) => onEdgeClickFlow?.(edge.id)}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        edgeTypes={edgeTypes}
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
    const columns = 3;
    const xGap = 250;
    const yGap = 130;

    return mappedApps.map((app, index) => ({
      id: app.id,
      data: { label: app.name || 'Unnamed App' },
      position: {
        x: (index % columns) * xGap,
        y: Math.floor(index / columns) * yGap,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        borderRadius: 10,
        border: '1px solid #d1d5db',
        background: '#ffffff',
        padding: 6,
        minWidth: 170,
      },
    }));
  }, [mappedApps]);

  const initialEdges = useMemo(() => {
    return dataFlows
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
        };
      });
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

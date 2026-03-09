import { useEffect, useMemo, useRef } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  getSmoothStepPath,
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
import {
  FiBox,
  FiGrid,
  FiKey,
  FiUnlock,
  FiSmartphone,
  FiUsers,
} from 'react-icons/fi';
import { FaDatabase, FaNetworkWired } from 'react-icons/fa';
import { MdAltRoute, MdOutlineComputer } from 'react-icons/md';
import { TbApi } from 'react-icons/tb';
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
const CLIENT_X_OFFSET = 240;
const CLIENT_Y_GAP = 16;

const normalizeChannel = (value) => String(value || 'default').trim() || 'default';
const clientIdForChannel = (channel) =>
  `client-${normalizeChannel(channel).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const channelLabel = (channel) => {
  const normalized = normalizeChannel(channel);
  const words = normalized
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return `${words.join(' ')} Client`;
};

const getClientIcon = (channel) => {
  const value = normalizeChannel(channel).toLowerCase();
  if (value.includes('api')) return TbApi;
  if (value.includes('mobile')) return FiSmartphone;
  if (value.includes('web')) return MdOutlineComputer;
  return FiUsers;
};

const getAppIconKey = (rawType) => {
  const value = String(rawType || '').toLowerCase();
  if (!value) return 'unknown';
  if (value.includes('front') || value.includes('ui') || value.includes('web') || value.includes('mobile'))
    return 'frontend';
  if (value.includes('gateway') || value.includes('proxy')) return 'gateway';
  if (
    value.includes('db') ||
    value.includes('database') ||
    value.includes('sql') ||
    value.includes('postgres') ||
    value.includes('mysql') ||
    value.includes('redis')
  )
    return 'database';
  if (value.includes('worker') || value.includes('job')) return 'worker';
  if (value.includes('api') || value.includes('backend') || value.includes('service')) return 'service';
  return 'unknown';
};

const isApiLikeType = (rawType) => {
  const value = String(rawType || '').toLowerCase();
  return value.includes('backend api') || value.includes('internal api') || value.includes('api');
};

const APP_ICON_BY_KEY = {
  frontend: MdOutlineComputer,
  gateway: MdAltRoute,
  database: FaDatabase,
  worker: FaNetworkWired,
  service: TbApi,
  unknown: FiBox,
};

function ClientNode({ data }) {
  const Icon = getClientIcon(data?.channel);
  return (
    <>
      <Handle type="source" id="client-out" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="h-full w-full rounded-full border border-slate-300 bg-white text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm">
        <Icon className="text-slate-600" size={13} />
        <span>{String(data?.label || 'Client')}</span>
      </div>
    </>
  );
}

function AppNode({ data }) {
  const Icon = APP_ICON_BY_KEY[data?.iconKey] || FiGrid;
  const description = String(data?.description || '').trim();
  const hasTooltipDetails = Boolean(data?.appType || description);

  return (
    <>
      <Handle type="target" id="app-in" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" id="app-out" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="group relative h-full w-full flex items-center justify-center gap-1.5 text-slate-900">
        <Icon size={13} className="text-slate-600" />
        <span>{String(data?.label || 'App')}</span>
        {hasTooltipDetails ? (
          <div className="pointer-events-none absolute -top-2 left-1/2 z-20 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white p-2 text-left text-[11px] leading-4 text-slate-700 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {data?.appType ? (
              <div>
                <span className="font-semibold text-slate-900">Type:</span> {data.appType}
              </div>
            ) : null}
            <div className="mt-1">
              <span className="font-semibold text-slate-900">Description:</span>{' '}
              {description.length > 0
                ? description.length > 140
                  ? `${description.slice(0, 140)}...`
                  : description
                : 'No Description Found'}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function EdgeCenterLabel({ label, requiresApiKey, showApiKeyIndicator, x, y }) {
  if (!label && !showApiKeyIndicator) return null;
  return (
    <EdgeLabelRenderer>
      <div
        className="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm"
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          pointerEvents: 'none',
          zIndex: 40,
        }}
      >
        {showApiKeyIndicator ? (
          requiresApiKey ? (
            <FiKey className="text-amber-600" size={11} />
          ) : (
            <FiUnlock className="text-slate-500" size={11} />
          )
        ) : null}
        {label ? <span>{label}</span> : null}
      </div>
    </EdgeLabelRenderer>
  );
}

const pointAlongLine = (fromX, fromY, toX, toY, t = 0.2) => ({
  x: fromX + (toX - fromX) * t,
  y: fromY + (toY - fromY) * t,
});

function InfraNode() {
  return (
    <>
      <Handle type="target" id="infra-in" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" id="infra-out" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="h-full w-full rounded-xl border-2 border-slate-300 bg-slate-50/60 relative">
        <div className="absolute -top-3 right-3 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
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

const computeClientPositions = ({ clientNodes, appNodes, infraX, infraY, infraHeight }) => {
  const appCenterYById = new Map(
    appNodes.map((node) => [node.id, node.position.y + getNodeSize(node).height / 2])
  );
  const fallbackTop =
    infraY +
    infraHeight / 2 -
    (clientNodes.length * CLIENT_NODE_HEIGHT + Math.max(0, clientNodes.length - 1) * CLIENT_Y_GAP) / 2;
  const fallbackStep = CLIENT_NODE_HEIGHT + CLIENT_Y_GAP;

  const desired = clientNodes.map((node, index) => {
    const targets = Array.isArray(node.data?.ingressTargetIds) ? node.data.ingressTargetIds : [];
    const targetYs = targets.map((id) => appCenterYById.get(id)).filter((value) => Number.isFinite(value));
    const centerY = targetYs.length
      ? targetYs.reduce((sum, value) => sum + value, 0) / targetYs.length
      : fallbackTop + index * fallbackStep + CLIENT_NODE_HEIGHT / 2;
    return {
      id: node.id,
      x: infraX - CLIENT_X_OFFSET,
      y: centerY - CLIENT_NODE_HEIGHT / 2,
    };
  });

  const sorted = desired.sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    const minY = sorted[i - 1].y + fallbackStep;
    if (sorted[i].y < minY) sorted[i].y = minY;
  }

  return new Map(sorted.map((item) => [item.id, { x: item.x, y: item.y }]));
};

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
  const clientNodes = nodes.filter((n) => n.data?.kind === 'client');
  const clientPositionById = computeClientPositions({
    clientNodes,
    appNodes,
    infraX,
    infraY,
    infraHeight,
  });

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
    if (node.data?.kind === 'client') {
      if (!repositionClient) {
        return node;
      }
      return {
        ...node,
        position: clientPositionById.get(node.id) || node.position,
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
  data,
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sourcePoint = rectIntersection(sourceNode, targetNode);
  const targetPoint = rectIntersection(targetNode, sourceNode);
  const sourcePos = sideFromPoint(nodeRect(sourceNode), sourcePoint);
  const targetPos = sideFromPoint(nodeRect(targetNode), targetPoint);

  const [path] = getStraightPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePos,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: targetPos,
  });
  const iconPoint = pointAlongLine(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y, 0.1);
  const isInternalFlow = data?.edgeKind === 'internal';
  const resolvedStyle = isInternalFlow
    ? { stroke: '#020617', strokeWidth: 2.8, strokeOpacity: 1 }
    : style;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={resolvedStyle}
      />
      <EdgeCenterLabel
        label={label}
        requiresApiKey={Boolean(data?.requiresApiKey)}
        showApiKeyIndicator={Boolean(data?.showApiKeyIndicator)}
        x={iconPoint.x}
        y={iconPoint.y}
      />
    </>
  );
}

function SmoothApiKeyEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  label,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const iconPoint = pointAlongLine(sourceX, sourceY, targetX, targetY, 0.1);
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={style}
      />
      <EdgeCenterLabel
        label={label}
        requiresApiKey={Boolean(data?.requiresApiKey)}
        showApiKeyIndicator={Boolean(data?.showApiKeyIndicator)}
        x={iconPoint.x}
        y={iconPoint.y}
      />
    </>
  );
}

function FlowWithAutoFit({ initialNodes, initialEdges, onEdgeClickFlow }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);
  const edgeTypes = useMemo(
    () => ({ floating: FloatingEdge, smoothApiKey: SmoothApiKeyEdge }),
    []
  );
  const nodeTypes = useMemo(
    () => ({ clientNode: ClientNode, infraNode: InfraNode, appNode: AppNode }),
    []
  );
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
      const laidOutAppNodes = appNodes.map((node) => ({
        ...node,
        position: appPositions.get(node.id) || node.position,
      }));
      const clientPositionById = computeClientPositions({
        clientNodes: prevNodes.filter((n) => n.data?.kind === 'client'),
        appNodes: laidOutAppNodes,
        infraX: INFRA_X,
        infraY: INFRA_Y,
        infraHeight,
      });

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
        if (node.data?.kind === 'client') {
          return {
            ...node,
            position: clientPositionById.get(node.id) || node.position,
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
      <div className="absolute top-2 left-2 z-10 rounded-md border border-gray-200 bg-white/95 px-2 py-1.5 text-[11px] text-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-2 border-slate-700 bg-white" />
          <span>Internal app</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-[3px] border-dashed border-amber-600 bg-amber-50" />
          <span>External-facing app</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-2 border-dotted border-violet-600 bg-violet-50" />
          <span>Facing not set</span>
        </div>
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

export function ProductDataFlowGraph({
  mappedApps,
  appTypeById = {},
  dataFlows,
  ingressPoints = [],
  onEdgeClickFlow,
}) {
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

    const validAppIds = new Set(mappedApps.map((app) => app.id));
    const channels = Array.from(
      new Set(
        (ingressPoints || [])
          .filter((point) => validAppIds.has(point.applicationId))
          .map((point) => normalizeChannel(point.channel))
      )
    );
    if (channels.length === 0) channels.push('default');
    const clientNodes = channels.map((channel, index) => ({
      id: clientIdForChannel(channel),
      type: 'clientNode',
      data: {
        kind: 'client',
        channel,
        label: channelLabel(channel),
        ingressTargetIds: (ingressPoints || [])
          .filter(
            (point) =>
              validAppIds.has(point.applicationId) &&
              normalizeChannel(point.channel) === normalizeChannel(channel)
          )
          .map((point) => point.applicationId),
      },
      position: {
        x: INFRA_X - CLIENT_X_OFFSET,
        y:
          INFRA_Y +
          infraHeight / 2 -
          (channels.length * CLIENT_NODE_HEIGHT + (channels.length - 1) * CLIENT_Y_GAP) / 2 +
          index * (CLIENT_NODE_HEIGHT + CLIENT_Y_GAP),
      },
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
    }));

    const appNodes = mappedApps.map((app, index) => ({
      id: app.id,
      type: 'appNode',
      data: {
        label: app.name || 'Unnamed App',
        kind: 'app',
        appType: appTypeById[app.id] || '',
        description: app.description || '',
        iconKey: getAppIconKey(appTypeById[app.id]),
      },
      position: {
        x: INFRA_X + INFRA_PADDING_X + (index % columns) * LAYOUT_X_GAP,
        y: INFRA_Y + INFRA_PADDING_TOP + Math.floor(index / columns) * LAYOUT_Y_GAP,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        borderRadius: 9999,
        border:
          app.facing === 'External' || app.facing === 'Both'
            ? '3px dashed #d97706'
            : app.facing === 'Internal'
              ? '2px solid #334155'
              : '2px dotted #7c3aed',
        background:
          app.facing === 'External' || app.facing === 'Both'
            ? '#fffbeb'
            : app.facing === 'Internal'
              ? '#ffffff'
              : '#faf5ff',
        padding: '8px 12px',
        minWidth: APP_NODE_WIDTH,
        textAlign: 'center',
        fontWeight: 600,
        color: '#0f172a',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
      },
    }));

    return [...clientNodes, infraNode, ...appNodes];
  }, [mappedApps, ingressPoints, appTypeById]);

  const initialEdges = useMemo(() => {
    const flowEdges = dataFlows
      .filter((flow) => flow.sourceApplicationId && flow.targetApplicationId)
      .filter((flow) => flow.sourceApplicationId !== flow.targetApplicationId)
      .map((flow) => {
        const isBidirectional = flow.direction === 'bidirectional';
        const targetType = appTypeById[flow.targetApplicationId];
        const showApiKeyIndicator = isApiLikeType(targetType);
        return {
          id: flow.id,
          source: flow.sourceApplicationId,
          target: flow.targetApplicationId,
          label: flow.flowName || '',
          type: 'floating',
          animated: false,
          style: { stroke: '#0f172a', strokeWidth: 2.4, strokeOpacity: 1 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#0f172a',
          },
          ...(isBidirectional && {
            markerStart: {
              type: MarkerType.ArrowClosed,
              color: '#0f172a',
            },
          }),
          zIndex: 20,
          data: {
            isBidirectional,
            requiresApiKey: Boolean(flow.requiresApiKey),
            showApiKeyIndicator,
            edgeKind: 'internal',
          },
        };
      });

    const validAppIds = new Set(mappedApps.map((app) => app.id));
    const ingressEdges = (ingressPoints || [])
      .filter((point) => validAppIds.has(point.applicationId))
      .map((point) => {
        const sourceType = appTypeById[point.applicationId];
        const showApiKeyIndicator = isApiLikeType(sourceType);
        return {
          id: `client-${clientIdForChannel(point.channel)}-to-${point.applicationId}-${point.id || 'p'}`,
          source: clientIdForChannel(point.channel),
          target: point.applicationId,
          sourceHandle: 'client-out',
          targetHandle: 'app-in',
          type: 'smoothApiKey',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.4, strokeOpacity: 0.9 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
          },
          selectable: false,
          focusable: false,
          zIndex: 3,
          data: {
            synthetic: true,
            channel: normalizeChannel(point.channel),
            requiresApiKey: Boolean(point.requiresApiKey),
            showApiKeyIndicator,
          },
        };
      });

    if (ingressEdges.length === 0) {
      ingressEdges.push({
        id: 'client-default-to-infra',
        source: clientIdForChannel('default'),
        target: 'infra',
        sourceHandle: 'client-out',
        targetHandle: 'infra-in',
        type: 'smoothApiKey',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 1.4, strokeOpacity: 0.9 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#94a3b8',
        },
        selectable: false,
        focusable: false,
        zIndex: 3,
        data: { synthetic: true, showApiKeyIndicator: false },
      });
    }

    return [...ingressEdges, ...flowEdges];
  }, [dataFlows, ingressPoints, mappedApps, appTypeById]);

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

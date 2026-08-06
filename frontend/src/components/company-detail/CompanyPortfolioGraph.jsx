import { useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FiBox, FiGrid } from 'react-icons/fi';
import { FaDatabase, FaNetworkWired } from 'react-icons/fa';
import { MdAltRoute, MdOutlineComputer } from 'react-icons/md';
import { TbApi } from 'react-icons/tb';
import { Button } from '../ui/Button.jsx';

const APP_NODE_WIDTH = 190;
const APP_NODE_HEIGHT = 52;
const CLIENT_NODE_WIDTH = 130;
const CLIENT_NODE_HEIGHT = 44;
const GROUP_PAD_X = 48;
const GROUP_PAD_TOP = 44;
const GROUP_PAD_BOTTOM = 28;
const GROUP_TITLE_BAND = 8;
const GRID_GAP_X = 20;
const GRID_GAP_Y = 16;
const GROUP_HORIZONTAL_GAP = 72;
const GROUP_ROW_GAP = 56;
const MAX_ROW_WIDTH = 1280;
/** Fixed left column for ingress clients; products flow to the right only. */
const INGRESS_LANE_WIDTH = 148;
const INGRESS_LANE_GAP = 28;
const START_X = 48;
const START_Y = 40;

const PRODUCT_ROW_START_X = START_X + INGRESS_LANE_WIDTH + INGRESS_LANE_GAP;
const INGRESS_CLIENT_X = START_X + (INGRESS_LANE_WIDTH - CLIENT_NODE_WIDTH) / 2;
/** Prefer a tall, narrow product frame; add columns only after this many stacked apps. */
const MAX_APP_ROWS_PER_PRODUCT_COLUMN = 5;

function productGridColumnCount(n) {
  if (n <= 0) return 1;
  return Math.min(n, Math.ceil(n / MAX_APP_ROWS_PER_PRODUCT_COLUMN));
}

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

const APP_ICON_BY_KEY = {
  frontend: MdOutlineComputer,
  gateway: MdAltRoute,
  database: FaDatabase,
  worker: FaNetworkWired,
  service: TbApi,
  unknown: FiBox,
};

const normalizeChannel = (value) => String(value || 'default').trim() || 'default';

const channelSlug = (channel) =>
  normalizeChannel(channel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

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
  if (value.includes('mobile')) return MdOutlineComputer;
  if (value.includes('web')) return MdOutlineComputer;
  return FiGrid;
};

function appFacingStyle(facing) {
  const f = facing;
  if (f === 'External' || f === 'Both') {
    return {
      border: '3px dashed #d97706',
      background: '#fffbeb',
    };
  }
  if (f === 'Internal') {
    return {
      border: '2px solid #334155',
      background: '#ffffff',
    };
  }
  return {
    border: '2px dotted #7c3aed',
    background: '#faf5ff',
  };
}

function PortfolioGroupNode({ data }) {
  return (
    <div className="h-full w-full rounded-xl border-2 border-slate-300 bg-slate-50/55 relative pointer-events-none">
      <div className="absolute -top-3 left-3 right-3 flex justify-center pointer-events-auto">
        <div className="max-w-[95%] rounded-full border border-slate-300 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-slate-800 shadow-sm truncate">
          <Link
            to={`/products/${data.productId}`}
            className="nodrag nopan text-blue-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {data.label}
          </Link>
          {data.status && data.status !== 'active' ? (
            <span className="ml-1.5 font-normal text-slate-500">({data.status})</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PortfolioClientNode({ data }) {
  const Icon = getClientIcon(data?.channel);
  return (
    <>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div className="h-full w-full rounded-full border border-slate-300 bg-surface text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm">
        <Icon className="text-slate-600" size={13} />
        <span className="truncate px-0.5">{String(data?.label || 'Client')}</span>
      </div>
    </>
  );
}

function PortfolioAppNode({ data }) {
  const Icon = APP_ICON_BY_KEY[data?.iconKey] || FiGrid;
  const description = String(data?.description || '').trim();
  const hasTooltipDetails = Boolean(data?.appType || description);
  const face = appFacingStyle(data?.facing);

  return (
    <div className="group relative h-full w-full flex flex-col items-center justify-center gap-0.5 text-slate-900 px-1 cursor-grab active:cursor-grabbing">
      <Handle
        type="target"
        position={Position.Top}
        id="iface-top-in"
        className="!opacity-0 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="iface-top-out"
        className="!opacity-0 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="iface-bottom-in"
        className="!opacity-0 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="iface-bottom-out"
        className="!opacity-0 !w-2 !h-2"
      />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />
      <div
        className="flex items-center justify-center gap-1.5 w-full rounded-full"
        style={{
          borderRadius: 9999,
          ...face,
          padding: '8px 10px',
          minWidth: APP_NODE_WIDTH - 16,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Icon size={13} className="text-slate-600 shrink-0" />
        <Link
          to={`/applications/${data.applicationId}`}
          className="nodrag nopan text-center text-[13px] font-semibold text-blue-800 hover:underline leading-tight line-clamp-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {String(data?.label || 'App')}
        </Link>
      </div>
      {data?.productMembershipCount > 1 ? (
        <div className="text-[9px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-px pointer-events-none">
          In {data.productMembershipCount} products
        </div>
      ) : null}
      {hasTooltipDetails ? (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-20 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-surface p-2 text-left text-[11px] leading-4 text-slate-700 shadow-md opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
              : '—'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function appMatchesFacing(app, facingFilter) {
  if (facingFilter === 'all') return true;
  const f = app?.facing;
  if (facingFilter === 'internal') return f === 'Internal';
  if (facingFilter === 'external') return f === 'External' || f === 'Both';
  if (facingFilter === 'unset') return !f || (f !== 'Internal' && f !== 'External' && f !== 'Both');
  return true;
}

function parseApplicationInterfacesField(interfacesJson) {
  if (!interfacesJson) return [];
  try {
    const v = JSON.parse(interfacesJson);
    return Array.isArray(v) ? v.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Resolve interface list entries to application ids (ids, names, or { applicationId }). */
function normalizeInterfaceTargets(rawList, applications) {
  if (!rawList || !Array.isArray(rawList)) return [];
  const idSet = new Set(applications.map((a) => a.id));
  const byNameLc = new Map(
    applications
      .filter((a) => a.name)
      .map((a) => [String(a.name).trim().toLowerCase(), a.id])
  );
  const out = [];
  for (const item of rawList) {
    if (item == null) continue;
    let raw =
      typeof item === 'string'
        ? item.trim()
        : typeof item === 'object' && item.applicationId != null
          ? String(item.applicationId).trim()
          : typeof item === 'object' && item.id != null
            ? String(item.id).trim()
            : null;
    if (!raw) continue;
    if (idSet.has(raw)) {
      out.push(raw);
      continue;
    }
    const id = byNameLc.get(raw.toLowerCase());
    if (id) out.push(id);
  }
  return [...new Set(out)];
}

function hasProductDataFlowBetween(dataFlows, productId, appA, appB) {
  return dataFlows.some(
    (f) =>
      f.productId === productId &&
      ((f.sourceApplicationId === appA && f.targetApplicationId === appB) ||
        (f.sourceApplicationId === appB && f.targetApplicationId === appA))
  );
}

/** Absolute center + box for nodes (handles parentId chain). */
function buildNodeAbsLayout(nodes, defaultW, defaultH) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map();
  function absOf(nodeId) {
    if (cache.has(nodeId)) return cache.get(nodeId);
    const node = byId.get(nodeId);
    if (!node) return null;
    let x = node.position.x;
    let y = node.position.y;
    let pid = node.parentId;
    while (pid) {
      const p = byId.get(pid);
      if (!p) break;
      x += p.position.x;
      y += p.position.y;
      pid = p.parentId;
    }
    const w = Number(node.style?.width ?? node.width ?? defaultW);
    const h = Number(node.style?.height ?? node.height ?? defaultH);
    const box = { cx: x + w / 2, cy: y + h / 2, x, y, w, h };
    cache.set(nodeId, box);
    return box;
  }
  return { absOf };
}

/** Pick handle sides so edges follow left→right flow (or vertical when stacked). */
function inferInterfaceEdgePorts(layout, sourceId, targetId) {
  const a = layout.absOf(sourceId);
  const b = layout.absOf(targetId);
  if (!a || !b) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const preferVertical = Math.abs(dy) > Math.abs(dx) * 1.12;
  if (preferVertical) {
    if (dy > 0) {
      return {
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        sourceHandle: 'iface-bottom-out',
        targetHandle: 'iface-top-in',
      };
    }
    return {
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
      sourceHandle: 'iface-top-out',
      targetHandle: 'iface-bottom-in',
    };
  }
  if (dx >= 0) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }
  return { sourcePosition: Position.Left, targetPosition: Position.Right };
}

function membershipCountByApp(mappings) {
  const m = new Map();
  for (const row of mappings) {
    m.set(row.applicationId, (m.get(row.applicationId) || 0) + 1);
  }
  return m;
}

function buildPortfolioGraph({
  applications,
  products,
  mappings,
  dataFlows,
  ingressPoints,
  excludedProductIds,
  facingFilter,
}) {
  const excluded = new Set(excludedProductIds);
  const appById = new Map(applications.map((a) => [a.id, a]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const memberCount = membershipCountByApp(mappings);

  const visibleProductIds = products
    .map((p) => p.id)
    .filter((id) => !excluded.has(id));

  const ingressProductIdSet = new Set(ingressPoints.map((p) => p.productId));
  const productHasIngress = (productId) => ingressProductIdSet.has(productId);
  const visibleProductOrder = new Map(visibleProductIds.map((id, i) => [id, i]));
  /** Products with ingress first (near client column); others follow in original list order. */
  const layoutProductIds = [...visibleProductIds].sort((a, b) => {
    const aIn = productHasIngress(a);
    const bIn = productHasIngress(b);
    if (aIn !== bIn) return aIn ? -1 : 1;
    return visibleProductOrder.get(a) - visibleProductOrder.get(b);
  });

  const scopedNodeId = (applicationId, productId) => `${applicationId}::${productId}`;

  const nodes = [];
  const edges = [];

  const nodeIncluded = new Set();

  let cursorX = PRODUCT_ROW_START_X;
  let cursorY = START_Y;
  let rowMaxHeight = 0;
  let globalMaxBottom = START_Y;

  const placeProductBlock = (productId) => {
    const product = productById.get(productId);
    if (!product) return;

    const productMappings = mappings.filter((x) => x.productId === productId);
    const visibleMappings = productMappings.filter((row) => {
      const app = appById.get(row.applicationId);
      return app && appMatchesFacing(app, facingFilter);
    });

    const n = visibleMappings.length;
    const cols = n === 0 ? 1 : productGridColumnCount(n);
    const rows = n === 0 ? 0 : Math.max(1, Math.ceil(n / cols));

    const innerWidth =
      n === 0 ? 160 : cols * APP_NODE_WIDTH + Math.max(0, cols - 1) * GRID_GAP_X;
    const innerHeight =
      n === 0 ? 0 : rows * APP_NODE_HEIGHT + Math.max(0, rows - 1) * GRID_GAP_Y;
    const groupWidth = GROUP_PAD_X * 2 + innerWidth;
    const groupHeight =
      GROUP_PAD_TOP + GROUP_TITLE_BAND + innerHeight + GROUP_PAD_BOTTOM;

    if (cursorX + groupWidth > START_X + MAX_ROW_WIDTH && cursorX > PRODUCT_ROW_START_X) {
      cursorX = PRODUCT_ROW_START_X;
      cursorY = globalMaxBottom + GROUP_ROW_GAP;
      rowMaxHeight = 0;
    }

    const ingressForProduct = ingressPoints.filter((p) => p.productId === productId);
    const groupX = cursorX;
    const groupY = cursorY;

    const groupId = `group-product-${productId}`;
    nodes.push({
      id: groupId,
      type: 'group',
      position: { x: groupX, y: groupY },
      style: {
        width: groupWidth,
        height: groupHeight,
        zIndex: 0,
      },
      data: {
        label: product.name,
        productId,
        status: product.status,
      },
      draggable: true,
      selectable: true,
    });

    visibleMappings.forEach((row, index) => {
      const app = appById.get(row.applicationId);
      if (!app) return;
      const col = index % cols;
      const r = Math.floor(index / cols);
      const typeLabel = row.componentTypeName || row.customComponentLabel || '';
      const nid = scopedNodeId(row.applicationId, productId);
      nodeIncluded.add(nid);
      nodes.push({
        id: nid,
        type: 'portfolioApp',
        parentId: groupId,
        extent: 'parent',
        position: {
          x: GROUP_PAD_X + col * (APP_NODE_WIDTH + GRID_GAP_X),
          y: GROUP_PAD_TOP + GROUP_TITLE_BAND + r * (APP_NODE_HEIGHT + GRID_GAP_Y),
        },
        draggable: true,
        selectable: true,
        style: {
          width: APP_NODE_WIDTH,
          height: APP_NODE_HEIGHT + (memberCount.get(row.applicationId) > 1 ? 16 : 0),
        },
        data: {
          kind: 'app',
          label: app.name,
          applicationId: app.id,
          productId,
          facing: app.facing,
          description: app.description,
          appType: typeLabel,
          iconKey: getAppIconKey(typeLabel),
          productMembershipCount: memberCount.get(row.applicationId) || 1,
        },
      });
    });

    if (ingressForProduct.length > 0) {
      const channels = Array.from(
        new Set(ingressForProduct.map((p) => normalizeChannel(p.channel)))
      );

      const clientNodesForProduct = [];
      channels.forEach((ch, chIndex) => {
        const clientId = `ingress-${productId}-${channelSlug(ch)}`;
        const centerY =
          groupY +
          groupHeight / 2 -
          (channels.length * CLIENT_NODE_HEIGHT + (channels.length - 1) * 8) / 2 +
          chIndex * (CLIENT_NODE_HEIGHT + 8);

        clientNodesForProduct.push({
          id: clientId,
          type: 'portfolioClient',
          position: {
            x: INGRESS_CLIENT_X,
            y: centerY,
          },
          data: {
            kind: 'client',
            channel: ch,
            label: channelLabel(ch),
          },
          draggable: true,
          selectable: true,
          width: CLIENT_NODE_WIDTH,
          height: CLIENT_NODE_HEIGHT,
          style: { width: CLIENT_NODE_WIDTH, height: CLIENT_NODE_HEIGHT, zIndex: 2 },
        });
      });

      for (const cn of clientNodesForProduct) {
        nodes.push(cn);
        const ch = normalizeChannel(cn.data.channel);
        const points = ingressForProduct.filter((p) => normalizeChannel(p.channel) === ch);
        for (const point of points) {
          const tid = scopedNodeId(point.applicationId, productId);
          if (!nodeIncluded.has(tid)) continue;
          edges.push({
            id: `ing-${point.id}-${tid}`,
            source: cn.id,
            target: tid,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 1.4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
            data: { synthetic: true },
          });
        }
      }
    }

    for (const flow of dataFlows) {
      if (flow.productId !== productId) continue;
      const sid = scopedNodeId(flow.sourceApplicationId, productId);
      const tid = scopedNodeId(flow.targetApplicationId, productId);
      if (!nodeIncluded.has(sid) || !nodeIncluded.has(tid)) continue;
      if (flow.sourceApplicationId === flow.targetApplicationId) continue;
      const isBidirectional = flow.direction === 'bidirectional';
      edges.push({
        id: flow.id,
        source: sid,
        target: tid,
        type: 'smoothstep',
        label: flow.flowName || '',
        animated: false,
        style: { stroke: '#0f172a', strokeWidth: 2.2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        ...(isBidirectional && {
          markerStart: { type: MarkerType.ArrowClosed, color: '#0f172a' },
        }),
        data: { isBidirectional },
      });
    }

    cursorX = groupX + groupWidth + GROUP_HORIZONTAL_GAP;
    rowMaxHeight = Math.max(rowMaxHeight, groupHeight);
    globalMaxBottom = Math.max(globalMaxBottom, groupY + groupHeight);
  };

  for (const pid of layoutProductIds) {
    placeProductBlock(pid);
  }

  const mappedAppIds = new Set(mappings.map((m) => m.applicationId));
  const unmappedApps = applications.filter(
    (a) => !mappedAppIds.has(a.id) && appMatchesFacing(a, facingFilter)
  );

  if (unmappedApps.length > 0) {
    const blockTop = globalMaxBottom + GROUP_ROW_GAP + 48;
    const n = unmappedApps.length;
    const cols = productGridColumnCount(n);
    const rows = Math.max(1, Math.ceil(n / cols));
    const innerHeight = rows * APP_NODE_HEIGHT + Math.max(0, rows - 1) * GRID_GAP_Y;

    unmappedApps.forEach((app, index) => {
      const col = index % cols;
      const r = Math.floor(index / cols);
      const nid = `unmapped-app-${app.id}`;
      nodeIncluded.add(nid);
      nodes.push({
        id: nid,
        type: 'portfolioApp',
        position: {
          x: START_X + col * (APP_NODE_WIDTH + GRID_GAP_X),
          y: blockTop + r * (APP_NODE_HEIGHT + GRID_GAP_Y),
        },
        draggable: true,
        selectable: true,
        style: {
          width: APP_NODE_WIDTH,
          height: APP_NODE_HEIGHT,
        },
        data: {
          kind: 'app',
          label: app.name,
          applicationId: app.id,
          productId: null,
          facing: app.facing,
          description: app.description,
          appType: '',
          iconKey: 'unknown',
          productMembershipCount: 1,
        },
      });
    });

    globalMaxBottom = blockTop + innerHeight;
  }

  const appNodeIds = new Set(nodes.filter((n) => n.type === 'portfolioApp').map((n) => n.id));
  const companyAppIds = new Set(applications.map((a) => a.id));

  const resolveTargetNodeId = (targetAppId, preferredProductId) => {
    const pref = `${targetAppId}::${preferredProductId}`;
    if (preferredProductId && appNodeIds.has(pref)) return pref;
    const unmappedId = `unmapped-app-${targetAppId}`;
    if (appNodeIds.has(unmappedId)) return unmappedId;
    for (const nid of appNodeIds) {
      if (nid.startsWith(`${targetAppId}::`)) return nid;
    }
    return null;
  };

  const nodeLayout = buildNodeAbsLayout(nodes, APP_NODE_WIDTH, APP_NODE_HEIGHT);
  const ifaceDirectedSeen = new Set();
  const addInterfaceEdge = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const key = `${sourceId}>>>${targetId}`;
    if (ifaceDirectedSeen.has(key)) return;
    ifaceDirectedSeen.add(key);
    const ports = inferInterfaceEdgePorts(nodeLayout, sourceId, targetId);
    edges.push({
      id: `iface-${key}`,
      source: sourceId,
      target: targetId,
      type: 'step',
      pathOptions: { borderRadius: 10, offset: 4 },
      animated: false,
      sourcePosition: ports.sourcePosition,
      targetPosition: ports.targetPosition,
      ...(ports.sourceHandle ? { sourceHandle: ports.sourceHandle } : {}),
      ...(ports.targetHandle ? { targetHandle: ports.targetHandle } : {}),
      style: {
        stroke: '#64748b',
        strokeWidth: 1.75,
        strokeDasharray: '6 4',
        zIndex: 1000,
      },
      zIndex: 1000,
      data: { edgeKind: 'interface' },
    });
  };

  for (const m of mappings) {
    if (!visibleProductIds.includes(m.productId)) continue;
    const srcApp = appById.get(m.applicationId);
    if (!srcApp || !appMatchesFacing(srcApp, facingFilter)) continue;
    const srcId = scopedNodeId(m.applicationId, m.productId);
    if (!appNodeIds.has(srcId)) continue;
    const targets = normalizeInterfaceTargets(m.interfaceTargetApplicationIds, applications);
    for (const tid of targets) {
      if (!companyAppIds.has(tid)) continue;
      if (hasProductDataFlowBetween(dataFlows, m.productId, m.applicationId, tid)) continue;
      const tgtId = resolveTargetNodeId(tid, m.productId);
      if (tgtId) addInterfaceEdge(srcId, tgtId);
    }
  }

  for (const app of applications) {
    if (!appMatchesFacing(app, facingFilter)) continue;
    if (mappedAppIds.has(app.id)) continue;
    const srcId = `unmapped-app-${app.id}`;
    if (!appNodeIds.has(srcId)) continue;
    const targets = normalizeInterfaceTargets(parseApplicationInterfacesField(app.interfaces), applications);
    for (const tid of targets) {
      if (!companyAppIds.has(tid)) continue;
      const tgtId = resolveTargetNodeId(tid, '');
      if (tgtId) addInterfaceEdge(srcId, tgtId);
    }
  }

  let hiddenByProductFilter = 0;
  for (const app of applications) {
    const productIdsForApp = new Set(
      mappings.filter((m) => m.applicationId === app.id).map((m) => m.productId)
    );
    if (productIdsForApp.size === 0) continue;
    const anyVisible = [...productIdsForApp].some((pid) => visibleProductIds.includes(pid));
    if (!anyVisible) hiddenByProductFilter += 1;
  }

  let hiddenByFacing = 0;
  for (const app of applications) {
    if (!appMatchesFacing(app, facingFilter)) hiddenByFacing += 1;
  }

  return { nodes, edges, hiddenByProductFilter, hiddenByFacing };
}

function PortfolioFlowInner({ initialNodes, initialEdges }) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    if (initialNodes.length === 0) return;
    const t = requestAnimationFrame(() => {
      fitView({ duration: 350, padding: 0.15 });
    });
    return () => cancelAnimationFrame(t);
  }, [initialNodes, initialEdges, fitView]);

  const onRelayout = useCallback(() => {
    fitView({ duration: 300, padding: 0.15 });
  }, [fitView]);

  const nodeTypes = useMemo(
    () => ({
      group: PortfolioGroupNode,
      portfolioApp: PortfolioAppNode,
      portfolioClient: PortfolioClientNode,
    }),
    []
  );

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10">
        <Button type="button" size="sm" variant="secondary" className="nodrag nopan" onClick={onRelayout}>
          Fit view
        </Button>
      </div>
      <div className="absolute top-2 left-2 z-10 max-w-[200px] rounded-md border border-gray-200 bg-surface/95 px-2 py-1.5 text-[11px] text-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-2 border-slate-700 bg-surface shrink-0" />
          <span>Internal</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-[3px] border-dashed border-amber-600 bg-amber-50 shrink-0" />
          <span>External / both</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-6 rounded border-2 border-dotted border-violet-600 bg-violet-50 shrink-0" />
          <span>Facing not set</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 border-t border-gray-100 pt-1.5">
          <span
            className="inline-block h-0 w-6 shrink-0 border-t-[3px] border-dashed border-slate-500"
            style={{ borderTopStyle: 'dashed' }}
          />
          <span>Declared interface</span>
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function CompanyPortfolioGraph({
  applications = [],
  products = [],
  mappings = [],
  dataFlows = [],
  ingressPoints = [],
  excludedProductIds = [],
  facingFilter = 'all',
}) {
  const excludedKey = excludedProductIds.length
    ? [...excludedProductIds].sort().join('\n')
    : '';

  const { initialNodes, initialEdges, meta } = useMemo(() => {
    const { nodes, edges, hiddenByProductFilter, hiddenByFacing } = buildPortfolioGraph({
      applications,
      products,
      mappings,
      dataFlows,
      ingressPoints,
      excludedProductIds,
      facingFilter,
    });
    return {
      initialNodes: nodes,
      initialEdges: edges,
      meta: { hiddenByProductFilter, hiddenByFacing },
    };
  }, [
    applications,
    products,
    mappings,
    dataFlows,
    ingressPoints,
    excludedKey,
    facingFilter,
  ]);

  if (applications.length === 0 && products.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No applications or products to display yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {(meta.hiddenByProductFilter > 0 || meta.hiddenByFacing > 0) && (
        <p className="text-xs text-gray-600">
          {meta.hiddenByFacing > 0 ? (
            <span>
              {meta.hiddenByFacing} application{meta.hiddenByFacing !== 1 ? 's' : ''} hidden by facing
              filter.{' '}
            </span>
          ) : null}
          {meta.hiddenByProductFilter > 0 ? (
            <span>
              {meta.hiddenByProductFilter} mapped application{meta.hiddenByProductFilter !== 1 ? 's' : ''}{' '}
              only appear in excluded products.
            </span>
          ) : null}
        </p>
      )}
      <div className="h-[520px] border border-gray-200 rounded-lg bg-surface">
        {initialNodes.length === 0 ? (
          <p className="text-sm text-gray-500 p-8 text-center">
            No nodes match the current filters. Try adjusting product or facing filters.
          </p>
        ) : (
          <ReactFlowProvider>
            <PortfolioFlowInner initialNodes={initialNodes} initialEdges={initialEdges} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}

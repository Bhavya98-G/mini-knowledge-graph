import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraph, getEntityDetails, mergeEntities, updateEntity, createRelationship, deleteRelationship, createEntity, deleteEntity, getWorkspaceDetail, renameWorkspace } from '../api';

/* ─── Color palette per entity type ─── */
const TYPE_COLORS = {
    person: '#60a5fa',
    people: '#60a5fa',
    company: '#34d399',
    organization: '#34d399',
    date: '#fbbf24',
    technology: '#a78bfa',
    location: '#f87171',
};

const LEGEND_ITEMS = [
    { type: 'Person', color: '#60a5fa' },
    { type: 'Company', color: '#34d399' },
    { type: 'Date', color: '#fbbf24' },
    { type: 'Technology', color: '#a78bfa' },
    { type: 'Location', color: '#f87171' },
    { type: 'Other', color: '#94a3b8' },
];

function getColor(type) {
    return TYPE_COLORS[type?.toLowerCase()] || '#94a3b8';
}

export default function GraphView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const graphRef = useRef();
    const containerRef = useRef();

    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [workspaceInfo, setWorkspaceInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedEntity, setSelectedEntity] = useState(null);
    const [entityDetail, setEntityDetail] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mergeSelection, setMergeSelection] = useState([]);
    const [merging, setMerging] = useState(false);
    const [toast, setToast] = useState(null);
    const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
    const [hoveredNode, setHoveredNode] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState('');
    const [saving, setSaving] = useState(false);
    const [connectSelection, setConnectSelection] = useState([]);
    const [connectType, setConnectType] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deletingRelId, setDeletingRelId] = useState(null);
    const [showAddEntity, setShowAddEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityType, setNewEntityType] = useState('Person');
    const [addingEntity, setAddingEntity] = useState(false);
    const [renamingWorkspace, setRenamingWorkspace] = useState(false);
    const [workspaceNameInput, setWorkspaceNameInput] = useState('');

    const ENTITY_TYPES = ['Person', 'Company', 'Organization', 'Date', 'Technology', 'Location', 'Other'];

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchGraph = useCallback(async () => {
        setLoading(true);
        try {
            const [graphRes, wsRes] = await Promise.all([
                getGraph(id),
                getWorkspaceDetail(id),
            ]);
            setGraphData(graphRes.data);
            setWorkspaceInfo(wsRes.data);
        } catch {
            showToast('Failed to load graph', 'error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchGraph();
    }, [fetchGraph]);

    // ─── Responsive graph dimensions ───
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setGraphDimensions({ width: rect.width, height: rect.height });
            }
        };
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [loading]);

    // ─── D3 force configuration: push nodes apart ───
    useEffect(() => {
        const fg = graphRef.current;
        if (!fg) return;
        fg.d3Force('charge')?.strength(-250);
        fg.d3Force('link')?.distance(120);
        fg.d3Force('collide', null); // remove default collide if any
        fg.d3ReheatSimulation();
    }, [graphData]);

    /* ─── Node click → open sidebar ─── */
    const handleNodeClick = useCallback(
        async (node, event) => {
            // Ctrl-click = add to connect selection
            if (event.ctrlKey || event.metaKey) {
                setConnectSelection((prev) => {
                    if (prev.find((n) => n.id === node.id)) return prev;
                    if (prev.length >= 2) return [prev[1], node];
                    return [...prev, node];
                });
                setSidebarOpen(true);
                return;
            }

            // Shift-click = add to merge selection
            if (event.shiftKey) {
                setMergeSelection((prev) => {
                    if (prev.find((n) => n.id === node.id)) return prev;
                    if (prev.length >= 2) return [prev[1], node];
                    return [...prev, node];
                });
                setSidebarOpen(true);
                return;
            }

            setSelectedEntity(node);
            setSidebarOpen(true);
            setEntityDetail(null);
            try {
                const res = await getEntityDetails(node.id);
                setEntityDetail(res.data);
            } catch {
                setEntityDetail(null);
                showToast('Failed to load entity details', 'error');
            }
        },
        []
    );

    /* ─── Edit handler ─── */
    const startEditing = () => {
        if (!entityDetail) return;
        setEditName(entityDetail.name);
        setEditType(entityDetail.type);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setEditName('');
        setEditType('');
    };

    const handleSaveEdit = async () => {
        if (!entityDetail) return;
        const trimmedName = editName.trim();
        const trimmedType = editType.trim();
        if (!trimmedName) { showToast('Name cannot be empty', 'error'); return; }
        if (!trimmedType) { showToast('Type cannot be empty', 'error'); return; }
        // No change — just close
        if (trimmedName === entityDetail.name && trimmedType === entityDetail.type) {
            cancelEditing();
            return;
        }
        setSaving(true);
        try {
            const payload = {};
            if (trimmedName !== entityDetail.name) payload.name = trimmedName;
            if (trimmedType !== entityDetail.type) payload.type = trimmedType;
            const res = await updateEntity(entityDetail.id, payload);
            setEntityDetail(res.data);
            setSelectedEntity((prev) => prev ? { ...prev, name: res.data.name, type: res.data.type } : prev);
            // Refresh graph so node label & color update
            setGraphData((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                    n.id === entityDetail.id
                        ? { ...n, name: res.data.name, type: res.data.type }
                        : n
                ),
            }));
            setEditing(false);
            showToast('Entity updated successfully!');
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Update failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    /* ─── Merge handler ─── */
    const handleMerge = async () => {
        if (mergeSelection.length !== 2) return;
        setMerging(true);
        try {
            const res = await mergeEntities(mergeSelection[0].id, mergeSelection[1].id);
            setGraphData(res.data);
            setMergeSelection([]);
            setSidebarOpen(false);
            setEntityDetail(null);
            setSelectedEntity(null);
            setEditing(false);
            showToast('Entities merged successfully!');
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Merge failed', 'error');
        } finally {
            setMerging(false);
        }
    };

    /* ─── Create Relationship handler ─── */
    const handleCreateRelationship = async () => {
        if (connectSelection.length !== 2) return;
        const trimmed = connectType.trim();
        if (!trimmed) { showToast('Please enter a relationship type', 'error'); return; }
        setConnecting(true);
        try {
            const res = await createRelationship(connectSelection[0].id, connectSelection[1].id, trimmed);
            setGraphData(res.data);
            setConnectSelection([]);
            setConnectType('');
            showToast('Relationship created successfully!');
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Failed to create relationship', 'error');
        } finally {
            setConnecting(false);
        }
    };

    /* ─── Delete Entity handler ─── */
    const handleDeleteEntity = async () => {
        if (!entityDetail) return;
        if (!confirm(`Delete "${entityDetail.name}"? This will also remove all its connections and snippets. This cannot be undone.`)) return;
        setDeleting(true);
        try {
            const res = await deleteEntity(entityDetail.id);
            setGraphData(res.data);
            setSidebarOpen(false);
            setSelectedEntity(null);
            setEntityDetail(null);
            setEditing(false);
            showToast('Entity deleted successfully!');
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Delete failed', 'error');
        } finally {
            setDeleting(false);
        }
    };

    /* ─── Delete Relationship handler ─── */
    const handleDeleteRelationship = async (relId) => {
        setDeletingRelId(relId);
        try {
            const res = await deleteRelationship(relId);
            setGraphData(res.data);
            // Re-fetch entity details to refresh the connections list
            const detailRes = await getEntityDetails(entityDetail.id);
            setEntityDetail(detailRes.data);
            showToast('Relationship removed!');
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Failed to remove relationship', 'error');
        } finally {
            setDeletingRelId(null);
        }
    };

    /* ─── Add Entity handler ─── */
    const handleAddEntity = async () => {
        const trimmedName = newEntityName.trim();
        const trimmedType = newEntityType.trim();
        if (!trimmedName) { showToast('Entity name cannot be empty', 'error'); return; }
        if (!trimmedType) { showToast('Entity type cannot be empty', 'error'); return; }
        setAddingEntity(true);
        try {
            const res = await createEntity(parseInt(id), trimmedName, trimmedType);
            setGraphData(res.data);
            setNewEntityName('');
            setNewEntityType('Person');
            setShowAddEntity(false);
            showToast(`Entity "${trimmedName}" created!`);
        } catch (err) {
            // 409 = already exists → jump to the existing node
            if (err?.response?.status === 409) {
                const existing = graphData.nodes.find(
                    (n) => n.name.toLowerCase() === trimmedName.toLowerCase()
                );
                if (existing) {
                    // Pan graph to that node
                    graphRef.current?.centerAt(existing.x, existing.y, 600);
                    graphRef.current?.zoom(2.5, 600);
                    // Open sidebar with entity details
                    setSelectedEntity(existing);
                    setSidebarOpen(true);
                    setEntityDetail(null);
                    setEditing(false);
                    setShowAddEntity(false);
                    setNewEntityName('');
                    try {
                        const detailRes = await getEntityDetails(existing.id);
                        setEntityDetail(detailRes.data);
                    } catch {
                        showToast('Could not load entity details', 'error');
                    }
                    showToast(`"${existing.name}" already exists — jumping to it 📍`, 'info');
                } else {
                    // Exists in DB but not yet in local graphData (edge case)
                    showToast(err.response.data.detail, 'error');
                }
            } else {
                showToast(err?.response?.data?.detail || 'Failed to create entity', 'error');
            }
        } finally {
            setAddingEntity(false);
        }
    };

    const handleRenameWorkspace = async () => {
        const trimmed = workspaceNameInput.trim();
        if (!trimmed) { showToast('Name cannot be empty', 'error'); return; }
        if (workspaceInfo && trimmed === workspaceInfo.name) { setRenamingWorkspace(false); return; }
        setSaving(true);
        try {
            const res = await renameWorkspace(id, trimmed);
            setWorkspaceInfo((prev) => ({ ...prev, name: res.data.name }));
            showToast('Workspace renamed!');
            setRenamingWorkspace(false);
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Rename failed', 'error');
        } finally {
            setSaving(false);
        }
    };


    /* ─── Search filtering ─── */
    const matchedIds = useMemo(() => new Set(
        search.trim()
            ? graphData.nodes
                .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
                .map((n) => n.id)
            : []
    ), [search, graphData.nodes]);
    const isSearching = search.trim().length > 0;
    const matchCount = matchedIds.size;

    /* ─── Node sizing based on connections ─── */
    const maxConnections = useMemo(() =>
        Math.max(1, ...graphData.nodes.map((n) => n.connection_count || 0)),
        [graphData.nodes]
    );

    /* ─── Truncate long labels ─── */
    const truncate = (str, max = 18) =>
        str.length > max ? str.slice(0, max - 1) + '…' : str;

    /* ─── Custom node rendering ─── */
    const paintNode = useCallback(
        (node, ctx, globalScale) => {
            const isHovered = hoveredNode === node.id;
            const label = isHovered ? node.name : truncate(node.name);
            const fontSize = Math.max(11 / globalScale, 2.5);
            const color = getColor(node.type);

            // Make node size dramatically reflect connections
            const connNorm = (node.connection_count || 0) / maxConnections;
            const baseRadius = 6 + connNorm * 20; // Range from 6 to 26
            const radius = Math.max(baseRadius, 5 / globalScale);

            // Dim non-matching nodes during search
            const dimmed = isSearching && !matchedIds.has(node.id);
            const alpha = dimmed ? 0.12 : 1;

            ctx.globalAlpha = alpha;

            // Glow for matched or hovered nodes
            if ((isSearching && matchedIds.has(node.id)) || isHovered) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
                ctx.fillStyle = color + '25';
                ctx.fill();
            }

            // Selected glow
            if (selectedEntity?.id === node.id) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 8, 0, 2 * Math.PI);
                ctx.fillStyle = '#6366f130';
                ctx.fill();
            }

            // Merge selection ring
            if (mergeSelection.find((m) => m.id === node.id)) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2 / globalScale;
                ctx.setLineDash([4 / globalScale, 2 / globalScale]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Connect selection ring (green)
            if (connectSelection.find((c) => c.id === node.id)) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 2 / globalScale;
                ctx.setLineDash([4 / globalScale, 2 / globalScale]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Inner highlight
            ctx.beginPath();
            ctx.arc(node.x - radius * 0.22, node.y - radius * 0.22, radius * 0.35, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fill();

            // ── Label ABOVE the node (so neighboring nodes never cover it) ──
            if (globalScale > 0.4 || isSearching || isHovered || selectedEntity?.id === node.id) {
                ctx.font = `${fontSize}px Inter, sans-serif`;
                const measuredWidth = ctx.measureText(label).width;
                const labelY = node.y - radius - fontSize - 2;
                const padding = 3;

                // Label background pill
                ctx.fillStyle = dimmed ? 'rgba(10,14,26,0.3)' : 'rgba(10,14,26,0.75)';
                const rx = 3 / globalScale;
                const bx = node.x - measuredWidth / 2 - padding;
                const by = labelY - 1;
                const bw = measuredWidth + padding * 2;
                const bh = fontSize + 3;
                ctx.beginPath();
                ctx.roundRect(bx, by, bw, bh, rx);
                ctx.fill();

                // Label text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = dimmed ? '#64748b' : '#f1f5f9';
                ctx.fillText(label, node.x, labelY);
            }

            ctx.globalAlpha = 1;
        },
        [isSearching, matchedIds, selectedEntity, mergeSelection, connectSelection, maxConnections, hoveredNode]
    );

    /* ─── Link painting ─── */
    const paintLink = useCallback(
        (link, ctx, globalScale) => {
            const sourceId = link.source.id ?? link.source;
            const targetId = link.target.id ?? link.target;
            const dimmed = isSearching && !matchedIds.has(sourceId) && !matchedIds.has(targetId);

            ctx.strokeStyle = dimmed ? 'rgba(148,163,184,0.04)' : 'rgba(148,163,184,0.4)';
            ctx.lineWidth = dimmed ? 0.5 : 1.2;
            ctx.beginPath();
            const sx = link.source.x ?? 0;
            const sy = link.source.y ?? 0;
            const tx = link.target.x ?? 0;
            const ty = link.target.y ?? 0;
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Arrow (shifted 70% towards target to not overlap mid-text)
            if (!dimmed) {
                const angle = Math.atan2(ty - sy, tx - sx);
                const arrowLen = 9 / globalScale;
                const arrowX = sx + (tx - sx) * 0.7;
                const arrowY = sy + (ty - sy) * 0.7;

                ctx.beginPath();
                ctx.moveTo(arrowX, arrowY);
                ctx.lineTo(
                    arrowX - arrowLen * Math.cos(angle - Math.PI / 8),
                    arrowY - arrowLen * Math.sin(angle - Math.PI / 8)
                );
                ctx.lineTo(
                    arrowX - arrowLen * Math.cos(angle + Math.PI / 8),
                    arrowY - arrowLen * Math.sin(angle + Math.PI / 8)
                );
                ctx.closePath();
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fill();
            }

            // Edge label (only at sufficient zoom)
            if (!dimmed && link.type && globalScale > 0.8) {
                const mx = (sx + tx) / 2;
                const my = (sy + ty) / 2;
                const edgeFontSize = Math.max(8 / globalScale, 2.5);
                ctx.font = `${edgeFontSize}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(148,163,184,0.7)';
                ctx.fillText(link.type, mx, my - 3 / globalScale);
            }
        },
        [isSearching, matchedIds]
    );

    /* ─── Graph zoom controls ─── */
    const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300);
    const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300);
    const handleCenter = () => {
        // Re-center and reset zoom levels for a more predictable experience
        graphRef.current?.centerAt(0, 0, 500);
        graphRef.current?.zoomToFit(500, 150);
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '96px' }}>
                <div className="spinner" />
                <p className="loading-text" style={{ marginTop: '16px' }}>Loading knowledge graph…</p>
            </div>
        );
    }

    return (
        <>
            {/* Top bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
            }}>
                <div>
                    <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginRight: '8px' }}>
                        ← Back
                    </button>
                    {renamingWorkspace ? (
                        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <input
                                className="input"
                                value={workspaceNameInput}
                                onChange={(e) => setWorkspaceNameInput(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameWorkspace(); if (e.key === 'Escape') setRenamingWorkspace(false); }}
                                style={{ height: '32px', fontSize: '0.9rem', width: '240px' }}
                            />
                            <button className="btn btn-primary" onClick={handleRenameWorkspace} style={{ padding: '4px 10px' }}>✓</button>
                            <button className="btn btn-secondary" onClick={() => setRenamingWorkspace(false)} style={{ padding: '4px 10px' }}>✕</button>
                        </span>
                    ) : (
                        <span
                            style={{ fontSize: '1.25rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-accent)' }}
                            onClick={() => { setWorkspaceNameInput(workspaceInfo?.name || 'Untitled Project'); setRenamingWorkspace(true); }}
                            title="Click to rename"
                        >
                            {workspaceInfo?.name || 'Untitled Project'}
                        </span>
                    )}
                    {workspaceInfo && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '12px' }}>
                            {workspaceInfo.documents?.length} doc{workspaceInfo.documents?.length !== 1 ? 's' : ''} •{' '}
                            {graphData.nodes.length} entities • {graphData.links.length} relationships
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-primary" onClick={() => setShowAddEntity((v) => !v)} title="Add new entity" style={{ padding: '6px 10px' }}>
                        + Entity
                    </button>
                    <button className="btn btn-secondary" onClick={handleZoomIn} title="Zoom In" style={{ padding: '6px 10px' }}>
                        +
                    </button>
                    <button className="btn btn-secondary" onClick={handleZoomOut} title="Zoom Out" style={{ padding: '6px 10px' }}>
                        −
                    </button>
                    <button className="btn btn-secondary" onClick={handleCenter} title="Center & Reset View" style={{ padding: '6px 10px' }}>
                        ⊞
                    </button>
                </div>
            </div>

            {/* Add Entity Form — lives OUTSIDE graph-container to avoid z-index clash */}
            {showAddEntity && (
                <div className="add-entity-bar">
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-accent)', whiteSpace: 'nowrap' }}>
                        ➕ New Entity
                    </span>
                    <input
                        id="new-entity-name"
                        className="input"
                        placeholder="Entity name"
                        value={newEntityName}
                        onChange={(e) => setNewEntityName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntity(); if (e.key === 'Escape') setShowAddEntity(false); }}
                        autoFocus
                        style={{ flex: 1, minWidth: '140px' }}
                    />
                    <select
                        id="new-entity-type"
                        className="input edit-select"
                        value={newEntityType}
                        onChange={(e) => setNewEntityType(e.target.value)}
                        style={{ flex: '0 0 130px' }}
                    >
                        {ENTITY_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={handleAddEntity}
                        disabled={addingEntity || !newEntityName.trim()}
                        style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
                    >
                        {addingEntity ? (
                            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Adding…</>
                        ) : 'Add'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAddEntity(false)} style={{ padding: '8px 12px' }}>
                        ✕
                    </button>
                </div>
            )}

            <div className="graph-page">
                <div className="graph-container" ref={containerRef}>
                    {/* Search toolbar */}
                    <div className="graph-toolbar">
                        <input
                            id="entity-search"
                            className="input"
                            placeholder="🔍 Search entities…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {isSearching && (
                            <span style={{
                                position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
                                fontSize: '0.75rem', color: matchCount > 0 ? 'var(--success)' : 'var(--error)',
                                background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '8px',
                            }}>
                                {matchCount} match{matchCount !== 1 ? 'es' : ''}
                            </span>
                        )}
                    </div>

                    {graphData.nodes.length === 0 ? (
                        <div className="empty-state" style={{ paddingTop: '120px' }}>
                            <div className="icon">🕸️</div>
                            <h3>No entities found</h3>
                            <p>This workspace has no extracted data yet</p>
                        </div>
                    ) : (
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={graphData}
                            nodeId="id"
                            nodeCanvasObject={paintNode}
                            nodePointerAreaPaint={(node, color, ctx) => {
                                const connNorm = (node.connection_count || 0) / maxConnections;
                                const r = 6 + connNorm * 20;
                                ctx.beginPath();
                                ctx.arc(node.x, node.y, Math.max(r, 8), 0, 2 * Math.PI);
                                ctx.fillStyle = color;
                                ctx.fill();
                            }}
                            linkCanvasObject={paintLink}
                            onNodeClick={handleNodeClick}
                            onNodeHover={(node) => setHoveredNode(node?.id || null)}
                            backgroundColor="transparent"
                            width={graphDimensions.width}
                            height={graphDimensions.height}
                            cooldownTime={4000}
                            enableNodeDrag={true}
                            d3AlphaDecay={0.015}
                            d3VelocityDecay={0.25}
                            d3Force="charge"
                            d3ForceStrength={-300}
                            linkDirectionalParticles={0}
                            minZoom={0.3}
                            onEngineStop={() => graphRef.current?.zoomToFit(600, 180)}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-header">
                        <h2>Entity Details</h2>
                        <button
                            className="close-btn"
                            onClick={() => {
                                setSidebarOpen(false);
                                setSelectedEntity(null);
                                setEntityDetail(null);
                                setEditing(false);
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {entityDetail ? (
                        <>
                            {editing ? (
                                /* ─── Edit Mode ─── */
                                <div className="edit-entity-form">
                                    <label className="edit-label" htmlFor="edit-entity-name">Name</label>
                                    <input
                                        id="edit-entity-name"
                                        className="input"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Entity name"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') cancelEditing(); }}
                                    />
                                    <label className="edit-label" htmlFor="edit-entity-type" style={{ marginTop: '12px' }}>Type</label>
                                    <select
                                        id="edit-entity-type"
                                        className="input edit-select"
                                        value={ENTITY_TYPES.map(t => t.toLowerCase()).includes(editType.toLowerCase()) ? editType : '__custom__'}
                                        onChange={(e) => {
                                            if (e.target.value === '__custom__') {
                                                setEditType('');
                                            } else {
                                                setEditType(e.target.value);
                                            }
                                        }}
                                    >
                                        {ENTITY_TYPES.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                        <option value="__custom__">Custom…</option>
                                    </select>
                                    {!ENTITY_TYPES.map(t => t.toLowerCase()).includes(editType.toLowerCase()) && (
                                        <input
                                            id="edit-entity-type-custom"
                                            className="input"
                                            style={{ marginTop: '8px' }}
                                            value={editType}
                                            onChange={(e) => setEditType(e.target.value)}
                                            placeholder="Enter custom type"
                                        />
                                    )}
                                    <div className="edit-actions">
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSaveEdit}
                                            disabled={saving}
                                            id="save-entity-btn"
                                        >
                                            {saving ? (
                                                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
                                            ) : (
                                                '✓ Save'
                                            )}
                                        </button>
                                        <button className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ─── View Mode ─── */
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                        <div className="entity-name" style={{ marginBottom: 0 }}>{entityDetail.name}</div>
                                        <button
                                            className="btn btn-secondary edit-entity-btn"
                                            onClick={startEditing}
                                            title="Edit entity"
                                            id="edit-entity-trigger"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-danger edit-entity-btn"
                                            onClick={handleDeleteEntity}
                                            disabled={deleting}
                                            title="Delete entity"
                                            id="delete-entity-trigger"
                                        >
                                            {deleting ? '…' : '🗑️'}
                                        </button>
                                    </div>
                                    <span className={`entity-type-badge ${entityDetail.type?.toLowerCase()}`}>
                                        {entityDetail.type}
                                    </span>
                                </>
                            )}

                            {/* Relationships connected to this entity */}
                            {entityDetail.relationships?.length > 0 && (
                                <div className="snippet-section" style={{ marginTop: '16px' }}>
                                    <h3>Connections ({entityDetail.relationships.length})</h3>
                                    {entityDetail.relationships.map((r) => (
                                        <div key={r.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '8px 12px', background: 'var(--bg-card)',
                                            borderRadius: 'var(--radius-sm)', marginBottom: '6px',
                                            border: '1px solid var(--border-subtle)', fontSize: '0.82rem',
                                        }}>
                                            <span style={{ color: r.direction === 'outgoing' ? 'var(--success)' : 'var(--info)' }}>
                                                {r.direction === 'outgoing' ? '→' : '←'}
                                            </span>
                                            <span style={{ color: 'var(--text-accent)', fontWeight: 500 }}>{r.type}</span>
                                            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                                {r.direction === 'outgoing' ? r.target_name : r.source_name}
                                            </span>
                                            <span
                                                className="rel-delete-btn"
                                                title="Remove this relationship"
                                                onClick={() => handleDeleteRelationship(r.id)}
                                                style={{
                                                    cursor: deletingRelId === r.id ? 'wait' : 'pointer',
                                                    color: 'var(--error)',
                                                    fontWeight: 700,
                                                    opacity: deletingRelId === r.id ? 0.4 : 0.5,
                                                    fontSize: '0.9rem',
                                                    transition: 'opacity 0.15s',
                                                }}
                                            >
                                                {deletingRelId === r.id ? '⋯' : '×'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="snippet-section">
                                <h3>Source Evidence ({entityDetail.snippets?.length || 0})</h3>
                                {entityDetail.snippets?.length > 0 ? (
                                    entityDetail.snippets.map((s) => (
                                        <div className="snippet-card" key={s.id}>
                                            <div className="snippet-text">{s.source_text}</div>
                                            <div className="snippet-source">📄 {s.document_filename}</div>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No source snippets found.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : selectedEntity ? (
                        <div style={{ textAlign: 'center', padding: '32px' }}>
                            <div className="spinner" />
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                                Loading details…
                            </p>
                        </div>
                    ) : null}

                    {/* Merge Panel */}
                    <div className="merge-panel">
                        <h4>🔗 Merge Entities</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            <strong>Shift+Click</strong> two nodes to select them for merging.
                            The first is <em>kept</em>, the second is <em>merged into</em> it.
                        </p>
                        <div className="merge-selection">
                            {mergeSelection.length === 0 && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No entities selected
                                </span>
                            )}
                            {mergeSelection.map((m, i) => (
                                <div className="merge-entity" key={m.id}>
                                    <span>
                                        {i === 0 ? '✅ Keep: ' : '🗑️ Merge: '}
                                        <strong>{m.name}</strong>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '4px' }}>
                                            ({m.type})
                                        </span>
                                    </span>
                                    <span
                                        style={{ cursor: 'pointer', color: 'var(--error)', fontWeight: 700 }}
                                        onClick={() => setMergeSelection((prev) => prev.filter((_, j) => j !== i))}
                                    >
                                        ×
                                    </span>
                                </div>
                            ))}
                        </div>
                        {mergeSelection.length === 2 && (
                            <div className="merge-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleMerge}
                                    disabled={merging}
                                    id="merge-btn"
                                >
                                    {merging ? (
                                        <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Merging…</>
                                    ) : (
                                        'Merge Entities'
                                    )}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setMergeSelection([])}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Connect / Create Relationship Panel */}
                    <div className="connect-panel">
                        <h4>➕ Connect Entities</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            <strong>Ctrl+Click</strong> two nodes to select source → target,
                            then type the relationship label.
                        </p>
                        <div className="merge-selection">
                            {connectSelection.length === 0 && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    No entities selected
                                </span>
                            )}
                            {connectSelection.map((c, i) => (
                                <div className="connect-entity" key={c.id}>
                                    <span>
                                        {i === 0 ? '🟢 Source: ' : '🔵 Target: '}
                                        <strong>{c.name}</strong>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '4px' }}>
                                            ({c.type})
                                        </span>
                                    </span>
                                    <span
                                        style={{ cursor: 'pointer', color: 'var(--error)', fontWeight: 700 }}
                                        onClick={() => setConnectSelection((prev) => prev.filter((_, j) => j !== i))}
                                    >
                                        ×
                                    </span>
                                </div>
                            ))}
                        </div>
                        {connectSelection.length === 2 && (
                            <div style={{ marginTop: '10px' }}>
                                <div className="connect-preview">
                                    <span className="connect-node-pill source">{connectSelection[0].name}</span>
                                    <span className="connect-arrow">→</span>
                                    <span className="connect-node-pill target">{connectSelection[1].name}</span>
                                    <button
                                        className="btn btn-secondary"
                                        title="Swap direction"
                                        style={{ padding: '2px 8px', fontSize: '0.75rem', marginLeft: '4px' }}
                                        onClick={() => setConnectSelection((prev) => [prev[1], prev[0]])}
                                    >
                                        ⇄
                                    </button>
                                </div>
                                <input
                                    id="relationship-type-input"
                                    className="input"
                                    style={{ marginTop: '10px' }}
                                    placeholder='Relationship type, e.g. "works_at"'
                                    value={connectType}
                                    onChange={(e) => setConnectType(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRelationship(); }}
                                />
                                <div className="merge-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleCreateRelationship}
                                        disabled={connecting || !connectType.trim()}
                                        id="create-relationship-btn"
                                    >
                                        {connecting ? (
                                            <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
                                        ) : (
                                            'Create Relationship'
                                        )}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => { setConnectSelection([]); setConnectType(''); }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center',
                padding: '12px 16px', marginTop: '8px',
                background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)', fontSize: '0.8rem',
            }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Legend:</span>
                {LEGEND_ITEMS.map(({ type, color }) => (
                    <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}40` }} />
                        {type}
                    </span>
                ))}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    💡 Node size = connection count • Click = details / edit • Shift+Click = merge • Ctrl+Click = connect
                </span>
            </div>

            {/* Subtle AI Disclaimer */}
            <div style={{ textAlign: 'center', marginTop: '12px', opacity: 0.5, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>🤖 Knowledge is extracted by AI — results may contain inaccuracies or false positives. Verify with document evidence.</span>
            </div>

            {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
        </>
    );
}

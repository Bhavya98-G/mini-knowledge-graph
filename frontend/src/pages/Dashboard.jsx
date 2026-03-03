import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listWorkspaces, listRunningWorkspaces, uploadFiles, deleteWorkspace, renameWorkspace } from '../api';

/* ── Icons ── */
const IconUpload = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
const IconFile = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
const IconNode = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /></svg>;
const IconLink = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const IconGraph = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>;
const IconTrash = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
const IconEdit = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;

/* ── Terminal processing steps ── */
const PROCESSING_STEPS = [
    { label: 'Parsing document corpus...', type: 'info', delay: 0 },
    { label: 'Tokenization complete → preparing extraction pipeline', type: '', delay: 800 },
    { label: 'Invoking Groq LLM (llama-3.1-70b)...', type: 'info', delay: 1600 },
    { label: 'Normalizing entity surface forms', type: '', delay: 3000 },
    { label: 'Deduplicating entities by semantic similarity', type: '', delay: 4200 },
    { label: 'Extracting relational triples', type: 'info', delay: 5400 },
    { label: 'Running structural graph analysis', type: '', delay: 6600 },
    { label: 'Indexing source provenance snippets', type: '', delay: 7800 },
    { label: 'Assembling knowledge graph topology', type: 'info', delay: 9200 },
    { label: 'Verifying node-edge consistency', type: '', delay: 10500 },
    { label: 'Persisting to PostgreSQL...', type: '', delay: 11800 },
    { label: 'Graph construction complete ✓', type: 'success', delay: 13000 },
];

/* ── Sparkline generator ── */
function WorkspaceSparkline({ entityCount, linkCount }) {
    const max = Math.max(entityCount, linkCount, 1);
    const bars = 8;
    // Generate pseudo-random bars seeded from counts
    const heights = Array.from({ length: bars }, (_, i) => {
        const seed = (entityCount * (i + 1) + linkCount * (i + 3)) % max;
        return Math.max(15, Math.round((seed / max) * 100));
    });
    // Last two bars represent final entity/link density
    heights[bars - 2] = Math.round((entityCount / Math.max(entityCount, 1)) * 80) + 10;
    heights[bars - 1] = 90;

    return (
        <div className="workspace-sparkline">
            {heights.map((h, i) => (
                <div
                    key={i}
                    className="spark-bar"
                    style={{ height: `${h}%` }}
                />
            ))}
        </div>
    );
}

export default function Dashboard() {
    const [workspaces, setWorkspaces] = useState([]);
    const [runningWorkspaces, setRunningWorkspaces] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragover, setDragover] = useState(false);
    const [toast, setToast] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [workspaceName, setWorkspaceName] = useState('');
    const [terminalLines, setTerminalLines] = useState([]);
    const fileInputRef = useRef(null);
    const terminalRef = useRef(null);
    const navigate = useNavigate();

    /* ── Fetch workspaces ── */
    const fetchWorkspaces = useCallback(async (isBg = false) => {
        if (!isBg) setLoading(true);
        try {
            const [completedRes, runningRes] = await Promise.all([
                listWorkspaces(), listRunningWorkspaces()
            ]);
            setWorkspaces(completedRes.data);
            setRunningWorkspaces(runningRes.data);
        } catch {
            if (!isBg) showToast('Failed to load workspaces', 'error');
        } finally {
            if (!isBg) setLoading(false);
        }
    }, []);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    useEffect(() => {
        if (runningWorkspaces.length === 0) return;
        const interval = setInterval(() => fetchWorkspaces(true), 5000);
        return () => clearInterval(interval);
    }, [runningWorkspaces, fetchWorkspaces]);

    /* ── Terminal log animation ── */
    useEffect(() => {
        if (!uploading) { setTerminalLines([]); return; }
        const timers = [];
        PROCESSING_STEPS.forEach((step) => {
            const t = setTimeout(() => {
                setTerminalLines(prev => [...prev, step]);
                if (terminalRef.current) {
                    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                }
            }, step.delay + (uploadProgress < 100 ? 0 : 400));
            timers.push(t);
        });
        return () => timers.forEach(clearTimeout);
    }, [uploading, uploadProgress]);

    /* ── Toast helper ── */
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    /* ── File handlers ── */
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragover(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragover(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragover(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Extract synchronously before the dataTransfer object clears
            const newFiles = Array.from(e.dataTransfer.files);
            setFiles(prev => [...prev, ...newFiles].slice(0, 10));
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            // Extract synchronously before we clear the input
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles].slice(0, 10));
        }
        e.target.value = ''; // Safe to clear now
    };

    const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    /* ── Upload ── */
    const handleUpload = async () => {
        if (files.length < 1) { showToast('Select at least 1 file', 'error'); return; }
        if (files.length > 10) { showToast('Maximum 10 files', 'error'); return; }
        setUploading(true);
        setUploadProgress(0);
        setTerminalLines([]);
        try {
            const res = await uploadFiles(files, workspaceName, (ev) => {
                setUploadProgress(Math.round((ev.loaded * 100) / ev.total));
            });
            showToast(`Workspace #${res.data.id} queued for processing`);
            setFiles([]);
            setWorkspaceName('');
            fetchWorkspaces(true);
        } catch (err) {
            console.error('[Upload Failed]', err);
            let msg = 'Upload failed';
            if (err?.response) {
                const status = err.response.status;
                const detail = err.response.data?.detail;
                if (detail) {
                    msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
                } else {
                    msg = `Server error (${status})`;
                }
            } else if (err?.request) {
                msg = 'Network error — cannot reach the server. Check if backend is running.';
            } else {
                msg = err?.message || 'Unexpected error';
            }
            showToast(msg, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    /* ── Delete ── */
    const handleDelete = async (e, wsId) => {
        e.stopPropagation();
        if (!confirm(`Delete workspace #${wsId}? This cannot be undone.`)) return;
        setDeletingId(wsId);
        try {
            await deleteWorkspace(wsId);
            showToast(`Workspace #${wsId} deleted`);
            fetchWorkspaces();
        } catch { showToast('Delete failed', 'error'); }
        finally { setDeletingId(null); }
    };

    /* ── Rename ── */
    const handleRename = async (wsId) => {
        const trimmed = editingName.trim();
        if (!trimmed) { showToast('Name cannot be empty', 'error'); return; }
        try {
            await renameWorkspace(wsId, trimmed);
            showToast('Workspace renamed');
            setRenamingId(null);
            fetchWorkspaces();
        } catch { showToast('Rename failed', 'error'); }
    };

    const startRenaming = (e, ws) => {
        e.stopPropagation();
        setRenamingId(ws.id);
        setEditingName(ws.name || `Workspace #${ws.id}`);
    };

    return (
        <>
            {/* ── Terminal Processing Overlay ── */}
            {uploading && (
                <div className="terminal-overlay">
                    <div className="terminal-window">
                        <div className="terminal-titlebar">
                            <div className="terminal-dots">
                                <div className="terminal-dot red" />
                                <div className="terminal-dot yellow" />
                                <div className="terminal-dot green" />
                            </div>
                            <span className="terminal-title">
                                SYSTEM PROCESSING — Knowledge Extraction Engine
                            </span>
                        </div>

                        <div className="terminal-body" ref={terminalRef}>
                            {terminalLines.map((line, i) => (
                                <div key={i} className="terminal-line">
                                    <span className="terminal-prompt">›</span>
                                    <span className={`terminal-text ${line.type || ''}`}>
                                        {line.label}
                                    </span>
                                </div>
                            ))}
                            {terminalLines.length < PROCESSING_STEPS.length && (
                                <div className="terminal-line">
                                    <span className="terminal-prompt">›</span>
                                    <span className="terminal-cursor" />
                                </div>
                            )}
                        </div>

                        <div className="terminal-footer">
                            <div className="terminal-progress-bar">
                                <div
                                    className="terminal-progress-fill"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <span className="terminal-pct">
                                {uploadProgress < 100 ? `${uploadProgress}%` : 'PROCESSING'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page Header ── */}
            <div className="section-header">
                <span className="section-eyebrow">Ingestion Hub</span>
                <h1>Workspace Overview</h1>
                <p>Ingest document corpora to build relational intelligence graphs via AI extraction.</p>
            </div>

            {/* ── Upload Zone ── */}
            <div
                id="upload-area"
                className={`upload-area ${dragover ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <span className="upload-icon"><IconUpload /></span>
                <div className="upload-title">Drop document corpus here, or click to select</div>
                <div className="upload-subtitle">PDF · TXT · MD · CSV &nbsp;|&nbsp; 1–10 files per workspace</div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
            </div>

            {/* ── Staged Files ── */}
            {files.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <div className="file-list">
                        {files.map((f, i) => (
                            <span className="file-chip" key={i}>
                                <span className="ext-badge">{f.name.split('.').pop().toUpperCase()}</span>
                                {f.name}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '3px' }}>
                                    {formatFileSize(f.size)}
                                </span>
                                <span
                                    className="remove"
                                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                >✕</span>
                            </span>
                        ))}
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
                        <div>
                            <label className="edit-label" htmlFor="ws-name-input">Workspace Name (Optional)</label>
                            <input
                                id="ws-name-input"
                                type="text"
                                className="input"
                                placeholder="e.g. Q4 Financial Reports"
                                value={workspaceName}
                                onChange={(e) => setWorkspaceName(e.target.value)}
                                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                id="upload-btn"
                                className="btn btn-primary"
                                onClick={handleUpload}
                                disabled={uploading || files.length < 1}
                            >
                                {uploading
                                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Processing…</>
                                    : `Ingest ${files.length} file${files.length > 1 ? 's' : ''}`}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setFiles([])}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Running Workspaces ── */}
            {runningWorkspaces.length > 0 && (
                <div style={{ marginTop: '52px' }}>
                    <div className="section-header" style={{ marginBottom: '0' }}>
                        <span className="section-eyebrow">Active Processes</span>
                        <h1 style={{ fontSize: '1.2rem' }}>Extraction In Progress</h1>
                        <p>AI pipeline is actively processing these workspaces.</p>
                    </div>
                    <div className="workspace-grid">
                        {runningWorkspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className="card workspace-card processing"
                                id={`workspace-running-${ws.id}`}
                            >
                                <div className="workspace-card-accent" style={{ background: 'linear-gradient(180deg, var(--warning), transparent)' }} />
                                <div className="workspace-card-header">
                                    <div>
                                        <div className="workspace-id-label">WS-{String(ws.id).padStart(4, '0')}</div>
                                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                            <span style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                                                EXTRACTING...
                                            </span>
                                        </div>
                                        <div className="card-subtitle" style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span>
                                                {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span>·</span>
                                            <span>{ws.document_count} FILE{ws.document_count !== 1 ? 'S' : ''}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-danger"
                                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                                        onClick={(e) => handleDelete(e, ws.id)}
                                        disabled={deletingId === ws.id}
                                    >
                                        {deletingId === ws.id ? '…' : 'Cancel'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Completed Workspaces ── */}
            <div style={{ marginTop: runningWorkspaces.length > 0 ? '36px' : '52px' }}>
                <div className="section-header" style={{ marginBottom: '0' }}>
                    <span className="section-eyebrow">Intelligence Archive</span>
                    <h1 style={{ fontSize: '1.2rem' }}>Recent Workspaces</h1>
                    <p>Select a workspace to explore its relational graph. Maximum 5 workspaces retained.</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} />
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em' }}>
                            LOADING WORKSPACES...
                        </p>
                    </div>
                ) : workspaces.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><IconGraph /></div>
                        <h3>No workspaces found</h3>
                        <p>Ingest document corpora above to generate your first knowledge graph.</p>
                    </div>
                ) : (
                    <div className="workspace-grid">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className={`card workspace-card ${ws.status === 'running' ? 'processing' : ''}`}
                                id={`workspace-${ws.id}`}
                                onClick={() => { if (ws.status !== 'running') navigate(`/workspace/${ws.id}`); }}
                                style={{
                                    opacity: ws.status === 'running' ? 0.7 : 1,
                                    cursor: ws.status === 'running' ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <div className="workspace-card-accent" />

                                <div className="workspace-card-header">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="workspace-id-label">WS-{String(ws.id).padStart(4, '0')}</div>

                                        {renamingId === ws.id ? (
                                            <div
                                                style={{ display: 'flex', gap: '6px', marginTop: '4px' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    className="input"
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    autoFocus
                                                    style={{ fontSize: '0.82rem', padding: '5px 8px', fontFamily: 'var(--font-mono)' }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRename(ws.id);
                                                        if (e.key === 'Escape') setRenamingId(null);
                                                    }}
                                                />
                                                <button className="btn btn-primary" onClick={() => handleRename(ws.id)} style={{ padding: '4px 10px' }}>✓</button>
                                                <button className="btn btn-secondary" onClick={() => setRenamingId(null)} style={{ padding: '4px 10px' }}>✕</button>
                                            </div>
                                        ) : (
                                            <div className="card-title" style={{ marginTop: '4px' }}>
                                                {ws.name || 'Untitled Project'}
                                            </div>
                                        )}

                                        <div className="card-subtitle" style={{ marginTop: '3px' }}>
                                            {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    </div>

                                    {/* Action buttons — revealed on hover */}
                                    <div className="workspace-card-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={(e) => startRenaming(e, ws)}
                                            disabled={deletingId === ws.id}
                                            title="Rename"
                                        >
                                            <IconEdit />
                                        </button>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ color: 'var(--error)' }}
                                            onClick={(e) => handleDelete(e, ws.id)}
                                            disabled={deletingId === ws.id}
                                            title="Delete"
                                        >
                                            {deletingId === ws.id ? '…' : <IconTrash />}
                                        </button>
                                    </div>
                                </div>

                                {/* Sparkline chart */}
                                <WorkspaceSparkline
                                    entityCount={ws.entity_count || 0}
                                    linkCount={ws.relationship_count || 0}
                                />

                                {/* Stats */}
                                <div className="workspace-stats-row">
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><IconFile /></span>
                                        <strong>{ws.document_count}</strong>
                                        <span>docs</span>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><IconNode /></span>
                                        <strong>{ws.entity_count}</strong>
                                        <span>entities</span>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><IconLink /></span>
                                        <strong>{ws.relationship_count}</strong>
                                        <span>rels</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer style={{ marginTop: 'auto', paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-lg)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em', opacity: 0.6 }}>
                    AI-GENERATED EXTRACTION. VERIFY AGAINST SOURCE MATERIAL.
                </p>
            </footer>

            {/* Toast */}
            {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
        </>
    );
}

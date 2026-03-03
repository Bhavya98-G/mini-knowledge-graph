import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listWorkspaces, listRunningWorkspaces, uploadFiles, deleteWorkspace, renameWorkspace } from '../api';

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
    const [loadingStep, setLoadingStep] = useState(0);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const fetchWorkspaces = useCallback(async (isBg = false) => {
        if (!isBg) setLoading(true);
        try {
            const [completedRes, runningRes] = await Promise.all([
                listWorkspaces(),
                listRunningWorkspaces()
            ]);
            setWorkspaces(completedRes.data);
            setRunningWorkspaces(runningRes.data);
        } catch {
            if (!isBg) showToast('Failed to load workspaces', 'error');
        } finally {
            if (!isBg) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    useEffect(() => {
        if (runningWorkspaces.length === 0) return;

        const interval = setInterval(() => {
            fetchWorkspaces(true);
        }, 5000);
        return () => clearInterval(interval);
    }, [runningWorkspaces, fetchWorkspaces]);

    const LOADING_MESSAGES = [
        "Analyzing documents...",
        "Extracting entities...",
        "Identifying relationships...",
        "Running structural analysis...",
        "Assembling knowledge graph...",
        "Verifying topological logic...",
        "Synthesizing nodes...",
        "Finalizing insight model..."
    ];

    useEffect(() => {
        let interval;
        if (uploading && uploadProgress >= 100) {
            interval = setInterval(() => {
                setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length);
            }, 3500);
        } else {
            setLoadingStep(0);
        }
        return () => clearInterval(interval);
    }, [uploading, uploadProgress, LOADING_MESSAGES.length]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragover(false);
        const dropped = Array.from(e.dataTransfer.files);
        setFiles((prev) => [...prev, ...dropped].slice(0, 10));
    };

    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selected].slice(0, 10));
        e.target.value = '';
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length < 1) {
            showToast('Please select at least 1 file', 'error');
            return;
        }
        if (files.length > 10) {
            showToast('Maximum 10 files allowed', 'error');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const res = await uploadFiles(files, workspaceName, (progressEvent) => {
                const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(pct);
            });
            showToast(`Workspace #${res.data.id} queued for processing!`);
            setFiles([]);
            setWorkspaceName('');
            fetchWorkspaces(true);
        } catch (err) {
            showToast(err?.response?.data?.detail || 'Upload failed', 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (e, wsId) => {
        e.stopPropagation();
        if (!confirm(`Delete workspace #${wsId}? This cannot be undone.`)) return;
        setDeletingId(wsId);
        try {
            await deleteWorkspace(wsId);
            showToast(`Workspace #${wsId} deleted`);
            fetchWorkspaces();
        } catch {
            showToast('Delete failed', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const handleRename = async (wsId) => {
        const trimmed = editingName.trim();
        if (!trimmed) {
            showToast('Name cannot be empty', 'error');
            return;
        }
        try {
            await renameWorkspace(wsId, trimmed);
            showToast('Workspace renamed');
            setRenamingId(null);
            fetchWorkspaces();
        } catch {
            showToast('Rename failed', 'error');
        }
    };

    const startRenaming = (e, ws) => {
        e.stopPropagation();
        setRenamingId(ws.id);
        setEditingName(ws.name || `Workspace #${ws.id}`);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <>
            {uploading && (
                <div className="loading-overlay ai-extraction-overlay">
                    <div className="ai-loader-visual">
                        <div className="ai-brain-pulse"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg></div>
                        <div className="ai-synapse-ring"></div>
                        <div className="ai-synapse-ring second"></div>
                    </div>

                    <div className="ai-loading-content">
                        <span className="ai-loading-title">
                            {uploadProgress < 100 ? 'Uploading Files' : 'Processing Data'}
                        </span>
                        <p className="ai-loading-subtitle">
                            {uploadProgress < 100
                                ? `Transferring your data… ${uploadProgress}%`
                                : LOADING_MESSAGES[loadingStep]}
                        </p>
                    </div>

                    <div className="ai-progress-container">
                        <div className="ai-progress-bar">
                            <div
                                className="ai-progress-fill"
                                style={{ width: uploadProgress < 100 ? `${uploadProgress}%` : '100%' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="section-header">
                <h1>Overview</h1>
                <p>Upload and process documents to extract entities and build your knowledge graph.</p>
            </div>

            {/* Upload Area */}
            <div
                id="upload-area"
                className={`upload-area ${dragover ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
                onDragLeave={() => setDragover(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <span className="upload-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg></span>
                <div className="upload-title">Drop your documents here or click to select files</div>
                <div className="upload-subtitle">
                    Supports PDF, TXT, MD, CSV • 1–10 files per workspace
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
            </div>

            {files.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                    <div className="file-list">
                        {files.map((f, i) => (
                            <span className="file-chip" key={i}>
                                <span style={{ fontWeight: 600, marginRight: '6px' }}>{f.name.split('.').pop().toUpperCase()}</span> {f.name}
                                <span style={{ color: 'var(--text-muted)', marginLeft: '4px', fontSize: '0.7rem' }}>
                                    ({formatFileSize(f.size)})
                                </span>
                                <span className="remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                                    ×
                                </span>
                            </span>
                        ))}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Workspace Name (Optional)"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            style={{ maxWidth: '400px', width: '100%', padding: '10px 14px', fontSize: '1rem' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                            id="upload-btn"
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={uploading || files.length < 1}
                        >
                            {uploading ? (
                                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing…</>
                            ) : (
                                `Process ${files.length} file${files.length > 1 ? 's' : ''}`
                            )}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setFiles([])}>
                            Clear All
                        </button>

                    </div>
                </div>
            )}

            {/* Running Workspaces */}
            {runningWorkspaces.length > 0 && (
                <div style={{ marginTop: '48px' }}>
                    <div className="section-header">
                        <h1 style={{ fontSize: '1.4rem' }}>Processing Workspaces</h1>
                        <p>These workspaces are currently being extracted by AI</p>
                    </div>
                    <div className="workspace-grid">
                        {runningWorkspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className={`card workspace-card processing`}
                                id={`workspace-running-${ws.id}`}
                                style={{
                                    opacity: 0.7,
                                    cursor: 'not-allowed'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div className="card-title" style={{ flex: 1, paddingRight: '12px', marginTop: '2px' }}>
                                        <span style={{ color: 'var(--text-accent)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                            Processing...
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            className="btn btn-danger"
                                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                            onClick={(e) => handleDelete(e, ws.id)}
                                            disabled={deletingId === ws.id}
                                            title="Cancel & Delete"
                                        >
                                            {deletingId === ws.id ? '...' : 'Cancel'}
                                        </button>
                                    </div>
                                </div>

                                <div className="card-subtitle" style={{ marginBottom: '12px' }}>
                                    {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Workspaces */}
            <div style={{ marginTop: runningWorkspaces.length > 0 ? '32px' : '48px' }}>
                <div className="section-header">
                    <h1 style={{ fontSize: '1.4rem' }}>Recent Workspaces</h1>
                    <p>Click to explore the knowledge graph • Maximum 5 workspaces (oldest auto-deleted)</p>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px' }}>
                        <div className="spinner" />
                    </div>
                ) : workspaces.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div>
                        <h3>No workspaces yet</h3>
                        <p>Upload some documents above to begin</p>
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
                                    cursor: ws.status === 'running' ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    {renamingId === ws.id ? (
                                        <div style={{ display: 'flex', gap: '8px', flex: 1, marginRight: '12px' }} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                className="input"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                autoFocus
                                                style={{ fontSize: '0.9rem', padding: '6px 10px', width: '100%' }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRename(ws.id);
                                                    if (e.key === 'Escape') setRenamingId(null);
                                                }}
                                            />
                                            <button className="btn btn-primary" onClick={() => handleRename(ws.id)} style={{ padding: '6px 12px' }}>✓</button>
                                            <button className="btn btn-secondary" onClick={() => setRenamingId(null)} style={{ padding: '6px 12px' }}>✕</button>
                                        </div>
                                    ) : (
                                        <div className="card-title" style={{ flex: 1, paddingRight: '12px', marginTop: '2px' }}>
                                            {ws.name || 'Untitled Project'}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                            onClick={(e) => startRenaming(e, ws)}
                                            disabled={deletingId === ws.id}
                                            title="Rename workspace"
                                        >
                                            Rename
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                            onClick={(e) => handleDelete(e, ws.id)}
                                            disabled={deletingId === ws.id}
                                            title="Delete workspace"
                                        >
                                            {deletingId === ws.id ? '...' : 'Delete'}
                                        </button>
                                    </div>
                                </div>

                                <div className="card-subtitle" style={{ marginBottom: '12px' }}>
                                    {new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                    paddingTop: '20px',
                                    marginTop: 'auto',
                                    borderTop: '1px dashed var(--border-subtle)',
                                }}>
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></span> <strong>{ws.document_count}</strong>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg></span> <strong>{ws.entity_count}</strong>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></span> <strong>{ws.relationship_count}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer style={{ marginTop: 'auto', paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-lg)', textAlign: 'center', opacity: 0.4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <p>AI-generated extraction may contain errors. Please verify results directly against the source material.</p>
            </footer>

            {toast && (
                <div className={`toast ${toast.type}`}>{toast.message}</div>
            )}
        </>
    );
}

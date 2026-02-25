import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listWorkspaces, uploadFiles, deleteWorkspace, renameWorkspace } from '../api';

export default function Dashboard() {
    const [workspaces, setWorkspaces] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragover, setDragover] = useState(false);
    const [toast, setToast] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [loadingStep, setLoadingStep] = useState(0);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const fetchWorkspaces = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listWorkspaces();
            setWorkspaces(res.data);
        } catch {
            showToast('Failed to load workspaces', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const LOADING_MESSAGES = [
        "Reading your files...",
        "Identifying key entities...",
        "Discovering hidden relationships...",
        "Consulting the AI core...",
        "Mapping high-dimensional connections...",
        "Structuring the knowledge graph...",
        "Synthesizing logical edges...",
        "Finalizing the web of insights..."
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
        if (files.length < 3) {
            showToast('Please select at least 3 files', 'error');
            return;
        }
        if (files.length > 10) {
            showToast('Maximum 10 files allowed', 'error');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const res = await uploadFiles(files, (progressEvent) => {
                const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(pct);
            });
            showToast(`Workspace #${res.data.id} created with ${res.data.entity_count} entities!`);
            setFiles([]);
            fetchWorkspaces();
            navigate(`/workspace/${res.data.id}`);
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
                        <div className="ai-brain-pulse">🧠</div>
                        <div className="ai-synapse-ring"></div>
                        <div className="ai-synapse-ring second"></div>
                    </div>

                    <div className="ai-loading-content">
                        <span className="ai-loading-title">
                            {uploadProgress < 100 ? 'Uploading Knowledge' : 'Artificial Intelligence is Reasoning'}
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
                <h1>Knowledge Graph Studio</h1>
                <p>Upload documents to extract entities and relationships automatically using AI</p>
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
                <span className="upload-icon">📄</span>
                <div className="upload-title">Drop files here or click to browse</div>
                <div className="upload-subtitle">
                    Supports PDF, TXT, MD, CSV • 3–10 files per workspace
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
                                {f.name.endsWith('.pdf') ? '📕' : '📄'} {f.name}
                                <span style={{ color: 'var(--text-muted)', marginLeft: '4px', fontSize: '0.7rem' }}>
                                    ({formatFileSize(f.size)})
                                </span>
                                <span className="remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                                    ×
                                </span>
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                            id="upload-btn"
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={uploading || files.length < 3}
                        >
                            {uploading ? (
                                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing…</>
                            ) : (
                                `🚀 Create Knowledge Graph (${files.length} file${files.length > 1 ? 's' : ''})`
                            )}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setFiles([])}>
                            Clear All
                        </button>
                        {files.length < 3 && (
                            <span style={{ fontSize: '0.82rem', color: 'var(--warning)' }}>
                                ⚠️ Add {3 - files.length} more file{3 - files.length > 1 ? 's' : ''} (minimum 3 required)
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Workspaces */}
            <div style={{ marginTop: '48px' }}>
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
                        <div className="icon">🌐</div>
                        <h3>No workspaces yet</h3>
                        <p>Upload some documents above to get started</p>
                    </div>
                ) : (
                    <div className="workspace-grid">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className="card workspace-card"
                                id={`workspace-${ws.id}`}
                                onClick={() => navigate(`/workspace/${ws.id}`)}
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
                                            {ws.name === "Naming in progress..." ? (
                                                <span style={{ color: 'var(--text-accent)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                                    Naming Project...
                                                </span>
                                            ) : (
                                                ws.name || 'Untitled Project'
                                            )}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ width: '30px', height: '30px', padding: 0, fontSize: '0.8rem' }}
                                            onClick={(e) => startRenaming(e, ws)}
                                            disabled={deletingId === ws.id}
                                            title="Rename workspace"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            style={{ width: '30px', height: '30px', padding: 0, fontSize: '0.8rem' }}
                                            onClick={(e) => handleDelete(e, ws.id)}
                                            disabled={deletingId === ws.id}
                                            title="Delete workspace"
                                        >
                                            {deletingId === ws.id ? '…' : '🗑️'}
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
                                        <span className="stat-icon">📄</span> <strong>{ws.document_count}</strong>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon">🔵</span> <strong>{ws.entity_count}</strong>
                                    </div>
                                    <div className="workspace-stat">
                                        <span className="stat-icon">🔗</span> <strong>{ws.relationship_count}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer style={{ marginTop: 'auto', paddingTop: 'var(--space-2xl)', paddingBottom: 'var(--space-lg)', textAlign: 'center', opacity: 0.4, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <p>🤖 AI-generated results may be inaccurate. Always compare with source documents for verification.</p>
            </footer>

            {toast && (
                <div className={`toast ${toast.type}`}>{toast.message}</div>
            )}
        </>
    );
}

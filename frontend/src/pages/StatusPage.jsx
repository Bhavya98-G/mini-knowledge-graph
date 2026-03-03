import { useState, useEffect, useCallback } from 'react';
import { healthCheck, getStats } from '../api';

export default function StatusPage() {
    const [status, setStatus] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);

    const runCheck = useCallback(async () => {
        setLoading(true);
        try {
            const [healthRes, statsRes] = await Promise.all([
                healthCheck(),
                getStats(),
            ]);
            setStatus(healthRes.data);
            setStats(statsRes.data);
            setLastChecked(new Date());
        } catch {
            setStatus({ db: 'error', llm: 'error' });
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        runCheck();
    }, [runCheck]);

    if (loading && !status) {
        return (
            <div style={{ textAlign: 'center', padding: '96px' }}>
                <div className="spinner" />
                <p className="loading-text" style={{ marginTop: '16px' }}>
                    Checking system health…
                </p>
            </div>
        );
    }

    const allOk = status?.db === 'ok' && status?.llm === 'ok';

    return (
        <>
            <div className="section-header">
                <h1>System Status</h1>
                <p>
                    Real-time health check of all system components
                    {lastChecked && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '12px' }}>
                            Last checked: {lastChecked.toLocaleTimeString()}
                        </span>
                    )}
                </p>
            </div>

            <div className="status-grid">
                <div className="card status-card">
                    <div className="status-icon">
                        {status?.db === 'ok' ? (
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--success)', margin: '0 auto', boxShadow: '0 0 10px var(--success)' }} />
                        ) : (
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--error)', margin: '0 auto', boxShadow: '0 0 10px var(--error)' }} />
                        )}
                    </div>
                    <div className="status-label">PostgreSQL Database</div>
                    <div className={`status-value ${status?.db}`} id="status-db">
                        {status?.db === 'ok' ? 'Connected' : 'Disconnected'}
                    </div>
                </div>

                <div className="card status-card">
                    <div className="status-icon">
                        {status?.llm === 'ok' ? (
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--success)', margin: '0 auto', boxShadow: '0 0 10px var(--success)' }} />
                        ) : (
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--error)', margin: '0 auto', boxShadow: '0 0 10px var(--error)' }} />
                        )}
                    </div>
                    <div className="status-label">Groq LLM API</div>
                    <div className={`status-value ${status?.llm}`} id="status-llm">
                        {status?.llm === 'ok' ? 'Reachable' : 'Unreachable'}
                    </div>
                </div>

                <div className="card status-card">
                    <div className="status-icon">
                        {allOk ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--error)' }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                    </div>
                    <div className="status-label">Overall Health</div>
                    <div className={`status-value ${allOk ? 'ok' : 'error'}`} id="status-overall">
                        {allOk ? 'All Systems Operational' : 'Degraded'}
                    </div>
                </div>
            </div>

            {/* Platform Stats */}
            {stats && (
                <div style={{ marginTop: '40px' }}>
                    <div className="section-header">
                        <h1 style={{ fontSize: '1.4rem' }}>Platform Statistics</h1>
                        <p>Aggregate data across all workspaces</p>
                    </div>

                    <div className="status-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg></div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_workspaces}
                            </div>
                            <div className="status-label">Workspaces</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_documents}
                            </div>
                            <div className="status-label">Documents</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /></svg></div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_entities}
                            </div>
                            <div className="status-label">Entities</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_relationships}
                            </div>
                            <div className="status-label">Relationships</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg></div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_snippets}
                            </div>
                            <div className="status-label">Source Snippets</div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button
                    className="btn btn-secondary"
                    onClick={runCheck}
                    disabled={loading}
                >
                    {loading ? 'Checking...' : 'Refresh Status'}
                </button>
            </div>
        </>
    );
}

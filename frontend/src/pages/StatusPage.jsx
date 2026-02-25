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
                        {status?.db === 'ok' ? '🟢' : '🔴'}
                    </div>
                    <div className="status-label">PostgreSQL Database</div>
                    <div className={`status-value ${status?.db}`} id="status-db">
                        {status?.db === 'ok' ? 'Connected' : 'Disconnected'}
                    </div>
                </div>

                <div className="card status-card">
                    <div className="status-icon">
                        {status?.llm === 'ok' ? '🟢' : '🔴'}
                    </div>
                    <div className="status-label">Groq LLM API</div>
                    <div className={`status-value ${status?.llm}`} id="status-llm">
                        {status?.llm === 'ok' ? 'Reachable' : 'Unreachable'}
                    </div>
                </div>

                <div className="card status-card">
                    <div className="status-icon">
                        {allOk ? '✅' : '⚠️'}
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
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}>📁</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_workspaces}
                            </div>
                            <div className="status-label">Workspaces</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}>📄</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_documents}
                            </div>
                            <div className="status-label">Documents</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}>🔵</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_entities}
                            </div>
                            <div className="status-label">Entities</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}>🔗</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {stats.total_relationships}
                            </div>
                            <div className="status-label">Relationships</div>
                        </div>

                        <div className="card status-card">
                            <div className="status-icon" style={{ fontSize: '1.8rem' }}>📝</div>
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
                    {loading ? 'Checking…' : '🔄 Refresh Now'}
                </button>
            </div>
        </>
    );
}

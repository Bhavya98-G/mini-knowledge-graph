import { useState, useEffect, useCallback } from 'react';
import { healthCheck, getStats } from '../api';

/* ── Icons ── */
const IconDb = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></svg>;
const IconBrain = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.775 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.775 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M17.599 6.5a3 3 0 0 0 .399-1.375" /><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" /><path d="M3.477 10.896a4 4 0 0 1 .585-.396" /><path d="M19.938 10.5a4 4 0 0 1 .585.396" /></svg>;
const IconShield = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
const IconWorkspace = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
const IconDoc = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
const IconNode = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="10" opacity="0.2" /></svg>;
const IconLink = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
const IconSnippet = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>;
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;

export default function StatusPage() {
    const [status, setStatus] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);

    const runCheck = useCallback(async () => {
        setLoading(true);
        try {
            const [healthRes, statsRes] = await Promise.all([healthCheck(), getStats()]);
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

    useEffect(() => { runCheck(); }, [runCheck]);

    if (loading && !status) {
        return (
            <div style={{ textAlign: 'center', padding: '96px', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                    RUNNING DIAGNOSTICS...
                </p>
            </div>
        );
    }

    const allOk = status?.db === 'ok' && status?.llm === 'ok';

    const healthItems = [
        { icon: <IconDb />, label: 'PostgreSQL Database', key: 'db', okText: 'Connected', errText: 'Disconnected' },
        { icon: <IconBrain />, label: 'Groq LLM API', key: 'llm', okText: 'Reachable', errText: 'Unreachable' },
        { icon: <IconShield />, label: 'Overall Health', key: '_all', okText: 'All Systems Operational', errText: 'Degraded' },
    ];

    const statItems = stats ? [
        { icon: <IconWorkspace />, label: 'Workspaces', value: stats.total_workspaces },
        { icon: <IconDoc />, label: 'Documents', value: stats.total_documents },
        { icon: <IconNode />, label: 'Entities', value: stats.total_entities },
        { icon: <IconLink />, label: 'Relationships', value: stats.total_relationships },
        { icon: <IconSnippet />, label: 'Source Snippets', value: stats.total_snippets },
    ] : [];

    return (
        <>
            {/* ── Page Header ── */}
            <div className="section-header">
                <span className="section-eyebrow">System Diagnostics</span>
                <h1>Platform Status</h1>
                <p style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    Real-time health check of all system components.
                    {lastChecked && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            LAST CHECK · {lastChecked.toLocaleTimeString()}
                        </span>
                    )}
                </p>
            </div>

            {/* ── Overall banner ── */}
            <div
                style={{
                    padding: '16px 24px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${allOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    background: allOk ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: 'var(--space-xl)',
                }}
            >
                <div
                    style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: allOk ? 'var(--success)' : 'var(--error)',
                        boxShadow: `0 0 12px ${allOk ? 'var(--success)' : 'var(--error)'}`,
                        animation: allOk ? 'statusPulse 2s ease-in-out infinite' : 'none',
                        flexShrink: 0,
                    }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: allOk ? 'var(--success)' : 'var(--error)' }}>
                    {allOk ? '✓ ALL SYSTEMS OPERATIONAL' : '⚠ SYSTEM DEGRADED — CHECK INDIVIDUAL SERVICES'}
                </span>
            </div>

            {/* ── Service Health Cards ── */}
            <div className="status-grid">
                {healthItems.map((item) => {
                    const isOk = item.key === '_all' ? allOk : status?.[item.key] === 'ok';
                    return (
                        <div key={item.label} className="card status-card">
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: isOk ? 'var(--success)' : 'var(--error)', opacity: 0.8 }}>
                                {item.icon}
                            </div>
                            <div
                                className="status-indicator"
                                style={{ background: isOk ? 'var(--success)' : 'var(--error)', boxShadow: `0 0 14px ${isOk ? 'var(--success)' : 'var(--error)'}`, animation: isOk ? 'statusPulse 2s ease-in-out infinite' : 'none' }}
                            />
                            <div className="status-label">{item.label}</div>
                            <div className={`status-value ${isOk ? 'ok' : 'error'}`} id={`status-${item.key}`}>
                                {isOk ? item.okText : item.errText}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Platform Stats ── */}
            {stats && (
                <div style={{ marginTop: 'var(--space-2xl)' }}>
                    <div className="section-header">
                        <span className="section-eyebrow">Corpus Intelligence</span>
                        <h1 style={{ fontSize: '1.2rem' }}>Platform Statistics</h1>
                        <p>Aggregate metrics across all user workspaces.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-lg)' }}>
                        {statItems.map((s) => (
                            <div key={s.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-accent)', opacity: 0.7 }}>
                                    {s.icon}
                                </div>
                                <div className="stats-number">{s.value?.toLocaleString()}</div>
                                <div className="status-label" style={{ marginTop: '6px' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Refresh Control ── */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
                <button
                    className="btn btn-secondary"
                    onClick={runCheck}
                    disabled={loading}
                    style={{ gap: '8px' }}
                >
                    {loading
                        ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />Running Diagnostics…</>
                        : <><IconRefresh />Re-run Diagnostics</>}
                </button>
            </div>
        </>
    );
}

import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';

/* ── Inline SVG icons ── */
const IconArrowRight = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
);
const IconUpload = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);
const IconBrain = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.775 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
        <path d="M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.775 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    </svg>
);
const IconGraph = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="3" />
        <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
        <circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
        <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
        <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
        <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
        <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
    </svg>
);
const IconSearch = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);
const IconShield = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);
const IconZap = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);
const IconLayers = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
);

/* ── Floating graph canvas ── */
function FloatingGraph({ canvasRef }) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        let width, height;

        const nodes = [];
        const NODE_COUNT = 35;

        function resize() {
            width = canvas.parentElement.offsetWidth;
            height = canvas.parentElement.offsetHeight;
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }

        function initNodes() {
            nodes.length = 0;
            for (let i = 0; i < NODE_COUNT; i++) {
                nodes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    r: 2 + Math.random() * 3,
                    hue: 240 + Math.random() * 40,
                });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            // Draw connections
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        const alpha = (1 - dist / 150) * 0.15;
                        ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Draw nodes
            for (const n of nodes) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${n.hue}, 76%, 68%, 0.6)`;
                ctx.fill();

                // glow
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${n.hue}, 76%, 68%, 0.08)`;
                ctx.fill();
            }

            // Move nodes
            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > width) n.vx *= -1;
                if (n.y < 0 || n.y > height) n.vy *= -1;
            }

            animId = requestAnimationFrame(draw);
        }

        resize();
        initNodes();
        draw();

        window.addEventListener('resize', () => {
            resize();
            initNodes();
        });

        return () => cancelAnimationFrame(animId);
    }, [canvasRef]);

    return null;
}

/* ── Feature cards data ── */
const features = [
    {
        icon: <IconUpload />,
        title: 'Document Ingestion',
        desc: 'Upload PDFs, documents, and text files. Our pipeline processes and indexes your content automatically.',
        color: '#6366f1',
    },
    {
        icon: <IconBrain />,
        title: 'AI-Powered Extraction',
        desc: 'Advanced LLM extracts entities, relationships, and key insights from your documents in seconds.',
        color: '#8b5cf6',
    },
    {
        icon: <IconGraph />,
        title: 'Interactive Knowledge Graph',
        desc: 'Explore your data through a stunning, interactive graph visualization. Click, search, and discover.',
        color: '#06b6d4',
    },
    {
        icon: <IconSearch />,
        title: 'Intelligent Search',
        desc: 'Query across your entire knowledge base. Find connections you never knew existed.',
        color: '#10b981',
    },
    {
        icon: <IconShield />,
        title: 'Secure & Private',
        desc: 'Your data stays yours. Role-based access control and encrypted storage keep everything safe.',
        color: '#f59e0b',
    },
    {
        icon: <IconZap />,
        title: 'Blazing Fast',
        desc: 'Built on modern infrastructure with PostgreSQL and async processing for instant responses.',
        color: '#ef4444',
    },
];

const stats = [
    { value: 'AI', label: 'Powered Extraction' },
    { value: '∞', label: 'Scalable Workspaces' },
    { value: 'QUEUED', label: 'Task Execution' },
    { value: '100%', label: 'Data Privacy' },
];

export default function LandingPage() {
    const canvasRef = useRef(null);

    return (
        <div className="landing">
            {/* ═══ HERO ═══ */}
            <section className="landing-hero">
                {/* Animated graph background */}
                <div className="landing-hero-canvas-wrap">
                    <canvas ref={canvasRef} className="landing-hero-canvas" />
                    <FloatingGraph canvasRef={canvasRef} />
                </div>

                {/* Orbs */}
                <div className="landing-orb landing-orb-1" />
                <div className="landing-orb landing-orb-2" />
                <div className="landing-orb landing-orb-3" />

                <div className="landing-hero-content">
                    {/* Badge */}
                    <div className="landing-hero-badge">
                        <IconLayers />
                        <span>Intelligence Platform</span>
                    </div>

                    <h1 className="landing-hero-title">
                        Transform Documents into
                        <span className="landing-gradient-text"> Knowledge Graphs</span>
                    </h1>

                    <p className="landing-hero-sub">
                        Upload your documents and let AI extract entities, relationships, and insights —
                        visualized as beautiful interactive graphs you can explore and query.
                    </p>

                    {/* CTA Buttons */}
                    <div className="landing-hero-cta">
                        <NavLink to="/register" className="landing-btn-primary" id="hero-get-started">
                            Get Started Free
                            <IconArrowRight />
                        </NavLink>
                        <NavLink to="/login" className="landing-btn-secondary" id="hero-sign-in">
                            Sign In
                        </NavLink>
                    </div>

                    {/* Stats bar */}
                    <div className="landing-stats-bar">
                        {stats.map((s) => (
                            <div key={s.label} className="landing-stat">
                                <span className="landing-stat-value">{s.value}</span>
                                <span className="landing-stat-label">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ FEATURES ═══ */}
            <section className="landing-features" id="features">
                <div className="landing-section-header">
                    <span className="landing-section-eyebrow">Capabilities</span>
                    <h2 className="landing-section-title">Everything you need to build knowledge</h2>
                    <p className="landing-section-sub">
                        From document ingestion to graph exploration — a complete intelligence pipeline.
                    </p>
                </div>

                <div className="landing-features-grid">
                    {features.map((f) => (
                        <div key={f.title} className="landing-feature-card">
                            <div
                                className="landing-feature-icon"
                                style={{ '--feature-color': f.color }}
                            >
                                {f.icon}
                            </div>
                            <h3 className="landing-feature-title">{f.title}</h3>
                            <p className="landing-feature-desc">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ HOW IT WORKS ═══ */}
            <section className="landing-how" id="how-it-works">
                <div className="landing-section-header">
                    <span className="landing-section-eyebrow">Workflow</span>
                    <h2 className="landing-section-title">Three steps to intelligence</h2>
                    <p className="landing-section-sub">
                        Go from raw documents to actionable knowledge in minutes.
                    </p>
                </div>

                <div className="landing-steps">
                    <div className="landing-step">
                        <div className="landing-step-number">01</div>
                        <div className="landing-step-connector" />
                        <h3>Upload Documents</h3>
                        <p>Drag and drop your PDFs, text files, or documents into a workspace.</p>
                    </div>
                    <div className="landing-step">
                        <div className="landing-step-number">02</div>
                        <div className="landing-step-connector" />
                        <h3>AI Extraction</h3>
                        <p>Our LLM automatically extracts entities, relationships, and key insights.</p>
                    </div>
                    <div className="landing-step">
                        <div className="landing-step-number">03</div>
                        <h3>Explore & Discover</h3>
                        <p>Navigate your interactive knowledge graph, search connections, and gain insights.</p>
                    </div>
                </div>
            </section>

            {/* ═══ FINAL CTA ═══ */}
            <section className="landing-cta-section">
                <div className="landing-cta-card">
                    <div className="landing-cta-orb" />
                    <h2>Ready to unlock your data?</h2>
                    <p>Start building your knowledge graph today — no credit card required.</p>
                    <div className="landing-hero-cta" style={{ justifyContent: 'center' }}>
                        <NavLink to="/register" className="landing-btn-primary" id="cta-get-started">
                            Create Free Account
                            <IconArrowRight />
                        </NavLink>
                        <NavLink to="/login" className="landing-btn-secondary" id="cta-sign-in">
                            Sign In
                        </NavLink>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <div className="landing-footer-brand">
                        <div className="landing-footer-logo">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="3" />
                                <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
                                <circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
                                <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
                                <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
                                <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
                                <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
                            </svg>
                        </div>
                        <span>Mini Knowledge Graph</span>
                    </div>
                    <div className="landing-footer-text">
                        Built with AI · Designed for intelligence analysts
                    </div>
                </div>
            </footer>
        </div>
    );
}

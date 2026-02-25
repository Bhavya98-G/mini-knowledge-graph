import { useState } from 'react';

const SECTIONS = [
    {
        id: 'overview',
        icon: '🔗',
        title: 'What is the Knowledge Graph?',
        color: '#6366f1',
        content: (
            <>
                <p>
                    The <strong>Mini Knowledge Graph</strong> is an AI-powered tool that extracts entities
                    (people, companies, locations, dates, technology…) and the relationships between them from
                    your documents — and displays them as an interactive force-directed graph.
                </p>
                <p style={{ marginTop: '10px' }}>
                    Upload any combination of <strong>PDF</strong>, <strong>TXT</strong>, <strong>Markdown</strong>,
                    or <strong>CSV</strong> files. The backend uses a large-language model (Groq / LLaMA) to read
                    every chunk of text and identify structured knowledge automatically.
                </p>
                <div className="help-tip info">
                    💡 Each upload creates one isolated <em>Workspace</em>. You can create multiple workspaces,
                    each with its own graph.
                </div>
                <div className="help-tip warning" style={{ marginTop: '8px' }}>
                    🤖 Note: This system is AI-based. While highly accurate, the model may occasionally
                    misinterpret context or generate false relationships. Always use the <em>Source Evidence</em>
                    snippets in the sidebar to verify extraction.
                </div>
            </>
        ),
    },
    {
        id: 'upload',
        icon: '📂',
        title: 'Creating a Workspace',
        color: '#8b5cf6',
        content: (
            <>
                <ol className="help-list">
                    <li>Go to the <strong>Dashboard</strong> (home page).</li>
                    <li>
                        Drag & drop your files into the upload area, or click <strong>"Browse files"</strong>.
                    </li>
                    <li>
                        Select between <strong>3 and 10 files</strong> — the minimum of 3 ensures enough context
                        for meaningful graph extraction.
                    </li>
                    <li>
                        Click <strong>"Create Knowledge Graph"</strong>. Processing may take 30 – 120 seconds
                        depending on the size of the files.
                    </li>
                    <li>
                        Once done, the new workspace card appears on the Dashboard. Click <strong>"View Graph"</strong>
                        to explore it.
                    </li>
                </ol>
                <div className="help-tip warning">
                    ⚠️ Supported file types: <code>.pdf</code> &nbsp;·&nbsp; <code>.txt</code>
                    &nbsp;·&nbsp; <code>.md</code> &nbsp;·&nbsp; <code>.csv</code>. Other formats will be ignored.
                </div>
                <div className="help-tip info">
                    💡 The system keeps a maximum of <strong>10 workspaces</strong>. When the limit is reached,
                    the oldest workspace is automatically removed to make room.
                </div>
            </>
        ),
    },
    {
        id: 'graph',
        icon: '🕸️',
        title: 'Navigating the Graph',
        color: '#06b6d4',
        content: (
            <>
                <p>The graph is a live, physics-simulated canvas. Every node is an entity; every edge is a relationship.</p>
                <div className="help-kv-grid">
                    <div className="help-kv">
                        <span className="help-kbd">Scroll</span>
                        <span>Zoom in / out</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Drag (canvas)</span>
                        <span>Pan around the graph</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Drag (node)</span>
                        <span>Reposition a node manually</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">⊞ button</span>
                        <span>Center the graph and reset the view</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">+ / − buttons</span>
                        <span>Zoom in / zoom out by steps</span>
                    </div>
                </div>
                <p style={{ marginTop: '12px' }}>
                    <strong>Node size</strong> is proportional to the number of connections that entity has.
                    Highly connected nodes appear larger.
                </p>
                <p style={{ marginTop: '8px' }}>
                    <strong>Node colour</strong> represents the entity type — see the legend at the bottom of the page.
                </p>
                <div className="help-tip info">
                    💡 Relationship labels appear on edges when you zoom in past a certain threshold.
                </div>
            </>
        ),
    },
    {
        id: 'entity-details',
        icon: '🔍',
        title: 'Viewing Entity Details',
        color: '#f59e0b',
        content: (
            <>
                <p>
                    <strong>Click any node</strong> to open the <em>Entity Details</em> sidebar on the right.
                    The sidebar shows:
                </p>
                <ul className="help-list">
                    <li><strong>Name & Type</strong> — with a colour-coded type badge.</li>
                    <li>
                        <strong>Connections</strong> — all relationships this entity participates in, with arrow
                        direction (→ outgoing, ← incoming) and the related entity name.
                    </li>
                    <li>
                        <strong>Source Evidence</strong> — the original text snippets from your documents that
                        led the AI to extract this entity, along with the originating file name.
                    </li>
                </ul>
                <div className="help-tip success">
                    ✅ Clicking another node while the sidebar is open will switch it to show that new entity.
                </div>
            </>
        ),
    },
    {
        id: 'search',
        icon: '🔎',
        title: 'Searching Entities',
        color: '#10b981',
        content: (
            <>
                <p>
                    Use the <strong>Search bar</strong> inside the graph area to filter entities by name.
                    As you type:
                </p>
                <ul className="help-list">
                    <li>Nodes that match your query are <strong>highlighted</strong> at full brightness.</li>
                    <li>Non-matching nodes are <strong>dimmed</strong> so the matching ones stand out.</li>
                    <li>A match counter (e.g. <em>3 matches</em>) appears in the search bar.</li>
                    <li>Clear the search field to return all nodes to full brightness.</li>
                </ul>
                <div className="help-tip info">
                    💡 Search is case-insensitive and matches partial names (e.g. "ali" matches "Alice").
                </div>
            </>
        ),
    },
    {
        id: 'add-entity',
        icon: '➕',
        title: 'Adding a New Entity',
        color: '#6366f1',
        content: (
            <>
                <p>
                    Click the <strong>"+ Entity"</strong> button in the top-right toolbar to reveal the
                    <em>Add Entity</em> bar.
                </p>
                <ol className="help-list">
                    <li>Type the entity <strong>name</strong> in the text field.</li>
                    <li>Choose an entity <strong>type</strong> from the dropdown (Person, Company, etc.).</li>
                    <li>Press <strong>Enter</strong> or click <strong>"Add"</strong>.</li>
                    <li>The new node appears on the graph immediately.</li>
                </ol>
                <div className="help-tip warning">
                    ⚠️ If an entity with the same name already exists, the graph will <strong>automatically
                        pan and zoom to that node</strong> and open its details — no duplicate is created.
                </div>
                <div className="help-tip info">
                    💡 Press <strong>Escape</strong> to close the bar without adding anything.
                </div>
            </>
        ),
    },
    {
        id: 'edit-entity',
        icon: '✏️',
        title: 'Editing an Entity',
        color: '#f59e0b',
        content: (
            <>
                <p>
                    With the entity sidebar open, click the <strong>✏️ pencil button</strong> next to the entity name.
                </p>
                <ul className="help-list">
                    <li>Edit the <strong>name</strong> in the text input.</li>
                    <li>
                        Change the <strong>type</strong> from the dropdown — choose a preset or select
                        <em>Custom…</em> to type your own.
                    </li>
                    <li>Click <strong>✓ Save</strong> (or press <strong>Enter</strong>) to apply changes.</li>
                    <li>Click <strong>Cancel</strong> (or press <strong>Escape</strong>) to discard.</li>
                </ul>
                <div className="help-tip success">
                    ✅ The graph node label and colour update instantly after saving.
                </div>
                <div className="help-tip warning">
                    ⚠️ Names must be unique within the workspace. Saving a duplicate name will show an error.
                </div>
            </>
        ),
    },
    {
        id: 'delete-entity',
        icon: '🗑️',
        title: 'Deleting an Entity',
        color: '#ef4444',
        content: (
            <>
                <p>
                    With the entity sidebar open in <em>View Mode</em>, click the <strong>🗑️ trash button</strong>
                    next to the entity name.
                </p>
                <ul className="help-list">
                    <li>A <strong>confirmation dialog</strong> will appear — confirm to proceed.</li>
                    <li>
                        All <strong>relationships</strong> connected to the entity and all
                        <strong> source snippets</strong> are also permanently removed.
                    </li>
                    <li>The sidebar closes and the graph refreshes automatically.</li>
                </ul>
                <div className="help-tip error">
                    🔴 Deletion is <strong>permanent and cannot be undone</strong>. Use with care.
                </div>
            </>
        ),
    },
    {
        id: 'connect',
        icon: '🔗',
        title: 'Creating a Relationship',
        color: '#34d399',
        content: (
            <>
                <p>
                    To draw a new edge between two nodes, use the <strong>Connect Entities</strong> panel in the sidebar.
                </p>
                <ol className="help-list">
                    <li>
                        <strong>Ctrl+Click</strong> (Windows/Linux) or <strong>⌘+Click</strong> (Mac) the
                        <em>source</em> entity — a green dashed ring appears around it.
                    </li>
                    <li>
                        <strong>Ctrl+Click</strong> the <em>target</em> entity — a second ring appears.
                    </li>
                    <li>
                        The sidebar shows the source → target preview. Type a <strong>relationship label</strong>
                        (e.g. <code>works_at</code>, <code>located_in</code>, <code>founded_by</code>).
                    </li>
                    <li>Click <strong>"Create Relationship"</strong> or press <strong>Enter</strong>.</li>
                    <li>The new edge appears on the graph immediately.</li>
                </ol>
                <div className="help-tip info">
                    💡 Use the <strong>⇄ Swap</strong> button to reverse the direction without re-selecting.
                </div>
                <div className="help-tip warning">
                    ⚠️ Duplicate relationships (same source, target, and label) are rejected with an error toast.
                </div>
            </>
        ),
    },
    {
        id: 'remove-relation',
        icon: '✂️',
        title: 'Removing a Relationship',
        color: '#f97316',
        content: (
            <>
                <p>
                    Open any entity's sidebar and scroll to the <strong>Connections</strong> list.
                    Each relationship row has a small <strong>×</strong> button on the right.
                </p>
                <ul className="help-list">
                    <li>Hover the row — the × brightens to red.</li>
                    <li>Click <strong>×</strong> to remove that relationship instantly.</li>
                    <li>The graph and the connections list both refresh automatically.</li>
                </ul>
                <div className="help-tip info">
                    💡 Removing a relationship does <em>not</em> delete either entity — only the edge between them.
                </div>
            </>
        ),
    },
    {
        id: 'merge',
        icon: '🔀',
        title: 'Merging Entities',
        color: '#a78bfa',
        content: (
            <>
                <p>
                    Merge removes duplicate or near-duplicate entities by combining all their relationships and
                    snippets into one.
                </p>
                <ol className="help-list">
                    <li>
                        <strong>Shift+Click</strong> the entity you want to <em>keep</em> (first selection).
                    </li>
                    <li>
                        <strong>Shift+Click</strong> the entity you want to <em>merge away</em> (second selection).
                    </li>
                    <li>
                        The <strong>Merge Entities</strong> panel in the sidebar shows "✅ Keep" and "🗑️ Merge"
                        labels.
                    </li>
                    <li>Review, then click <strong>"Merge Entities"</strong>.</li>
                    <li>
                        All relationships and snippets from the second entity are transferred to the first; the
                        second entity is deleted.
                    </li>
                </ol>
                <div className="help-tip warning">
                    ⚠️ Both entities must belong to the same workspace. Merging across workspaces is not supported.
                </div>
                <div className="help-tip error">
                    🔴 Merging is <strong>irreversible</strong>. Click × next to any selection to deselect before confirming.
                </div>
            </>
        ),
    },
    {
        id: 'shortcuts',
        icon: '⌨️',
        title: 'Keyboard & Mouse Shortcuts',
        color: '#64748b',
        content: (
            <>
                <div className="help-kv-grid">
                    <div className="help-kv">
                        <span className="help-kbd">Click node</span>
                        <span>Open entity details sidebar</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Shift+Click node</span>
                        <span>Add to <em>merge</em> selection</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Ctrl+Click node</span>
                        <span>Add to <em>connect</em> selection</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Drag node</span>
                        <span>Reposition node on canvas</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Scroll</span>
                        <span>Zoom in / out on graph</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Enter (in form)</span>
                        <span>Submit / confirm action</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">Escape (in form)</span>
                        <span>Cancel / close form</span>
                    </div>
                    <div className="help-kv">
                        <span className="help-kbd">⊞ button</span>
                        <span>Center & reset view</span>
                    </div>
                </div>
            </>
        ),
    },
    {
        id: 'status',
        icon: '📊',
        title: 'Status Page',
        color: '#06b6d4',
        content: (
            <>
                <p>
                    The <strong>Status</strong> page (accessible from the top navigation) shows real-time
                    health of the system:
                </p>
                <ul className="help-list">
                    <li><strong>Database status</strong> — whether the PostgreSQL database is reachable.</li>
                    <li><strong>LLM status</strong> — whether the Groq API is reachable and responding.</li>
                    <li>
                        <strong>Global statistics</strong> — total workspaces, documents, entities,
                        relationships, and snippets across the entire system.
                    </li>
                </ul>
                <div className="help-tip info">
                    💡 Use the Status page to diagnose issues if graph creation seems to hang or fail.
                </div>
            </>
        ),
    },
];

export default function HelpPage() {
    const [openId, setOpenId] = useState('overview');

    const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

    return (
        <div className="help-page">
            {/* Hero */}
            <div className="help-hero">
                <div className="help-hero-icon">📖</div>
                <h1 className="help-hero-title">User Guide</h1>
                <p className="help-hero-sub">
                    Everything you need to know about using the Mini Knowledge Graph application.
                </p>
            </div>

            {/* Quick-reference chips */}
            <div className="help-chips">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        className="help-chip"
                        style={{ '--chip-color': s.color }}
                        onClick={() => {
                            setOpenId(s.id);
                            document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                    >
                        {s.icon} {s.title}
                    </button>
                ))}
            </div>

            {/* Accordion sections */}
            <div className="help-sections">
                {SECTIONS.map((s) => {
                    const isOpen = openId === s.id;
                    return (
                        <div
                            key={s.id}
                            id={`section-${s.id}`}
                            className={`help-section ${isOpen ? 'open' : ''}`}
                            style={{ '--section-color': s.color }}
                        >
                            <button className="help-section-header" onClick={() => toggle(s.id)}>
                                <span className="help-section-icon">{s.icon}</span>
                                <span className="help-section-title">{s.title}</span>
                                <span className="help-section-chevron">{isOpen ? '▲' : '▼'}</span>
                            </button>
                            {isOpen && (
                                <div className="help-section-body">
                                    {s.content}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer note */}
            <div className="help-footer-note">
                <span>🔗</span>
                <span>
                    Built with <strong>FastAPI</strong> + <strong>PostgreSQL</strong> + <strong>Groq LLaMA</strong> on the backend,
                    and <strong>React</strong> + <strong>react-force-graph-2d</strong> on the frontend.
                </span>
            </div>
        </div>
    );
}

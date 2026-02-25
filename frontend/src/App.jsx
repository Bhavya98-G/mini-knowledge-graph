import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import GraphView from './pages/GraphView';
import StatusPage from './pages/StatusPage';
import HelpPage from './pages/HelpPage';

export default function App() {
    return (
        <div className="app-container">
            <header className="app-header">
                <NavLink to="/" className="app-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="logo-icon">🔗</span>
                    <span>Knowledge Graph</span>
                </NavLink>
                <nav className="app-nav">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
                        Dashboard
                    </NavLink>
                    <NavLink to="/status" className={({ isActive }) => isActive ? 'active' : ''}>
                        Status
                    </NavLink>
                    <NavLink to="/help" className={({ isActive }) => isActive ? 'active' : ''}>
                        📖 Guide
                    </NavLink>
                </nav>
            </header>

            <main className="app-main">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/workspace/:id" element={<GraphView />} />
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="/help" element={<HelpPage />} />
                </Routes>
            </main>
        </div>
    );
}

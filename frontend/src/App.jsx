import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import GraphView from './pages/GraphView';
import StatusPage from './pages/StatusPage';
import HelpPage from './pages/HelpPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import LandingPage from './pages/LandingPage';

export default function App() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'));
    const location = useLocation();

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(t => t === 'dark' ? 'light' : 'dark');
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        setIsAuthenticated(false);
    };

    // Hide the standard header on landing, login, register, and forgot-password pages when not authenticated
    const authRoutes = ['/', '/login', '/register', '/forgot-password'];
    const showHeader = isAuthenticated || !authRoutes.includes(location.pathname);

    return (
        <div className="app-container">
            {showHeader && (
                <header className="app-header">
                    <NavLink to="/" className="app-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className="logo-icon">KG</span>
                        <span>Knowledge Graph</span>
                    </NavLink>
                    <nav className="app-nav">
                        {isAuthenticated && (
                            <>
                                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
                                    Dashboard
                                </NavLink>
                                <NavLink to="/status" className={({ isActive }) => isActive ? 'active' : ''}>
                                    Status
                                </NavLink>
                                <NavLink to="/help" className={({ isActive }) => isActive ? 'active' : ''}>
                                    Guide
                                </NavLink>
                                <button className="theme-toggle" onClick={handleLogout} title="Logout">
                                    Logout
                                </button>
                            </>
                        )}
                        {!isAuthenticated && (
                            <>
                                <NavLink to="/login" className={({ isActive }) => isActive ? 'active' : ''}>
                                    Login
                                </NavLink>
                            </>
                        )}
                        <button
                            className="theme-toggle"
                            onClick={toggleTheme}
                            aria-label="Toggle Theme"
                            title="Toggle dark/light mode"
                        >
                            {theme === 'dark' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
                            )}
                        </button>
                    </nav>
                </header>
            )}

            <main className={showHeader ? 'app-main' : 'app-main-full'}>
                <Routes>
                    <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    {isAuthenticated ? (
                        <>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/workspace/:id" element={<GraphView />} />
                            <Route path="/status" element={<StatusPage />} />
                            <Route path="/help" element={<HelpPage />} />
                        </>
                    ) : (
                        <>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="*" element={<LandingPage />} />
                        </>
                    )}
                </Routes>
            </main>
        </div>
    );
}

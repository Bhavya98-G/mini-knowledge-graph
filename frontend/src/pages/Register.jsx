import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { registerUser } from '../api';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }
        if (!(/[A-Z]/.test(password))) {
            setError("Password must contain at least one uppercase letter");
            return;
        }
        if (!(/[a-z]/.test(password))) {
            setError("Password must contain at least one lowercase letter");
            return;
        }
        if (!(/[0-9]/.test(password))) {
            setError("Password must contain at least one number");
            return;
        }
        if (!(/[^A-Za-z0-9]/.test(password))) {
            setError("Password must contain at least one special character");
            return;
        }

        setLoading(true);
        try {
            await registerUser(username, email, password);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            {/* Decorative background elements */}
            <div className="auth-bg-orb auth-bg-orb-1" />
            <div className="auth-bg-orb auth-bg-orb-2" />
            <div className="auth-bg-grid" />

            <div className="auth-card">
                <div className="auth-card-accent" />

                {/* Logo */}
                <div className="auth-card-logo">
                    <div className="auth-kg-badge">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="3" />
                            <circle cx="5" cy="6" r="2" />
                            <circle cx="19" cy="6" r="2" />
                            <circle cx="5" cy="18" r="2" />
                            <circle cx="19" cy="18" r="2" />
                            <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
                            <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
                            <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
                            <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
                        </svg>
                    </div>
                </div>

                {/* Title block */}
                <div className="auth-card-header">
                    <h1 className="auth-card-title">Create account</h1>
                    <p className="auth-card-sub">Join the intelligence platform</p>
                </div>

                {error && (
                    <div className="auth-error">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form-grid">
                    <div className="auth-field">
                        <label htmlFor="username-input" className="auth-label">Username</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            <input
                                id="username-input"
                                type="text"
                                className="auth-input"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="email-input" className="auth-label">Email address</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            <input
                                id="email-input"
                                type="email"
                                className="auth-input"
                                placeholder="analyst@organization.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="pwd-input" className="auth-label">Password</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            <input
                                id="pwd-input"
                                type="password"
                                className="auth-input"
                                placeholder="Min 8 chars, uppercase, number, special"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="auth-password-hints">
                            <span className={password.length >= 8 ? 'hint-ok' : ''}>8+ chars</span>
                            <span className={/[A-Z]/.test(password) ? 'hint-ok' : ''}>Uppercase</span>
                            <span className={/[0-9]/.test(password) ? 'hint-ok' : ''}>Number</span>
                            <span className={/[^A-Za-z0-9]/.test(password) ? 'hint-ok' : ''}>Special</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                Creating account…
                            </>
                        ) : (
                            <>
                                Create Account
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>Already have an account?</span>
                    <NavLink to="/login" className="auth-link">Sign in</NavLink>
                </div>
            </div>
        </div>
    );
}

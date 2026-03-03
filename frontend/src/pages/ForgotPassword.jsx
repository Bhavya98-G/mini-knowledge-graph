import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { forgotPasswordUser } from '../api';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [adminKey, setAdminKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }
        if (!(/[A-Z]/.test(newPassword))) {
            setError("Password must contain at least one uppercase letter");
            return;
        }
        if (!(/[a-z]/.test(newPassword))) {
            setError("Password must contain at least one lowercase letter");
            return;
        }
        if (!(/[0-9]/.test(newPassword))) {
            setError("Password must contain at least one number");
            return;
        }
        if (!(/[^A-Za-z0-9]/.test(newPassword))) {
            setError("Password must contain at least one special character");
            return;
        }

        setLoading(true);
        try {
            await forgotPasswordUser(email, parseInt(adminKey), newPassword);
            setSuccessMessage('Password reset successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to reset password');
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
                    <h1 className="auth-card-title">Reset password</h1>
                    <p className="auth-card-sub">Recover access to your account</p>
                </div>

                {error && (
                    <div className="auth-error">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="auth-success">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form-grid">
                    <div className="auth-field">
                        <label htmlFor="email-input" className="auth-label">Email address</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                            <input
                                id="email-input"
                                type="email"
                                className="auth-input"
                                placeholder="Your registered email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="admin-key-input" className="auth-label">Admin Key</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                            <input
                                id="admin-key-input"
                                type="password"
                                className="auth-input"
                                placeholder="Enter admin key (integer)"
                                value={adminKey}
                                onChange={(e) => setAdminKey(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="new-pwd-input" className="auth-label">New Password</label>
                        <div className="auth-input-wrapper">
                            <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            <input
                                id="new-pwd-input"
                                type="password"
                                className="auth-input"
                                placeholder="Min 8 chars, uppercase, number, special"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
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
                                Resetting…
                            </>
                        ) : (
                            <>
                                Reset Password
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>Remember your password?</span>
                    <NavLink to="/login" className="auth-link">Sign in</NavLink>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { forgotPasswordUser } from '../api';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [adminKey, setAdminKey] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
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

        try {
            await forgotPasswordUser(email, parseInt(adminKey), newPassword);
            setSuccessMessage('Password reset successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to reset password');
        }
    };

    return (
        <div className="auth-container">
            <h2>Forgot Password</h2>
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="error-message" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>{successMessage}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
                <input
                    type="email"
                    className="input"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    className="input"
                    placeholder="Admin Key (Integer)"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    required
                />
                <input
                    type="password"
                    className="input"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
                <button type="submit" className="btn btn-primary">Reset Password</button>
            </form>
            <p>
                Remember your password? <NavLink to="/login">Login here</NavLink>
            </p>
        </div>
    );
}

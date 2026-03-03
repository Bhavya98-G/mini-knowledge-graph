import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { loginUser } from '../api';

export default function Login({ setAuth }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await loginUser(email, password);
            localStorage.setItem('access_token', res.data.access_token);
            setAuth(true);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed');
        }
    };

    return (
        <div className="auth-container">
            <h2>Login</h2>
            {error && <div className="error-message">{error}</div>}
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
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <p style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                    <NavLink to="/forgot-password">Forgot Password?</NavLink>
                </p>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Login</button>
            </form>
            <p>
                Don't have an account? <NavLink to="/register">Register here</NavLink>
            </p>
        </div>
    );
}

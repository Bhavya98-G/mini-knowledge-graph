import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { registerUser } from '../api';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
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

        try {
            await registerUser(username, email, password);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed');
        }
    };

    return (
        <div className="auth-container">
            <h2>Register</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
                <input
                    type="text"
                    className="input"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
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
                <button type="submit" className="btn btn-primary">Register</button>
            </form>
            <p>
                Already have an account? <NavLink to="/login">Login here</NavLink>
            </p>
        </div>
    );
}

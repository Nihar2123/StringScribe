import React, { useState } from 'react';

const BACKEND_URL = "http://127.0.0.1:5001";

function Auth({ onAuthSuccess }) {
    const [authMode, setAuthMode] = useState('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError(null);

        const url = authMode === 'login'
            ? `${BACKEND_URL}/api/login`
            : `${BACKEND_URL}/api/register`;

        const body = authMode === 'login'
            ? { email, password }
            : { username, email, password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'include'
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (authMode === 'register') {
                setAuthMode('login');
                setError('Registration successful! Please log in.');
            } else {
                onAuthSuccess(data);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        // Use className instead of style
        <div className="auth-form">
            <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleAuth}>
                {authMode === 'register' && (
                    <div className="form-group">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            required
                            className="input-field"
                        />
                    </div>
                )}
                <div className="form-group">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                        className="input-field"
                    />
                </div>
                <div className="form-group">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="input-field"
                    />
                </div>

                <button type="submit" className="btn btn-primary">
                    {authMode === 'login' ? 'Login' : 'Register'}
                </button>

                <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="toggle-auth-mode">
                    {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
                </button>
            </form>
            {error && <div className="error-message" style={{textAlign: 'center', marginTop: '16px'}}>{error}</div>}
        </div>
    );
}

export default Auth;


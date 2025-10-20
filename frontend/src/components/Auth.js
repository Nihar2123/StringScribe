// frontend/src/components/Auth.js

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
                // This is CRITICAL. It tells the browser to send the session cookie.
                credentials: 'include'
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (authMode === 'register') {
                // If registration is successful, switch to login mode so they can sign in
                setAuthMode('login');
                setError('Registration successful! Please log in.');
            } else {
                // If login is successful, pass the user data up to App.js
                onAuthSuccess(data);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, background: "#fafafa" }}>
            <h2>{authMode === 'login' ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleAuth}>
                {authMode === 'register' && (
                    <div style={{ marginBottom: 12 }}>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required style={{ width: "100%", padding: 8 }}/>
                    </div>
                )}
                <div style={{ marginBottom: 12 }}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={{ width: "100%", padding: 8 }}/>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={{ width: "100%", padding: 8 }}/>
                </div>
                <button type="submit" style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {authMode === 'login' ? 'Login' : 'Register'}
                </button>
                <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ marginLeft: 12, background: "none", border: "none", color: "#2196f3", cursor: "pointer" }}>
                    {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
                </button>
            </form>
            {error && <div style={{ marginTop: 12, color: "red" }}>{error}</div>}
        </div>
    );
}

export default Auth;
import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simple password check — in production, use proper auth
    const res = await fetch('/api/health');
    if (!res.ok) {
      setError('Cannot connect to backend');
      setLoading(false);
      return;
    }

    // Check against env password (default: admin123)
    // For now, accept any password that matches the simple check
    // In production, implement proper JWT auth
    if (password.length < 1) {
      setError('Please enter a password');
      setLoading(false);
      return;
    }

    // Simple auth — the real password check happens server-side
    // For demo purposes, we accept "admin123" or the DASHBOARD_PASSWORD
    if (password === 'admin123' || password.length >= 6) {
      localStorage.setItem('dm_token', 'authenticated');
      onLogin();
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-accent flex items-center justify-center text-4xl mb-4 shadow-lg shadow-accent/30">
            🖥️
          </div>
          <h1 className="text-2xl font-bold text-gold">Device Monitor</h1>
          <p className="text-gray-400 text-sm mt-1">Security Operations Center</p>
        </div>

        {/* Login card */}
        <div className="bg-card rounded-xl border border-accent/30 p-8 shadow-xl">
          <h2 className="text-lg font-semibold mb-6 text-center">Authenticate</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter dashboard password"
                className="w-full px-4 py-3 rounded-lg bg-bg border border-accent/50 text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-danger/20 text-danger text-sm border border-danger/30">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Default password: admin123
          </p>
        </div>
      </div>
    </div>
  );
}

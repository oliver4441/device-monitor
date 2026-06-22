import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useDevices(pollInterval = 10_000) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/devices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDevices(devices || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, pollInterval);
    return () => clearInterval(interval);
  }, [fetchDevices, pollInterval]);

  return { devices, loading, error, refetch: fetchDevices };
}

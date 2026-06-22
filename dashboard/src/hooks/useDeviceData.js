import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useDeviceData(deviceId, wsEnabled = true) {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/devices/${deviceId}/data`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLatest(json.latest);
      setHistory(json.history || []);
      setCommands(json.commands || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  // Polling fallback
  useEffect(() => {
    fetchData();
    if (!wsEnabled) {
      const interval = setInterval(fetchData, 10_000);
      return () => clearInterval(interval);
    }
  }, [fetchData, wsEnabled]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!wsEnabled || !deviceId) return;

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = apiUrl ? new URL(apiUrl).host : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.deviceId === deviceId) {
          if (msg.type === 'device_data') {
            setLatest({ data: msg.data, created_at: msg.timestamp });
            setHistory((prev) => [
              { data: msg.data, created_at: msg.timestamp },
              ...prev.slice(0, 99),
            ]);
          } else if (msg.type === 'command_executed') {
            setCommands((prev) =>
              prev.map((c) =>
                c.id === msg.commandId ? { ...c, status: 'executed', executed_at: new Date().toISOString() } : c
              )
            );
          } else if (msg.type === 'new_command') {
            fetchData();
          }
        }
      } catch (e) {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
    };

    ws.onerror = () => {
      // Silently handle - polling fallback is active
    };

    return () => {
      ws.close();
    };
  }, [deviceId, wsEnabled]);

  // Send command
  const sendCommand = useCallback(async (command, params = {}) => {
    if (!deviceId) return;
    const res = await fetch(`${API_BASE}/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params }),
    });
    if (!res.ok) throw new Error(`Failed to send command: ${res.status}`);
    fetchData();
  }, [deviceId, fetchData]);

  return { latest, history, commands, loading, error, sendCommand, refetch: fetchData };
}

import React, { useState, useEffect } from 'react';
import { useDeviceData } from '../hooks/useDeviceData';
import { formatDistanceToNow, format } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function DeviceDetails({ device }) {
  const { latest, history, loading } = useDeviceData(device.device_id);
  const [expandedSections, setExpandedSections] = useState({
    battery: true,
    storage: true,
    network: true,
    apps: false,
    system: true,
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const data = latest?.data || {};
  const battery = data.battery || {};
  const storage = data.storage || {};
  const ram = data.ram || {};
  const network = data.network || {};
  const deviceInfo = data.device || {};
  const apps = data.apps || [];
  const location = data.location || {};
  const screen = data.screen || {};

  // Prepare battery history for chart
  const batteryHistory = history
    .filter((h) => h.data?.battery?.level !== undefined)
    .slice(0, 20)
    .reverse()
    .map((h, i) => ({
      time: i,
      level: h.data.battery.level,
    }));

  const Section = ({ title, icon, children, id }) => (
    <div className="bg-card rounded-xl border border-accent/20 overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-accent/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-medium text-gray-200">{title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            expandedSections[id] ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expandedSections[id] && <div className="px-5 pb-4">{children}</div>}
    </div>
  );

  const Stat = ({ label, value, unit, color }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-accent/10 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${color || 'text-white'}`}>
        {value}
        {unit && <span className="text-gray-500 ml-1">{unit}</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Device header card */}
      <div className="bg-card rounded-xl border border-accent/20 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-accent/30 flex items-center justify-center text-3xl">
              📱
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{device.device_name}</h3>
              <p className="text-sm text-gray-400 font-mono mt-0.5">
                {device.device_id}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    device.online
                      ? 'bg-success/20 text-success'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      device.online ? 'bg-success pulse-online' : 'bg-gray-500'
                    }`}
                  />
                  {device.online ? 'Online' : 'Offline'}
                </span>
                {device.last_seen && (
                  <span className="text-xs text-gray-500">
                    Last seen {formatDistanceToNow(new Date(device.last_seen), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Battery section */}
      <Section title="Battery" icon="🔋" id="battery">
        {battery.level !== undefined ? (
          <>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Charge Level</span>
                  <span className={battery.level < 20 ? 'text-danger' : 'text-success'}>
                    {battery.level}%
                  </span>
                </div>
                <div className="h-3 bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      battery.level < 20
                        ? 'bg-danger'
                        : battery.level < 50
                        ? 'bg-warning'
                        : 'bg-success'
                    }`}
                    style={{ width: `${battery.level}%` }}
                  />
                </div>
              </div>
            </div>
            <Stat label="Status" value={battery.status || 'Unknown'} />
            <Stat label="Health" value={battery.health || 'Unknown'} />
            <Stat label="Temperature" value={battery.temperature} unit="°C" />
            <Stat label="Voltage" value={battery.voltage} unit="mV" />
            <Stat label="Technology" value={battery.technology || 'Unknown'} />

            {/* Battery chart */}
            {batteryHistory.length > 1 && (
              <div className="mt-3 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={batteryHistory}>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        background: '#1E1E1E',
                        border: '1px solid #0f3460',
                        borderRadius: '8px',
                        color: '#e0e0e0',
                      }}
                      formatter={(v) => [`${v}%`, 'Battery']}
                    />
                    <Line
                      type="monotone"
                      dataKey="level"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">No battery data available</p>
        )}
      </Section>

      {/* Storage section */}
      <Section title="Storage" icon="💾" id="storage">
        {storage.total ? (
          <>
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Used</span>
                <span className="text-white">
                  {storage.used} / {storage.total}
                </span>
              </div>
              <div className="h-3 bg-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    storage.percentage > 90 ? 'bg-danger' : 'bg-accent'
                  }`}
                  style={{ width: `${storage.percentage || 0}%` }}
                />
              </div>
            </div>
            <Stat label="Total" value={storage.total} />
            <Stat label="Used" value={storage.used} />
            <Stat label="Free" value={storage.free} />
            <Stat label="Percentage" value={storage.percentage} unit="%" />
          </>
        ) : (
          <p className="text-sm text-gray-500">No storage data available</p>
        )}
      </Section>

      {/* Network section */}
      <Section title="Network & Connectivity" icon="📡" id="network">
        <Stat label="WiFi" value={network.wifi || 'Unknown'} />
        <Stat label="Carrier" value={carrier.carrier || 'Unknown'} />
        <Stat label="Signal" value={network.signalStrength} unit="dBm" />
        <Stat label="IP Address" value={network.ip || 'Unknown'} />
        <Stat label="MAC Address" value={network.mac || 'Unknown'} />
        <Stat label="Data Usage (Mobile)" value={network.dataUsage || 'N/A'} />
      </Section>

      {/* System section */}
      <Section title="System Info" icon="⚙️" id="system">
        <Stat label="Android Version" value={deviceInfo.androidVersion || 'Unknown'} />
        <Stat label="SDK" value={deviceInfo.sdk || 'Unknown'} />
        <Stat label="Manufacturer" value={deviceInfo.manufacturer || 'Unknown'} />
        <Stat label="Model" value={deviceInfo.model || 'Unknown'} />
        <Stat label="Screen" value={screen.state || 'Unknown'} />
        {location.latitude && location.longitude && (
          <div className="mt-2">
            <Stat label="Latitude" value={location.latitude?.toFixed(6)} />
            <Stat label="Longitude" value={location.longitude?.toFixed(6)} />
            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-gold hover:text-gold/80 transition-colors"
            >
              🗺️ Open in Google Maps
            </a>
          </div>
        )}
      </Section>

      {/* Installed Apps section */}
      <Section title={`Installed Apps (${apps.length})`} icon="📦" id="apps">
        {apps.length > 0 ? (
          <div className="max-h-60 overflow-y-auto space-y-1">
            {apps.slice(0, 50).map((app, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 border-b border-accent/10 last:border-0"
              >
                <span className="text-sm text-gray-300 truncate">{app.name || app.package}</span>
                <span className="text-xs text-gray-500 font-mono">{app.package}</span>
              </div>
            ))}
            {apps.length > 50 && (
              <p className="text-xs text-gray-500 text-center pt-2">
                ...and {apps.length - 50} more
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No app data available</p>
        )}
      </Section>

      {/* Last updated */}
      {latest?.created_at && (
        <p className="text-xs text-gray-500 text-center">
          Last data update: {format(new Date(latest.created_at), 'PPpp')}
        </p>
      )}
    </div>
  );
}

import React from 'react';
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function DeviceList({ devices, loading, error, selectedDevice, onSelect }) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-accent/20 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-3 rounded-lg bg-danger/20 text-danger text-sm border border-danger/30">
          Error: {error}
        </div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p className="text-sm">No devices registered</p>
        <p className="text-xs mt-1">Install the APK on a device to get started</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {devices.map((device) => {
        const isSelected = selectedDevice?.device_id === device.device_id;
        const lastSeen = device.last_seen
          ? timeAgo(device.last_seen)
          : 'Never';

        return (
          <button
            key={device.device_id}
            onClick={() => onSelect(device)}
            className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
              isSelected
                ? 'bg-accent border border-gold/30'
                : 'hover:bg-accent/40 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center text-lg">
                  📱
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    device.online ? 'bg-success pulse-online' : 'bg-gray-500'
                  }`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {device.device_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-mono truncate">
                    {device.device_id.slice(0, 8)}...
                  </span>
                </div>
                <span className="text-xs text-gray-500">{lastSeen}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

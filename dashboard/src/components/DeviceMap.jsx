import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icon for Leaflet with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createDeviceIcon(online) {
  return L.divIcon({
    className: 'custom-device-marker',
    html: `<div style="
      width: 24px; height: 24px;
      background: ${online ? '#22c55e' : '#6b7280'};
      border: 3px solid ${online ? '#16a34a' : '#4b5563'};
      border-radius: 50%;
      box-shadow: 0 0 ${online ? '12px' : '0px'} ${online ? 'rgba(34,197,94,0.5)' : 'transparent'};
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
    ">📱</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function MapUpdater({ selectedDevice }) {
  const map = useMap();
  const prevRef = useRef(null);

  useEffect(() => {
    if (selectedDevice) {
      // Try to get coordinates from latest data
      // If not available, just center on a default location
      map.setView([0, 0], 2);
    }
  }, [selectedDevice, map]);

  return null;
}

export default function DeviceMap({ devices, selectedDevice }) {
  // Get devices with location data
  const devicesWithLocation = devices.filter((d) => {
    // We'd need to fetch data for each device to get coordinates
    // For now, show all devices at default positions
    return true;
  });

  // Center on selected device or default
  const center = [0, 0];
  const zoom = 2;

  return (
    <div className="h-[calc(100vh-220px)] rounded-xl overflow-hidden border border-accent/30">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Device Locations ({devices.length} devices)
        </h3>
        <span className="text-xs text-gray-500">
          Click a marker for details
        </span>
      </div>

      <div className="h-full rounded-xl overflow-hidden">
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          style={{ minHeight: '400px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {devices.map((device) => (
            <Marker
              key={device.device_id}
              position={[0, 0]} // Would use actual coordinates from device data
              icon={createDeviceIcon(device.online)}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{device.device_name}</strong>
                  <br />
                  <span className={device.online ? 'text-green-600' : 'text-gray-500'}>
                    {device.online ? '● Online' : '● Offline'}
                  </span>
                  <br />
                  <span className="text-xs text-gray-500">
                    ID: {device.device_id.slice(0, 8)}...
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          <MapUpdater selectedDevice={selectedDevice} />
        </MapContainer>
      </div>
    </div>
  );
}

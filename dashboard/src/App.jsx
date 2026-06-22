import React, { useState } from 'react';
import { useDevices } from './hooks/useDevices';
import DeviceList from './components/DeviceList';
import DeviceMap from './components/DeviceMap';
import DeviceDetails from './components/DeviceDetails';
import CommandPanel from './components/CommandPanel';
import APKDownload from './components/APKDownload';
import Login from './components/Login';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('dm_token') === 'authenticated';
  });
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [commandResult, setCommandResult] = useState(null);

  const { devices, loading, error } = useDevices();

  const handleSendCommand = async (command, params = {}) => {
    if (!selectedDevice) return;
    try {
      const res = await fetch(`${API_BASE}/devices/${selectedDevice.device_id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, params }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setCommandResult({ type: 'success', message: `Command "${command}" sent successfully` });
      setTimeout(() => setCommandResult(null), 3000);
    } catch (err) {
      setCommandResult({ type: 'error', message: err.message });
      setTimeout(() => setCommandResult(null), 3000);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  const onlineCount = devices.filter((d) => d.online).length;

  return (
    <div className="flex h-screen overflow-hidden scanline">
      {/* Mobile sidebar toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-accent p-2 rounded-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:static z-40 w-72 h-full bg-card border-r border-accent/30 transition-transform duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="p-5 border-b border-accent/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-xl">
              🖥️
            </div>
            <div>
              <h1 className="text-lg font-bold text-gold">Device Monitor</h1>
              <p className="text-xs text-gray-400">Security Operations Center</p>
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success pulse-online" />
              <span className="text-gray-300">{onlineCount} online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-gray-300">{devices.length} total</span>
            </div>
          </div>
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto">
          <DeviceList
            devices={devices}
            loading={loading}
            error={error}
            selectedDevice={selectedDevice}
            onSelect={(d) => {
              setSelectedDevice(d);
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
          />
        </div>

        {/* APK Download in sidebar */}
        <div className="p-4 border-t border-accent/30">
          <APKDownload />
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-accent/30">
          <button
            onClick={() => {
              localStorage.removeItem('dm_token');
              setIsLoggedIn(false);
            }}
            className="w-full py-2 px-4 rounded-lg bg-danger/20 text-danger text-sm hover:bg-danger/30 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card/80 backdrop-blur border-b border-accent/30 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {selectedDevice ? selectedDevice.device_name : 'Select a Device'}
            </h2>
            {selectedDevice && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                ID: {selectedDevice.device_id}
              </p>
            )}
          </div>
          {selectedDevice && (
            <div className="flex items-center gap-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  selectedDevice.online ? 'bg-success pulse-online' : 'bg-gray-500'
                }`}
              />
              <span className="text-sm text-gray-300">
                {selectedDevice.online ? 'Online' : 'Offline'}
              </span>
            </div>
          )}
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedDevice ? (
            <Placeholder />
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-card rounded-lg p-1 w-fit">
                {['details', 'map', 'commands'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                      activeTab === tab
                        ? 'bg-accent text-white'
                        : 'text-gray-400 hover:text-white hover:bg-accent/50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Command result toast */}
              {commandResult && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    commandResult.type === 'success'
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-danger/20 text-danger border border-danger/30'
                  }`}
                >
                  {commandResult.message}
                </div>
              )}

              {/* Tab content */}
              {activeTab === 'details' && (
                <DeviceDetails device={selectedDevice} />
              )}
              {activeTab === 'map' && (
                <DeviceMap devices={devices} selectedDevice={selectedDevice} />
              )}
              {activeTab === 'commands' && (
                <CommandPanel
                  device={selectedDevice}
                  onSendCommand={handleSendCommand}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <svg className="w-24 h-24 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-400">No Device Selected</h3>
      <p className="text-sm mt-1">Select a device from the sidebar to view details</p>
    </div>
  );
}

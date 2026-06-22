import React, { useState } from 'react';
import { useDeviceData } from '../hooks/useDeviceData';

const COMMANDS = [
  {
    id: 'ring',
    label: 'Ring Device',
    icon: '🔔',
    description: 'Make the device ring at full volume for 30 seconds',
    color: 'bg-warning/20 text-warning border-warning/30 hover:bg-warning/30',
    confirm: false,
  },
  {
    id: 'lock',
    label: 'Lock Device',
    icon: '🔒',
    description: 'Lock the device screen immediately',
    color: 'bg-accent/20 text-blue-400 border-accent/30 hover:bg-accent/30',
    confirm: true,
  },
  {
    id: 'location',
    label: 'Get Location',
    icon: '📍',
    description: 'Request current GPS coordinates',
    color: 'bg-success/20 text-success border-success/30 hover:bg-success/30',
    confirm: false,
  },
  {
    id: 'screenshot',
    label: 'Screenshot',
    icon: '📸',
    description: 'Capture the current screen',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
    confirm: true,
  },
  {
    id: 'camera',
    label: 'Take Photo',
    icon: '📷',
    description: 'Capture a photo with the rear camera',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
    confirm: true,
  },
  {
    id: 'reboot',
    label: 'Reboot Device',
    icon: '🔄',
    description: 'Restart the device',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
    confirm: true,
  },
  {
    id: 'wipe',
    label: 'Factory Reset',
    icon: '⚠️',
    description: 'Wipe all data — this is IRREVERSIBLE',
    color: 'bg-danger/20 text-danger border-danger/30 hover:bg-danger/30',
    confirm: true,
    danger: true,
  },
];

export default function CommandPanel({ device, onSendCommand }) {
  const { commands } = useDeviceData(device.device_id, false);
  const [confirmCommand, setConfirmCommand] = useState(null);
  const [sending, setSending] = useState(null);

  const handleCommand = async (cmd) => {
    if (cmd.confirm && !confirmCommand) {
      setConfirmCommand(cmd.id);
      setTimeout(() => setConfirmCommand(null), 5000);
      return;
    }

    setSending(cmd.id);
    setConfirmCommand(null);
    try {
      await onSendCommand(cmd.id);
    } catch (err) {
      console.error('Command failed:', err);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Command buttons */}
      <div className="bg-card rounded-xl border border-accent/20 p-5">
        <h3 className="text-lg font-semibold text-white mb-1">Remote Commands</h3>
        <p className="text-sm text-gray-400 mb-5">
          Send commands to {device.device_name}. Commands are queued and executed when the device checks in.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMMANDS.map((cmd) => (
            <button
              key={cmd.id}
              onClick={() => handleCommand(cmd)}
              disabled={sending === cmd.id}
              className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${cmd.color} disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{cmd.icon}</span>
                <div>
                  <div className="font-medium text-sm">{cmd.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{cmd.description}</div>
                </div>
              </div>

              {/* Confirm overlay */}
              {confirmCommand === cmd.id && (
                <div className="absolute inset-0 bg-card/95 rounded-xl flex items-center justify-center gap-3 p-4">
                  <span className="text-xs text-warning font-medium">Confirm?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommand(cmd);
                    }}
                    className="px-3 py-1 rounded bg-danger text-white text-xs font-medium"
                  >
                    Yes, {cmd.label}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmCommand(null);
                    }}
                    className="px-3 py-1 rounded bg-accent text-white text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Sending indicator */}
              {sending === cmd.id && (
                <div className="absolute inset-0 bg-card/80 rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pending commands */}
      <div className="bg-card rounded-xl border border-accent/20 p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Command History</h3>

        {commands.length === 0 ? (
          <p className="text-sm text-gray-500">No commands sent yet</p>
        ) : (
          <div className="space-y-2">
            {commands.map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center justify-between p-3 rounded-lg bg-bg/50 border border-accent/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {COMMANDS.find((c) => c.id === cmd.command)?.icon || '📋'}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-white capitalize">
                      {cmd.command}
                    </span>
                    <p className="text-xs text-gray-500 font-mono">
                      {new Date(cmd.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    cmd.status === 'pending'
                      ? 'bg-warning/20 text-warning'
                      : cmd.status === 'executed'
                      ? 'bg-success/20 text-success'
                      : 'bg-danger/20 text-danger'
                  }`}
                >
                  {cmd.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';

export default function APKDownload() {
  return (
    <div className="space-y-2">
      <a
        href="/api/apk"
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors group"
      >
        <span className="text-lg">📥</span>
        <div>
          <span className="text-sm font-medium text-white group-hover:text-gold transition-colors">
            Download APK
          </span>
          <p className="text-xs text-gray-500">Android 8.0+</p>
        </div>
      </a>
      <p className="text-xs text-gray-600 leading-relaxed">
        Install on target device to register and start monitoring.
      </p>
    </div>
  );
}

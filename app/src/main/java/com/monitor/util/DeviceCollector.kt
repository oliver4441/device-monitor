package com.monitor.util

import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Geocoder
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.telephony.TelephonyManager
import com.monitor.model.DeviceData
import java.util.Locale

data class LocationData(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val altitude: Double,
    val speed: Float,
    val bearing: Float,
    val address: String
)

data class BatteryData(
    val level: Int,
    val isCharging: Boolean
)

data class StorageData(
    val total: Long,
    val free: Long
)

data class RamData(
    val total: Long,
    val free: Long
)

data class NetworkData(
    val wifiConnected: Boolean,
    val ssid: String,
    val bssid: String,
    val signalStrength: Int,
    val mobileDataEnabled: Boolean,
    val networkType: String
)

data class TelephonyData(
    val carrierName: String,
    val simSerial: String,
    val phoneNumber: String
)

data class ScreenState(
    val screenOn: Boolean,
    val isLocked: Boolean
)

class DeviceCollector(private val context: Context) {

    private val prefsManager = PrefsManager(context)

    fun collectAllData(): DeviceData {
        val location = getLocationData()
        val battery = getBatteryData()
        val storage = getStorageData()
        val ram = getRamData()
        val network = getNetworkData()
        val telephony = getTelephonyData()
        val screen = getScreenState()
        val apps = getInstalledApps()

        return DeviceData(
            deviceId = prefsManager.getDeviceId(),
            deviceName = prefsManager.getDeviceName(),
            androidVersion = Build.VERSION.RELEASE,
            sdkVersion = Build.VERSION.SDK_INT,
            batteryLevel = battery.level,
            isCharging = battery.isCharging,
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy,
            altitude = location.altitude,
            speed = location.speed,
            bearing = location.bearing,
            address = location.address,
            storageTotal = storage.total,
            storageFree = storage.free,
            ramTotal = ram.total,
            ramFree = ram.free,
            wifiConnected = network.wifiConnected,
            wifiSsid = network.ssid,
            wifiBssid = network.bssid,
            wifiSignalStrength = network.signalStrength,
            mobileDataEnabled = network.mobileDataEnabled,
            networkType = network.networkType,
            carrierName = telephony.carrierName,
            simSerial = telephony.simSerial,
            phoneNumber = telephony.phoneNumber,
            screenOn = screen.screenOn,
            isLocked = screen.isLocked,
            installedApps = apps,
            timestamp = System.currentTimeMillis()
        )
    }

    private fun getLocationData(): LocationData {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        var lat = 0.0
        var lng = 0.0
        var accuracy = 0f
        var altitude = 0.0
        var speed = 0f
        var bearing = 0f
        var address = "Unknown"

        try {
            val providers = locationManager.getProviders(true)
            var bestLocation: android.location.Location? = null

            for (provider in providers) {
                try {
                    val loc = locationManager.getLastKnownLocation(provider) ?: continue
                    if (bestLocation == null || loc.accuracy < bestLocation.accuracy) {
                        bestLocation = loc
                    }
                } catch (_: SecurityException) {}
            }

            bestLocation?.let {
                lat = it.latitude
                lng = it.longitude
                accuracy = it.accuracy
                altitude = it.altitude
                speed = it.speed
                bearing = it.bearing

                try {
                    @Suppress("DEPRECATION")
                    val geocoder = Geocoder(context, Locale.getDefault())
                    @Suppress("DEPRECATION")
                    val addresses = geocoder.getFromLocation(lat, lng, 1)
                    if (!addresses.isNullOrEmpty()) {
                        address = addresses[0].getAddressLine(0) ?: "Unknown"
                    }
                } catch (_: Exception) {
                    address = "$lat, $lng"
                }
            }
        } catch (_: Exception) {}

        return LocationData(lat, lng, accuracy, altitude, speed, bearing, address)
    }

    private fun getBatteryData(): BatteryData {
        val intentFilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus = context.registerReceiver(null, intentFilter)

        var level = 0
        var isCharging = false

        batteryStatus?.let {
            val rawLevel = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            level = if (rawLevel >= 0 && scale > 0) (rawLevel * 100 / scale) else 0

            val status = it.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL
        }

        return BatteryData(level, isCharging)
    }

    private fun getStorageData(): StorageData {
        return try {
            val stat = StatFs(Environment.getDataDirectory().path)
            StorageData(stat.totalBytes, stat.availableBytes)
        } catch (_: Exception) {
            StorageData(0L, 0L)
        }
    }

    private fun getRamData(): RamData {
        return try {
            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memInfo)
            RamData(memInfo.totalMem, memInfo.availMem)
        } catch (_: Exception) {
            RamData(0L, 0L)
        }
    }

    @Suppress("DEPRECATION")
    private fun getNetworkData(): NetworkData {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        var wifiConnected = false
        var ssid = ""
        var bssid = ""
        var signalStrength = 0
        var mobileData = false
        var networkType = "None"

        try {
            val network = connectivityManager.activeNetwork
            val capabilities = connectivityManager.getNetworkCapabilities(network)

            wifiConnected = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            mobileData = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

            when {
                wifiConnected -> networkType = "WiFi"
                mobileData -> {
                    networkType = when (connectivityManager.activeNetworkInfo?.subtype) {
                        TelephonyManager.NETWORK_TYPE_LTE -> "4G"
                        TelephonyManager.NETWORK_TYPE_NR -> "5G"
                        TelephonyManager.NETWORK_TYPE_UMTS,
                        TelephonyManager.NETWORK_TYPE_HSPA,
                        TelephonyManager.NETWORK_TYPE_HSPAP -> "3G"
                        TelephonyManager.NETWORK_TYPE_EDGE,
                        TelephonyManager.NETWORK_TYPE_GPRS -> "2G"
                        else -> "Mobile"
                    }
                }
            }

            if (wifiConnected) {
                try {
                    val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                    val wifiInfo = wifiManager.connectionInfo
                    ssid = wifiInfo.ssid?.removeSurrounding("\"") ?: ""
                    bssid = wifiInfo.bssid ?: ""
                    signalStrength = WifiManager.calculateSignalLevel(wifiInfo.rssi, 100)
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}

        return NetworkData(wifiConnected, ssid, bssid, signalStrength, mobileData, networkType)
    }

    @Suppress("DEPRECATION")
    private fun getTelephonyData(): TelephonyData {
        return try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val carrierName = telephonyManager.networkOperatorName ?: "Unknown"
            val simSerial = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                "Restricted (Android 10+)"
            } else {
                try { telephonyManager.simSerialNumber ?: "Unknown" } catch (_: Exception) { "Unknown" }
            }
            val phoneNumber = try { telephonyManager.line1Number ?: "Unknown" } catch (_: Exception) { "Unknown" }
            TelephonyData(carrierName, simSerial, phoneNumber)
        } catch (_: Exception) {
            TelephonyData("Unknown", "Unknown", "Unknown")
        }
    }

    private fun getScreenState(): ScreenState {
        return try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val screenOn = powerManager.isInteractive

            val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            val isLocked = keyguardManager.isDeviceLocked

            ScreenState(screenOn, isLocked)
        } catch (_: Exception) {
            ScreenState(false, false)
        }
    }

    @Suppress("DEPRECATION")
    private fun getInstalledApps(): List<String> {
        return try {
            val pm = context.packageManager
            val packages = pm.getInstalledApplications(0)
            packages.map { it.loadLabel(pm).toString() }.sorted()
        } catch (_: Exception) {
            emptyList()
        }
    }
}

package com.monitor.util

import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Address
import android.location.Geocoder
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.storage.StorageManager
import android.provider.Settings
import android.telephony.TelephonyManager
import com.monitor.model.DeviceData
import java.io.File
import java.util.Locale

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
            batteryLevel = battery.first,
            isCharging = battery.second,
            latitude = location.first,
            longitude = location.second,
            accuracy = location.third,
            altitude = location.fourth,
            speed = location.fifth,
            bearing = location.sixth,
            address = location.seventh,
            storageTotal = storage.first,
            storageFree = storage.second,
            ramTotal = ram.first,
            ramFree = ram.second,
            wifiConnected = network.first,
            wifiSsid = network.second,
            wifiBssid = network.third,
            wifiSignalStrength = network.fourth,
            mobileDataEnabled = network.fifth,
            networkType = network.sixth,
            carrierName = telephony.first,
            simSerial = telephony.second,
            phoneNumber = telephony.third,
            screenOn = screen.first,
            isLocked = screen.second,
            installedApps = apps,
            timestamp = System.currentTimeMillis()
        )
    }

    private fun getLocationData(): Triple<Double, Double, Float, Double, Float, Float, String> {
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

                // Reverse geocode to get address
                try {
                    val geocoder = Geocoder(context, Locale.getDefault())
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        geocoder.getFromLocation(lat, lng, 1) { addresses ->
                            if (addresses.isNotEmpty()) {
                                address = addresses[0].getAddressLine(0) ?: "Unknown"
                            }
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        val addresses = geocoder.getFromLocation(lat, lng, 1)
                        if (!addresses.isNullOrEmpty()) {
                            address = addresses[0].getAddressLine(0) ?: "Unknown"
                        }
                    }
                } catch (_: Exception) {
                    address = "$lat, $lng"
                }
            }
        } catch (_: Exception) {}

        return Triple(lat, lng, accuracy, altitude, speed, bearing, address)
    }

    private fun getBatteryData(): Pair<Int, Boolean> {
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

        return Pair(level, isCharging)
    }

    private fun getStorageData(): Pair<Long, Long> {
        return try {
            val stat = StatFs(Environment.getDataDirectory().path)
            val total = stat.totalBytes
            val free = stat.availableBytes
            Pair(total, free)
        } catch (_: Exception) {
            Pair(0L, 0L)
        }
    }

    private fun getRamData(): Pair<Long, Long> {
        return try {
            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memInfo)
            Pair(memInfo.totalMem, memInfo.availMem)
        } catch (_: Exception) {
            Pair(0L, 0L)
        }
    }

    @Suppress("DEPRECATION")
    private fun getNetworkData(): Triple<Boolean, String, String, Int, Boolean, String> {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        var wifiConnected = false
        var ssid = ""
        var bssid = ""
        var signalStrength = 0
        var mobileData = false
        var networkType = "None"

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
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
            } else {
                val activeNetwork = connectivityManager.activeNetworkInfo
                wifiConnected = activeNetwork?.type == ConnectivityManager.TYPE_WIFI
                mobileData = activeNetwork?.type == ConnectivityManager.TYPE_MOBILE
                networkType = if (wifiConnected) "WiFi" else if (mobileData) "Mobile" else "None"
            }

            // WiFi details
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

        return Triple(wifiConnected, ssid, bssid, signalStrength, mobileData, networkType)
    }

    @Suppress("DEPRECATION")
    private fun getTelephonyData(): Triple<String, String, String> {
        return try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val carrierName = telephonyManager.networkOperatorName ?: "Unknown"
            val simSerial = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                "Restricted (Android 10+)"
            } else {
                try { telephonyManager.simSerialNumber ?: "Unknown" } catch (_: Exception) { "Unknown" }
            }
            val phoneNumber = try { telephonyManager.line1Number ?: "Unknown" } catch (_: Exception) { "Unknown" }
            Triple(carrierName, simSerial, phoneNumber)
        } catch (_: Exception) {
            Triple("Unknown", "Unknown", "Unknown")
        }
    }

    private fun getScreenState(): Pair<Boolean, Boolean> {
        return try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            val screenOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                powerManager.isInteractive
            } else {
                @Suppress("DEPRECATION")
                powerManager.isScreenOn
            }

            val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            val isLocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                keyguardManager.isDeviceLocked
            } else {
                @Suppress("DEPRECATION")
                keyguardManager.inKeyguardRestrictedInputState
            }

            Pair(screenOn, isLocked)
        } catch (_: Exception) {
            Pair(false, false)
        }
    }

    private fun getInstalledApps(): List<String> {
        return try {
            val pm = context.packageManager
            val packages = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getInstalledApplications(0)
            }
            packages.map { it.loadLabel(pm).toString() }.sorted()
        } catch (_: Exception) {
            emptyList()
        }
    }
}

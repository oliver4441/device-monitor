package com.monitor.model

data class DeviceData(
    val deviceId: String,
    val deviceName: String,
    val androidVersion: String,
    val sdkVersion: Int,
    val batteryLevel: Int,
    val isCharging: Boolean,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float,
    val altitude: Double,
    val speed: Float,
    val bearing: Float,
    val address: String,
    val storageTotal: Long,
    val storageFree: Long,
    val ramTotal: Long,
    val ramFree: Long,
    val wifiConnected: Boolean,
    val wifiSsid: String,
    val wifiBssid: String,
    val wifiSignalStrength: Int,
    val mobileDataEnabled: Boolean,
    val networkType: String,
    val carrierName: String,
    val simSerial: String,
    val phoneNumber: String,
    val screenOn: Boolean,
    val isLocked: Boolean,
    val installedApps: List<String>,
    val timestamp: Long
)

data class AlertData(
    val deviceId: String,
    val alertType: String,
    val message: String,
    val severity: String,
    val timestamp: Long
)

data class CommandRequest(
    val command: String,
    val deviceId: String,
    val params: Map<String, String>
)

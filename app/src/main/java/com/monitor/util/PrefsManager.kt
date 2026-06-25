package com.monitor.util

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("device_monitor", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SETUP_COMPLETE = "setup_complete"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_API_URL = "api_url"
        private const val KEY_API_KEY = "api_key"
        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_MONITOR_INTERVAL = "monitor_interval"
    }

    fun isSetupComplete(): Boolean = prefs.getBoolean(KEY_SETUP_COMPLETE, false)

    fun setSetupComplete(complete: Boolean) = prefs.edit().putBoolean(KEY_SETUP_COMPLETE, complete).apply()

    fun getDeviceId(): String {
        var id = prefs.getString(KEY_DEVICE_ID, null)
        if (id == null) {
            id = java.util.UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, id).apply()
        }
        return id
    }

    fun setDeviceId(id: String) = prefs.edit().putString(KEY_DEVICE_ID, id).apply()

    fun getApiUrl(): String = prefs.getString(KEY_API_URL, "https://device-monitor-r97y.onrender.com")!!

    fun setApiUrl(url: String) = prefs.edit().putString(KEY_API_URL, url).apply()

    fun getApiKey(): String = prefs.getString(KEY_API_KEY, "")!!

    fun setApiKey(key: String) = prefs.edit().putString(KEY_API_KEY, key).apply()

    fun getDeviceName(): String = prefs.getString(KEY_DEVICE_NAME, android.os.Build.MODEL)!!

    fun setDeviceName(name: String) = prefs.edit().putString(KEY_DEVICE_NAME, name).apply()

    fun getMonitorInterval(): Long = prefs.getLong(KEY_MONITOR_INTERVAL, 5) // minutes

    fun setMonitorInterval(minutes: Long) = prefs.edit().putLong(KEY_MONITOR_INTERVAL, minutes).apply()
}

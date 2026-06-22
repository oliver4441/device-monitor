package com.monitor.util

import android.util.Log
import com.monitor.model.DeviceData
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(private val prefsManager: PrefsManager) {

    companion object {
        private const val TAG = "ApiClient"
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private val gson = Gson()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private fun getBaseUrl(): String = prefsManager.getApiUrl()
    private fun getApiKey(): String = prefsManager.getApiKey()
    private fun getDeviceId(): String = prefsManager.getDeviceId()

    /**
     * Send device data to the backend.
     */
    fun sendData(data: DeviceData): Boolean {
        return try {
            val json = gson.toJson(data)
            val requestBody = json.toRequestBody(JSON)

            val request = Request.Builder()
                .url("${getBaseUrl()}/api/data")
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer ${getApiKey()}")
                .addHeader("X-Device-ID", getDeviceId())
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val success = response.isSuccessful
            Log.d(TAG, "Send data: ${response.code} - ${if (success) "OK" else "FAILED"}")
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Send data error: ${e.message}")
            false
        }
    }

    /**
     * Register device with the backend and get API key.
     */
    fun registerDevice(): String? {
        return try {
            val json = """{"deviceId":"${getDeviceId()}","deviceName":"${prefsManager.getDeviceName()}"}"""
            val requestBody = json.toRequestBody(JSON)

            val request = Request.Builder()
                .url("${getBaseUrl()}/api/register")
                .addHeader("Content-Type", "application/json")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string()
            response.close()

            if (response.isSuccessful && body != null) {
                val map = gson.fromJson(body, Map::class.java)
                val apiKey = map["apiKey"] as? String
                if (apiKey != null) {
                    prefsManager.setApiKey(apiKey)
                    Log.d(TAG, "Device registered successfully")
                }
                apiKey
            } else {
                Log.e(TAG, "Registration failed: ${response.code}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Registration error: ${e.message}")
            null
        }
    }

    /**
     * Check for pending commands from the dashboard.
     */
    fun getCommands(): List<Map<String, String>>? {
        return try {
            val request = Request.Builder()
                .url("${getBaseUrl()}/api/commands/${getDeviceId()}")
                .addHeader("Authorization", "Bearer ${getApiKey()}")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string()
            response.close()

            if (response.isSuccessful && body != null) {
                val type = object : com.google.gson.reflect.TypeToken<List<Map<String, String>>>() {}.type
                gson.fromJson(body, type)
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Get commands error: ${e.message}")
            null
        }
    }

    /**
     * Acknowledge that a command was executed.
     */
    fun acknowledgeCommand(commandId: String): Boolean {
        return try {
            val json = """{"commandId":"$commandId"}"""
            val requestBody = json.toRequestBody(JSON)

            val request = Request.Builder()
                .url("${getBaseUrl()}/api/commands/${getDeviceId()}/ack")
                .addHeader("Authorization", "Bearer ${getApiKey()}")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val success = response.isSuccessful
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Ack command error: ${e.message}")
            false
        }
    }
}

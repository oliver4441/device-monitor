# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in android/sdk/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Kotlin metadata
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }

# Keep data classes
-keep class com.monitor.model.** { *; }

# Keep classes used by reflection
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }

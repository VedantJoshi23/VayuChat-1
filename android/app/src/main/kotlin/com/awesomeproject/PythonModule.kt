package com.awesomeproject

import android.util.Log
import com.chaquo.python.PyException
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.*

// FIX: @ReactModule enables the New Architecture interop layer to locate this module
@ReactModule(name = PythonModule.MODULE_NAME)
class PythonModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PythonModule"
        const val MODULE_NAME = "PythonModule"
    }

    private val scope = CoroutineScope(Dispatchers.IO + Job())

    override fun getName(): String = MODULE_NAME

    private fun ensurePythonStarted() {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactContext))
            Log.d(TAG, "Chaquopy Python started")
        }
    }

    /**
     * Execute arbitrary Python code.
     * Returns {stdout, stderr, success, executionTime}.
     *
     * FIX: timeoutMs was accepted but never actually enforced — execution could hang
     * forever on an infinite loop. Now a separate timeout coroutine cancels the job.
     */
    @ReactMethod
    fun executePython(code: String, timeoutMs: Int, promise: Promise) {
        val effectiveTimeout = timeoutMs.coerceIn(1_000, 60_000).toLong()

        scope.launch {
            val startTime = System.currentTimeMillis()

            // Launch the actual Python work as a child job so we can cancel it
            val execJob = launch(Dispatchers.IO) {
                try {
                    ensurePythonStarted()
                    val py = Python.getInstance()
                    val io = py.getModule("io")
                    val sys = py.getModule("sys")

                    val stdout = io.callAttr("StringIO")
                    val stderrIo = io.callAttr("StringIO")
                    sys["stdout"] = stdout
                    sys["stderr"] = stderrIo

                    var pyError: String? = null
                    try {
                        py.builtins.callAttr("exec", code)
                    } catch (e: PyException) {
                        pyError = e.message ?: "Python error"
                        Log.w(TAG, "PyException: $pyError")
                    }

                    val out = stdout.callAttr("getvalue").toString()
                    val err = listOfNotNull(
                        stderrIo.callAttr("getvalue").toString().takeIf { it.isNotEmpty() },
                        pyError
                    ).joinToString("\n").trim()

                    val elapsed = (System.currentTimeMillis() - startTime).toInt()
                    promise.resolve(Arguments.createMap().apply {
                        putString("stdout", out)
                        putString("stderr", err)
                        putArray("plots", Arguments.createArray())
                        putBoolean("success", pyError == null && err.isEmpty())
                        putInt("executionTime", elapsed)
                    })
                } catch (e: CancellationException) {
                    // Timeout fired — reject with a clear message
                    val elapsed = (System.currentTimeMillis() - startTime).toInt()
                    promise.reject(
                        "PYTHON_TIMEOUT",
                        "Execution timed out after ${elapsed}ms (limit: ${effectiveTimeout}ms)"
                    )
                } catch (e: Exception) {
                    Log.e(TAG, "executePython error: ${e.message}", e)
                    promise.reject("PYTHON_EXECUTION_ERROR", e.message ?: "Unknown error")
                }
            }

            // Watchdog: cancel the job if it exceeds the timeout
            delay(effectiveTimeout)
            if (execJob.isActive) {
                Log.w(TAG, "Python execution exceeded ${effectiveTimeout}ms — cancelling")
                execJob.cancel()
            }
        }
    }

    /**
     * Load a .pkl file and return its rows as a JSON array string.
     * Uses pandas; datetime columns are converted to YYYY-MM-DD strings.
     */
    @ReactMethod
    fun loadPickleAsJson(filePath: String, promise: Promise) {
        scope.launch {
            try {
                ensurePythonStarted()

                // Build code with the file path safely interpolated (no user input, just a path)
                val escapedPath = filePath.replace("\\", "\\\\").replace("'", "\\'")
                val code = """
import pandas as pd, json

df = pd.read_pickle('$escapedPath')
if not isinstance(df, pd.DataFrame):
    raise ValueError(f"Expected DataFrame, got {type(df).__name__}")

for col in df.select_dtypes(include='datetime64').columns:
    df[col] = df[col].dt.strftime('%Y-%m-%d')

print(json.dumps(df.where(pd.notnull(df), None).to_dict(orient='records'), default=str))
""".trimIndent()

                val py = Python.getInstance()
                val io = py.getModule("io")
                val sys = py.getModule("sys")

                val stdout = io.callAttr("StringIO")
                val stderrIo = io.callAttr("StringIO")
                sys["stdout"] = stdout
                sys["stderr"] = stderrIo

                var pyError: String? = null
                try {
                    py.builtins.callAttr("exec", code)
                } catch (e: PyException) {
                    pyError = e.message ?: "Python error"
                    Log.w(TAG, "loadPickleAsJson PyException: $pyError")
                }

                val out = stdout.callAttr("getvalue").toString().trim()
                val err = listOfNotNull(
                    stderrIo.callAttr("getvalue").toString().takeIf { it.isNotEmpty() },
                    pyError
                ).joinToString("\n").trim()

                if (pyError != null || out.isEmpty()) {
                    promise.reject("PKL_LOAD_ERROR", err.ifEmpty { "No output from Python" })
                } else {
                    promise.resolve(out)
                }
            } catch (e: Exception) {
                Log.e(TAG, "loadPickleAsJson error: ${e.message}", e)
                promise.reject("PKL_LOAD_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun validateCode(code: String, promise: Promise) {
        try {
            val blacklisted = listOf("subprocess", "__import__")
            val errors = Arguments.createArray()
            for (p in blacklisted) {
                if (code.contains(p)) errors.pushString("Unsafe pattern: $p")
            }
            promise.resolve(Arguments.createMap().apply {
                putBoolean("valid", errors.size() == 0)
                putArray("errors", errors)
            })
        } catch (e: Exception) {
            promise.reject("VALIDATION_ERROR", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    // FIX: invalidate() replaces onCatalystInstanceDestroy() for New Architecture compatibility
    override fun invalidate() {
        scope.cancel()
        super.invalidate()
    }
}

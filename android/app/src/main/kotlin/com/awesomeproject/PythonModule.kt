package com.awesomeproject

import android.util.Log
import com.chaquo.python.PyException
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.*

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
     * Execute arbitrary Python code and return {stdout, stderr, success, executionTime}.
     *
     * Delegates to code_runner.py (src/main/python/code_runner.py) so that
     * exec() runs inside a proper Python stack frame rather than being called
     * directly from Kotlin — the latter causes "SystemError: frame does not exist"
     * in CPython because exec() without explicit globals needs a live frame.
     *
     * A coroutine watchdog enforces the timeout; it cancels the IO coroutine
     * which then rejects the promise with PYTHON_TIMEOUT.
     */
    @ReactMethod
    fun executePython(code: String, timeoutMs: Int, promise: Promise) {
        val effectiveTimeout = timeoutMs.coerceIn(1_000, 60_000).toLong()
        val startTime = System.currentTimeMillis()

        scope.launch {
            val execJob = launch(Dispatchers.IO) {
                try {
                    ensurePythonStarted()
                    val py         = Python.getInstance()
                    val codeRunner = py.getModule("code_runner")

                    // run_code() returns a Python dict; read each field via dict.get(key)
                    val result     = codeRunner.callAttr("run_code", code)

                    val stdout    = result.callAttr("get", "stdout")?.toString()    ?: ""
                    val stderr    = result.callAttr("get", "stderr")?.toString()    ?: ""
                    val success   = result.callAttr("get", "success")?.toString()   == "True"
                    val execTimeStr = result.callAttr("get", "executionTime")?.toString()
                    val elapsed   = execTimeStr?.toIntOrNull()
                                    ?: (System.currentTimeMillis() - startTime).toInt()

                    Log.d(TAG, "executePython: done in ${elapsed}ms success=$success")

                    promise.resolve(Arguments.createMap().apply {
                        putString("stdout", stdout)
                        putString("stderr", stderr)
                        putArray("plots", Arguments.createArray())
                        putBoolean("success", success)
                        putInt("executionTime", elapsed)
                    })
                } catch (e: CancellationException) {
                    val elapsed = (System.currentTimeMillis() - startTime).toInt()
                    promise.reject(
                        "PYTHON_TIMEOUT",
                        "Execution timed out after ${elapsed}ms (limit: ${effectiveTimeout}ms)"
                    )
                } catch (e: PyException) {
                    Log.e(TAG, "executePython Python error: ${e.message}", e)
                    promise.reject("PYTHON_EXECUTION_ERROR", e.message ?: "Python error")
                } catch (e: Exception) {
                    Log.e(TAG, "executePython error: ${e.message}", e)
                    promise.reject("PYTHON_EXECUTION_ERROR", e.message ?: "Unknown error")
                }
            }

            // Watchdog: cancel the child job after the timeout
            delay(effectiveTimeout)
            if (execJob.isActive) {
                Log.w(TAG, "Python execution exceeded ${effectiveTimeout}ms — cancelling")
                execJob.cancel()
            }
        }
    }

    /**
     * Load a .pkl file and return its rows as a JSON array string.
     *
     * Delegates to pkl_utils.py (src/main/python/pkl_utils.py).
     * Using getModule() + callAttr() establishes a proper Python stack frame,
     * which is required for pandas I/O and avoids "SystemError: frame does not exist"
     * that occurs when exec() is invoked directly from a Kotlin coroutine thread.
     *
     * Supported pickle payloads: DataFrame, list-of-dicts, dict-of-columns.
     * Datetime columns are serialised as YYYY-MM-DD strings; NaN/NaT → null.
     */
    @ReactMethod
    fun loadPickleAsJson(filePath: String, promise: Promise) {
        scope.launch {
            try {
                ensurePythonStarted()
                val py       = Python.getInstance()
                val pklUtils = py.getModule("pkl_utils")

                Log.d(TAG, "loadPickleAsJson: loading $filePath")
                val result = pklUtils.callAttr("load_as_json", filePath)?.toString() ?: ""

                if (result.isEmpty()) {
                    Log.e(TAG, "loadPickleAsJson: empty result for $filePath")
                    promise.reject("PKL_LOAD_ERROR", "Pickle produced an empty result")
                } else {
                    Log.d(TAG, "loadPickleAsJson: success, ${result.length} chars")
                    promise.resolve(result)
                }
            } catch (e: PyException) {
                Log.e(TAG, "loadPickleAsJson Python error: ${e.message}", e)
                promise.reject("PKL_LOAD_ERROR", e.message ?: "Python error loading pickle")
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

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun invalidate() {
        scope.cancel()
        super.invalidate()
    }
}

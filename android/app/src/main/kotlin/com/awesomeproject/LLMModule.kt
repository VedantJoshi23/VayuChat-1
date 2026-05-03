package com.awesomeproject

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import org.pytorch.executorch.extension.llm.LlmCallback
import org.pytorch.executorch.extension.llm.LlmModule

@ReactModule(name = LLMModule.MODULE_NAME)
class LLMModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LLMModule"
        const val MODULE_NAME = "LLMModule"
    }

    // Use IO dispatcher: model load mmaps ~1 GB from disk, generate blocks until done.
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var llmModule: LlmModule? = null
    private var modelLoaded = false

    override fun getName(): String = MODULE_NAME

    /**
     * Load a PTE model.
     *
     * @param modelPath     Absolute path to the .pte file
     * @param tokenizerPath Absolute path to the tokenizer file (tokenizer.bin / tokenizer.model)
     * @param temperature   Sampling temperature (e.g. 0.8)
     */
    @ReactMethod
    fun loadModel(modelPath: String, tokenizerPath: String, temperature: Float, promise: Promise) {
        scope.launch {
            try {
                Log.d(TAG, "loadModel: model=$modelPath  tokenizer=$tokenizerPath  temp=$temperature")

                // Release any previously loaded model before loading a new one
                llmModule?.resetNative()
                llmModule = null
                modelLoaded = false

                // LlmModule's static initializer calls System.loadLibrary("executorch"),
                // so libexecutorch.so is loaded automatically here.
                val module = LlmModule(modelPath, tokenizerPath, temperature)

                // load() memory-maps the PTE file; returns 0 on success
                val loadResult = module.load()
                if (loadResult == 0) {
                    llmModule = module
                    modelLoaded = true
                    Log.d(TAG, "loadModel: success")
                    promise.resolve(true)
                    sendEvent("onModelLoaded", Arguments.createMap().apply {
                        putString("modelPath", modelPath)
                    })
                } else {
                    Log.e(TAG, "loadModel: ExecuTorch load() returned error code $loadResult")
                    promise.reject("LOAD_MODEL_FAILED", "ExecuTorch load() returned error code: $loadResult")
                }
            } catch (e: Exception) {
                Log.e(TAG, "loadModel exception: ${e.message}", e)
                promise.reject("LOAD_MODEL_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Generate text from a prompt.
     * Tokens are streamed via the "onToken" event as they are produced.
     *
     * @param prompt    Full prompt string (system + history + user turn)
     * @param maxTokens Maximum tokens to generate
     */
    @ReactMethod
    fun generate(prompt: String, maxTokens: Int, promise: Promise) {
        val module = llmModule
        if (!modelLoaded || module == null) {
            promise.reject("MODEL_NOT_LOADED", "Call loadModel() before generate()")
            return
        }

        scope.launch {
            try {
                Log.d(TAG, "generate: promptLen=${prompt.length}  maxTokens=$maxTokens")

                val resultCode = module.generate(
                    prompt,
                    maxTokens,
                    object : LlmCallback {
                        override fun onResult(token: String) {
                            sendEvent("onToken", Arguments.createMap().apply {
                                putString("token", token)
                            })
                        }
                    },
                    false // echo=false: don't re-emit the prompt tokens
                )

                Log.d(TAG, "generate: finished with code $resultCode")
                promise.resolve(resultCode)
            } catch (e: Exception) {
                Log.e(TAG, "generate exception: ${e.message}", e)
                promise.reject("GENERATE_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Interrupt an in-progress generate() call.
     * Safe to call from any thread.
     */
    @ReactMethod
    fun stopGeneration(promise: Promise) {
        try {
            llmModule?.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "stopGeneration exception: ${e.message}", e)
            promise.reject("STOP_ERROR", e.message ?: "Unknown error")
        }
    }

    /**
     * Unload the model and free native memory.
     */
    @ReactMethod
    fun unloadModel(promise: Promise) {
        try {
            llmModule?.resetNative()
            llmModule = null
            modelLoaded = false
            promise.resolve(true)
            sendEvent("onModelUnloaded", Arguments.createMap())
        } catch (e: Exception) {
            Log.e(TAG, "unloadModel exception: ${e.message}", e)
            promise.reject("UNLOAD_MODEL_ERROR", e.message ?: "Unknown error")
        }
    }

    // Required boilerplate for RCTDeviceEventEmitter subscriptions
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "sendEvent $eventName failed: ${e.message}")
        }
    }

    override fun invalidate() {
        scope.cancel()
        try {
            llmModule?.resetNative()
            llmModule = null
        } catch (e: Exception) {
            Log.w(TAG, "invalidate cleanup error: ${e.message}")
        }
        super.invalidate()
    }
}

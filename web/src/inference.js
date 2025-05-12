importScripts('./lib/tf.min.3.5.0.js');
importScripts('./lib/essentia.js-model.umd.js');

let model;
let modelName = "";
let initializationPromise = null; // Promise resolves when model is ready, rejects on error

const modelTagOrder = {
    'mood_happy': [true, false],
    'mood_sad': [false, true],
    'mood_relaxed': [false, true],
    'mood_aggressive': [true, false],
    'danceability': [true, false]
};

function postError(message, songIndex = null, modelNameOverride = null) {
    const name = modelNameOverride || modelName || 'Unknown';
    console.error(`Model ${name}: ${message}`);
    postMessage({
        error: message,
        modelName: name,
        songIndex: songIndex
    });
}

function initModel(name, initialSongIndex) {
    if (initializationPromise) {
        // Log the current state of the existing promise
        initializationPromise.then(
            () => console.warn(`[${name}] Init called but model ${modelName} initialization promise already resolved. Ignoring.`),
            (err) => console.warn(`[${name}] Init called but model ${modelName} initialization previously failed (${err.message}). Ignoring.`)
        );
        return;
    }

    modelName = name;
    console.log(`[${modelName}] Starting initialization (song index ${initialSongIndex} triggered).`);

    initializationPromise = new Promise(async (resolve, reject) => {
        const initStartTime = Date.now();
        try {
            // 1. Initialize TF Backend
            console.log(`[${modelName}] Step 1: Initializing TF Backend...`);
            await initTensorflowWASM();
            console.log(`[${modelName}] TF Backend ready.`);

            // 2. Create Model Instance
            console.log(`[${modelName}] Step 2: Creating Model Instance...`);
            const modelURL = getModelURL(modelName);
            console.info(`[${modelName}] Loading model from: ${modelURL}`);
            model = new EssentiaModel.TensorflowMusiCNN(tf, modelURL);

            // 3. Load Model (initialize)
            console.log(`[${modelName}] Step 3: Loading/Initializing Model via model.initialize()...`);
            const loadTimeoutDuration = 30000; // 30 seconds
            const loadTimeout = setTimeout(() => {
                reject(new Error(`Model loading timed out after ${loadTimeoutDuration / 1000}s`));
            }, loadTimeoutDuration);

            try {
                await loadModel();
                clearTimeout(loadTimeout);
                console.log(`[${modelName}] Model loaded/initialized.`);
            } catch (loadErr) {
                clearTimeout(loadTimeout);
                throw loadErr;
            }

            // Add timeout for warmup prediction
            const warmupTimeoutDuration = 10000; // 10 seconds for warmup prediction
            const warmupTimeout = setTimeout(() => {
                console.error(`[${modelName}] Warmup timed out!`);
                reject(new Error(`Model warmup timed out after ${warmupTimeoutDuration / 1000}s`));
            }, warmupTimeoutDuration);

            try {
                console.log(`[${modelName}] Step 4: Warming up model via predict()...`);
                await warmUp(); // Calls model.predict()
                clearTimeout(warmupTimeout);
                const initTotalTime = Date.now() - initStartTime;
                console.log(`[${modelName}] Model warmup complete. Initialization successful (Total time: ${initTotalTime}ms).`);
                resolve(); // SUCCESS: Mark initialization as complete
                // Notify main thread of success
                postMessage({ type: 'status', status: 'initialized', modelName: modelName });
            } catch (warmupErr) {
                clearTimeout(warmupTimeout);
                throw warmupErr;
            }

        } catch (err) {
            console.error(`[${modelName}] Initialization failed: ${err.message}`);
            model = null;
            reject(err);
        }
    });

    initializationPromise.catch(err => {
        console.error(`[${modelName}] Initialization promise rejected. Model will not be available.`);
        postMessage({ type: 'status', status: 'init_failed', modelName: modelName, error: err ? err.message : 'Unknown initialization error' });
    });
}

function getModelURL(name) {
    return `../models/${name}-musicnn-msd-2/model.json`;
}

async function loadModel() {
    await model.initialize();
}

async function warmUp() {
    const fakeFeatures = {
        melSpectrum: getZeroMatrix(187, 96),
        frameSize: 187,
        melBandsSize: 96,
        patchSize: 187
    };
    console.log(`[${modelName}] Starting model warm-up predict...`);
    const fakeStart = Date.now();
    await model.predict(fakeFeatures, false);
    console.info(`[${modelName}] Warm up inference took: ${Date.now() - fakeStart}ms`);
}

async function initTensorflowWASM() {
    if (tf.getBackend() === 'wasm') {
        console.info('[TFJS] WASM backend already initialized.');
        return Promise.resolve();
    }
    console.log('[TFJS] Initializing WASM backend...');
    try {
        importScripts('./lib/tf-backend-wasm-3.5.0.js');
        await tf.setBackend('wasm');
        await tf.ready();
        console.info('[TFJS] WASM backend successfully initialized!');
        return Promise.resolve();
    } catch (err) {
        console.error(`[TFJS] WASM could NOT be initialized, defaulting to ${tf.getBackend()}. Error: ${err.message}`);
        return Promise.reject(err);
    }
}

function outputPredictions(p, songIndex) {
    let value = p;
    
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        console.warn(`[${modelName}] Invalid prediction value for song ${songIndex}: ${value}, using fallback 0.5`);
        value = 0.5;
    }
    
    value = Math.max(0, Math.min(1, value));
    
    postMessage({
        predictions: value,
        modelName: modelName,
        songIndex: songIndex
    });
}

function twoValuesAverage(arrayOfArrays) {
    try {
        if (!Array.isArray(arrayOfArrays) || arrayOfArrays.length === 0) {
            console.warn("Invalid input to twoValuesAverage");
            return [0.5, 0.5];
        }
        
        let firstValues = [];
        let secondValues = [];

        arrayOfArrays.forEach((v) => {
            if (Array.isArray(v) && v.length >= 2) {
                const first = typeof v[0] === 'number' && !isNaN(v[0]) ? v[0] : 0.5;
                const second = typeof v[1] === 'number' && !isNaN(v[1]) ? v[1] : 0.5;
                
                firstValues.push(first);
                secondValues.push(second);
            }
        });
        
        if (firstValues.length === 0 || secondValues.length === 0) {
            return [0.5, 0.5];
        }

        const firstValuesAvg = firstValues.reduce((acc, val) => acc + val, 0) / firstValues.length;
        const secondValuesAvg = secondValues.reduce((acc, val) => acc + val, 0) / secondValues.length;

        return [
            isNaN(firstValuesAvg) ? 0.5 : firstValuesAvg,
            isNaN(secondValuesAvg) ? 0.5 : secondValuesAvg
        ];
    } catch (err) {
        console.error("Error in twoValuesAverage:", err);
        return [0.5, 0.5];
    }
}

async function runPrediction(features, songIndex) {
    console.log(`[${modelName}] Running prediction for song ${songIndex}`);
    const inferenceStart = Date.now();

    try {
        const predictions = await model.predict(features, true);

        console.log(`[${modelName}] Raw predictions for song ${songIndex}:`, predictions);

        if (!Array.isArray(predictions) || predictions.length === 0) {
            throw new Error("Invalid predictions format received from model");
        }

        const summarizedPredictions = twoValuesAverage(predictions);
        console.log(`[${modelName}] Summarized for song ${songIndex}:`, summarizedPredictions);

        if (!Array.isArray(summarizedPredictions) || summarizedPredictions.length < 2 || summarizedPredictions.some(isNaN)) {
            throw new Error(`Invalid summarized predictions: ${summarizedPredictions}`);
        }

        const positiveIndex = modelTagOrder[modelName].findIndex(v => v === true);
        if (positiveIndex === -1) {
            throw new Error(`No positive index defined for model`);
        }

        const result = summarizedPredictions[positiveIndex];

        console.info(`[${modelName}] Inference for song ${songIndex} took: ${Date.now() - inferenceStart}ms, result: ${result}`);
        outputPredictions(result, songIndex);

    } catch (err) {
        postError(`Prediction execution error: ${err.message}`, songIndex);
        outputPredictions(0.5, songIndex);
    }
}

function getZeroMatrix(x, y) {
    let matrix = new Array(x);
    for (let f = 0; f < x; f++) {
        matrix[f] = new Array(y).fill(0);
    }
    return matrix;
}

let tfBackendInitialized = false;

onmessage = async function listenToMainThread(msg) {
    const { command, name, features, songIndex } = msg.data;

    if (command === 'init') {
        if (!name) {
            postMessage({ type:'status', status:'init_failed', modelName: 'Unknown', error: "Initialization command missing model name" });
            return;
        }
        initModel(name, songIndex);

    } else if (features && typeof songIndex !== 'undefined') {
        const currentModelName = modelName;
        console.log(`[${currentModelName || 'Worker'}] Received features for song ${songIndex}. Checking init state...`);

        if (!initializationPromise) {
            postError(`Model '${currentModelName || '(Not Initialized)'}' has no initialization promise. Cannot process features.`, songIndex, currentModelName);
            outputPredictions(0.5, songIndex);
            return;
        }

        try {
            console.log(`[${currentModelName}] Awaiting initialization promise for song ${songIndex}...`);
            await initializationPromise;
            console.log(`[${currentModelName}] Initialization complete. Proceeding with prediction for song ${songIndex}.`);
            await runPrediction(features, songIndex);
        } catch (initError) {
            const errorMsg = initError ? initError.message : 'Unknown initialization failure';
            console.error(`[${currentModelName}] Initialization previously failed or promise rejected. Cannot process features for song ${songIndex}. Error Details:`, initError);
            postError(`Model '${currentModelName}' failed to initialize. Cannot process features. (${errorMsg})`, songIndex, currentModelName);
            outputPredictions(0.5, songIndex);
        }

    } else {
        console.warn(`[${modelName || 'Unknown'}] Received unhandled message:`, msg.data);
    }
};

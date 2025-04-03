importScripts('./lib/tf.min.3.5.0.js');
importScripts('./lib/essentia.js-model.umd.js');

let model;
let modelName = "";
let modelLoaded = false;
let modelReady = false;

const modelTagOrder = {
    'mood_happy': [true, false],
    'mood_sad': [false, true],
    'mood_relaxed': [false, true],
    'mood_aggressive': [true, false],
    'danceability': [true, false]
};

function initModel() {
    try {
        const modelURL = getModelURL(modelName);
        console.info(`Loading model from: ${modelURL}`);
        model = new EssentiaModel.TensorflowMusiCNN(tf, modelURL);
        
        // Add timeout to avoid infinite loading
        const modelLoadTimeout = setTimeout(() => {
            console.error(`Model ${modelName} load timeout after 30 seconds`);
            postMessage({
                error: `Model ${modelName} load timeout`,
                modelName: modelName
            });
            // Send default prediction to avoid UI getting stuck
            outputPredictions(0.5);
        }, 30000);
        
        loadModel().then((isLoaded) => {
            clearTimeout(modelLoadTimeout);
            if (isLoaded) {
                modelLoaded = true;
                // perform dry run to warm them up
                warmUp();
            } else {
                console.error(`Model ${modelName} failed to load`);
                postMessage({
                    error: `Model ${modelName} failed to load`,
                    modelName: modelName
                });
                // Send default prediction to avoid UI getting stuck
                outputPredictions(0.5);
            }
        }).catch(err => {
            clearTimeout(modelLoadTimeout);
            console.error(`Error loading model ${modelName}:`, err);
            postMessage({
                error: `Error loading model ${modelName}: ${err.message}`,
                modelName: modelName
            });
            // Send default prediction to avoid UI getting stuck
            outputPredictions(0.5);
        });
    } catch (err) {
        console.error(`Error initializing model ${modelName}:`, err);
        postMessage({
            error: `Error initializing model ${modelName}: ${err.message}`,
            modelName: modelName
        });
        // Send default prediction to avoid UI getting stuck
        outputPredictions(0.5);
    }
}

function getModelURL(name) {
    return `../models/${name}-musicnn-msd-2/model.json`;
}

async function loadModel() {
    try {
        await model.initialize();
        console.info(`Model ${modelName} has been loaded!`);
        return true;
    } catch (err) {
        console.error(`Failed to initialize model ${modelName}:`, err);
        return false;
    }
}

function warmUp() {
    try {
        const fakeFeatures = {
            melSpectrum: getZeroMatrix(187, 96),
            frameSize: 187,
            melBandsSize: 96,
            patchSize: 187
        };

        const fakeStart = Date.now();

        model.predict(fakeFeatures, false).then(() => {
            console.info(`${modelName}: Warm up inference took: ${Date.now() - fakeStart}`);
            modelReady = true;
            if (modelLoaded && modelReady) {
                console.log(`${modelName} loaded and ready.`);
                postMessage({
                    modelReady: true,
                    modelName: modelName
                });
            }
        }).catch(err => {
            console.error(`Error in model warmup for ${modelName}:`, err);
            postMessage({
                error: `Error in model warmup for ${modelName}: ${err.message}`,
                modelName: modelName
            });
        });
    } catch (err) {
        console.error(`Error setting up warmup for ${modelName}:`, err);
        postMessage({
            error: `Error setting up warmup for ${modelName}: ${err.message}`,
            modelName: modelName
        });
    }
}

async function initTensorflowWASM() {
    try {
        if (tf.getBackend() != 'wasm') {
            importScripts('./lib/tf-backend-wasm-3.5.0.js');
            tf.setBackend('wasm');
            await tf.ready();
            console.info('tfjs WASM backend successfully initialized!');
            initModel();
        } else {
            console.info('tfjs WASM backend already initialized!');
            initModel();
        }
    } catch (err) {
        console.error(`tfjs WASM could NOT be initialized, defaulting to ${tf.getBackend()}:`, err);
        postMessage({
            error: `tfjs WASM could NOT be initialized: ${err.message}`,
            modelName: modelName
        });
        // Try to initialize model anyway with whatever backend is available
        initModel();
    }
}

// Make sure we never output NaN or undefined values
function outputPredictions(p) {
    // Ensure we always output a valid number
    let value = p;
    
    // Check if the prediction is a valid number
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        console.warn(`Invalid prediction value for ${modelName}: ${value}, using fallback`);
        value = 0.5; // Fallback to 50% if we get an invalid value
    }
    
    // Ensure value is between 0 and 1
    value = Math.max(0, Math.min(1, value));
    
    postMessage({
        predictions: value
    });
}

function twoValuesAverage(arrayOfArrays) {
    try {
        // Validate input
        if (!Array.isArray(arrayOfArrays) || arrayOfArrays.length === 0) {
            console.warn("Invalid input to twoValuesAverage");
            return [0.5, 0.5]; // Return default values if input is invalid
        }
        
        let firstValues = [];
        let secondValues = [];

        arrayOfArrays.forEach((v) => {
            if (Array.isArray(v) && v.length >= 2) {
                // Ensure we only add valid numbers
                const first = typeof v[0] === 'number' && !isNaN(v[0]) ? v[0] : 0.5;
                const second = typeof v[1] === 'number' && !isNaN(v[1]) ? v[1] : 0.5;
                
                firstValues.push(first);
                secondValues.push(second);
            }
        });
        
        // If we have no valid values, return defaults
        if (firstValues.length === 0 || secondValues.length === 0) {
            return [0.5, 0.5];
        }

        const firstValuesAvg = firstValues.reduce((acc, val) => acc + val, 0) / firstValues.length;
        const secondValuesAvg = secondValues.reduce((acc, val) => acc + val, 0) / secondValues.length;

        // Final check for NaN or invalid values
        return [
            isNaN(firstValuesAvg) ? 0.5 : firstValuesAvg,
            isNaN(secondValuesAvg) ? 0.5 : secondValuesAvg
        ];
    } catch (err) {
        console.error("Error in twoValuesAverage:", err);
        return [0.5, 0.5]; // Return default values if any error occurs
    }
}

function modelPredict(features) {
    if (modelReady) {
        const inferenceStart = Date.now();

        model.predict(features, true).then((predictions) => {
            try {
                console.log(`${modelName} raw predictions:`, predictions);
                
                // Check if predictions is valid
                if (!Array.isArray(predictions) || predictions.length === 0) {
                    throw new Error("Invalid predictions format");
                }
                
                const summarizedPredictions = twoValuesAverage(predictions);
                console.log(`${modelName} summarized:`, summarizedPredictions);
                
                // Check if we have valid values
                if (!Array.isArray(summarizedPredictions) || summarizedPredictions.length < 2) {
                    throw new Error("Invalid summarized predictions");
                }
                
                // Get which index represents the positive value for this model
                const positiveIndex = modelTagOrder[modelName].findIndex(v => v === true);
                if (positiveIndex === -1) {
                    throw new Error(`No positive index defined for model ${modelName}`);
                }
                
                // Get the result value safely
                const result = summarizedPredictions[positiveIndex];
                
                console.info(`${modelName}: Inference took: ${Date.now() - inferenceStart}, result: ${result}`);
                
                // Output the prediction (the outputPredictions function will validate it)
                outputPredictions(result);
            } catch (err) {
                console.error(`Error processing predictions for ${modelName}:`, err);
                outputPredictions(0.5);
            } finally {
                // Cleanup
                if (model && model.dispose) {
                    model.dispose();
                }
            }
        }).catch(err => {
            console.error(`Prediction error for ${modelName}:`, err);
            // Send partial result to avoid UI getting stuck
            outputPredictions(0.5);
        });
    } else {
        console.error(`Model ${modelName} is not ready for prediction`);
        // Send default result to avoid UI getting stuck
        outputPredictions(0.5);
    }
}

function getZeroMatrix(x, y) {
    let matrix = new Array(x);
    for (let f = 0; f < x; f++) {
        matrix[f] = new Array(y).fill(0);
    }
    return matrix;
}

onmessage = function listenToMainThread(msg) {
    // listen for audio features
    if (msg.data.name) {
        modelName = msg.data.name;
        try {
            initTensorflowWASM();
        } catch (err) {
            console.error("Error initializing TensorFlow WASM:", err);
            // Send error to main thread
            postMessage({
                error: `Error initializing TensorFlow WASM: ${err.message}`,
                modelName: modelName
            });
            // Send default prediction to prevent UI from hanging
            outputPredictions(0.5);
        }
    } else if (msg.data.features) {
        console.log("From inference worker: I've got features!");
        try {
            modelPredict(msg.data.features);
        } catch (err) {
            console.error("Error predicting features:", err);
            // Send default prediction to prevent UI from hanging
            outputPredictions(0.5);
        }
    }
};

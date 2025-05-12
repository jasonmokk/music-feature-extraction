importScripts('./lib/essentia.js-model.umd.js');
importScripts('./lib/essentia-wasm.module.js');
// using importScripts since it works on both Chrome and Firefox
// using modified version of ES6 essentia WASM, so that it can be loaded with importScripts

let EssentiaWASM;
let extractor;

try {
    EssentiaWASM = Module;
    extractor = new EssentiaModel.EssentiaTFInputExtractor(EssentiaWASM, 'musicnn', false);
    console.log("Feature extraction worker initialized");
} catch (err) {
    console.error("Error initializing feature extraction worker:", err);
    postMessage({
        error: "Failed to initialize feature extraction: " + err.message
    });
}

function outputFeatures(f, songIndex) {
    postMessage({
        features: f,
        songIndex: songIndex
    });
}

function outputError(message, songIndex) {
    postMessage({
        error: message,
        songIndex: songIndex
    });
}

function computeFeatures(audioData) {
    try {
        const featuresStart = Date.now();
        
        if (!extractor) {
            throw new Error("Feature extractor not initialized");
        }
        
        const features = extractor.computeFrameWise(audioData, 256);
        
        if (!features || !features.melSpectrum) {
            throw new Error("Feature computation returned invalid results");
        }

        console.info(`Feature extraction took: ${Date.now() - featuresStart}`);

        return features;
    } catch (err) {
        console.error("Error computing features:", err);
        throw err;
    }
}

onmessage = function listenToMainThread(msg) {
    // listen for decoded audio tagged with songIndex
    const { audio, songIndex } = msg.data;

    if (audio && typeof songIndex !== 'undefined') {
        try {
            console.log(`From FE worker: Received audio for songIndex ${songIndex}`);
            const audioFloat32 = new Float32Array(audio);

            if (audioFloat32.length === 0) {
                throw new Error("Empty audio buffer received");
            }

            const features = computeFeatures(audioFloat32);
            outputFeatures(features, songIndex);
        } catch (err) {
            console.error(`Error in feature extraction worker for songIndex ${songIndex}:`, err);
            outputError("Feature extraction failed: " + err.message, songIndex);
        }
    } else {
         console.warn("Feature worker received message without audio or songIndex:", msg.data);
    }
}
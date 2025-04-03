import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file
const ANALYSIS_TIMEOUT = 30000; // 30 seconds timeout for analysis

let essentia = null;
let essentiaAnalysis;
let featureExtractionWorker = null;
let inferenceWorkers = {};
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];
let inferenceResultPromises = [];
let analysisTimer = null;

const resultsViz = new AnalysisResults(modelNames);
let wavesurfer;
let controls;

const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
})

const dropArea = document.querySelector('#file-drop-area');
dropArea.addEventListener('dragover', (e) => { e.preventDefault() });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
})
dropArea.addEventListener('click', () => {
    dropInput.click();
})

function processFileUpload(files) {
    if (files.length > 1) {
        alert("Only single-file uploads are supported currently");
        throw Error("Multiple file upload attempted, cannot process.");
    } else if (files.length) {
        files[0].arrayBuffer().then((ab) => {
            decodeFile(ab);
            wavesurfer = toggleUploadDisplayHTML('display');
            wavesurfer.loadBlob(files[0]);
            controls = new PlaybackControls(wavesurfer);
            controls.toggleEnabled(false);
        }).catch(err => {
            console.error("Error processing file:", err);
            alert("Error processing audio file. Please try a different file.");
            toggleLoader();
        });
    }
}

function decodeFile(arrayBuffer) {
    audioCtx.resume().then(() => {
        audioCtx.decodeAudioData(arrayBuffer).then(async function handleDecodedAudio(audioBuffer) {
            console.info("Done decoding audio!");
            
            toggleLoader();
            
            // Set a timeout to prevent UI from being stuck if analysis fails
            startAnalysisTimeout();
            
            const prepocessedAudio = preprocess(audioBuffer);
            await audioCtx.suspend();

            try {
                if (essentia) {
                    essentiaAnalysis = computeKeyBPM(prepocessedAudio);
                } else {
                    console.warn("Essentia not loaded, skipping key/BPM analysis");
                    essentiaAnalysis = {
                        keyData: { key: "?", scale: "?" },
                        bpm: 0
                    };
                }

                // reduce amount of audio to analyse
                let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true); // <-- TRIMMED start/end

                // send for feature extraction
                createFeatureExtractionWorker();

                featureExtractionWorker.postMessage({
                    audio: audioData.buffer
                }, [audioData.buffer]);
                audioData = null;
            } catch (err) {
                console.error("Error in audio processing:", err);
                handleAnalysisError("Audio processing failed. Please try a different file.");
            }
        }).catch(err => {
            console.error("Error decoding audio:", err);
            handleAnalysisError("Could not decode audio file. Please try a different format.");
        });
    }).catch(err => {
        console.error("Error resuming audio context:", err);
        handleAnalysisError("Audio system error. Please reload the page and try again.");
    });
}

function startAnalysisTimeout() {
    // Clear any existing timeout
    if (analysisTimer) clearTimeout(analysisTimer);
    
    // Set new timeout
    analysisTimer = setTimeout(() => {
        // If we're still loading after timeout period, something went wrong
        const loader = document.querySelector('#loader');
        if (!loader.classList.contains('disabled')) {
            handleAnalysisError("Analysis timed out. The audio file might be too large or the models failed to load.");
        }
    }, ANALYSIS_TIMEOUT);
}

function handleAnalysisError(message) {
    // Clear timeout
    if (analysisTimer) {
        clearTimeout(analysisTimer);
        analysisTimer = null;
    }
    
    // Hide loader
    const loader = document.querySelector('#loader');
    if (!loader.classList.contains('disabled')) {
        toggleLoader();
    }
    
    // Populate with fallback data if necessary
    if (inferenceResultPromises.length === 0) {
        // Generate default fallback results
        modelNames.forEach(name => {
            inferenceResultPromises.push(Promise.resolve({ [name]: [0.5] }));
        });
        
        // Show default results
        collectPredictions();
    }
    
    // Show error message to user
    alert(message);
    
    // Enable controls anyway so user can at least play the audio
    if (controls) controls.toggleEnabled(true);
}

function computeKeyBPM(audioSignal) {
    try {
        let vectorSignal = essentia.arrayToVector(audioSignal);
        const keyData = essentia.KeyExtractor(vectorSignal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 16000, 0.0001, 440, 'cosine', 'hann');
        const bpm = essentia.PercivalBpmEstimator(vectorSignal, 1024, 2048, 128, 128, 210, 50, 16000).bpm;
        
        return {
            keyData: keyData,
            bpm: bpm
        };
    } catch (err) {
        console.error("Error computing Key/BPM:", err);
        return {
            keyData: { key: "?", scale: "?" },
            bpm: 0
        };
    }
}

function createFeatureExtractionWorker() {
    try {
        featureExtractionWorker = new Worker('./src/featureExtraction.js');
        
        featureExtractionWorker.onmessage = function listenToFeatureExtractionWorker(msg) {
            // feed to models
            if (msg.data.features) {
                modelNames.forEach((n) => {
                    // send features off to each of the models
                    inferenceWorkers[n].postMessage({
                        features: msg.data.features
                    });
                });
                msg.data.features = null;
            } else if (msg.data.error) {
                console.error("Feature extraction error:", msg.data.error);
                handleAnalysisError("Error extracting features: " + msg.data.error);
            }
            
            // free worker resource until next audio is uploaded
            featureExtractionWorker.terminate();
        };
        
        featureExtractionWorker.onerror = function(err) {
            console.error("Feature extraction worker error:", err);
            handleAnalysisError("Error in feature extraction. Please try again.");
            featureExtractionWorker.terminate();
        };
    } catch (err) {
        console.error("Error creating feature extraction worker:", err);
        handleAnalysisError("Could not initialize feature extraction. Please reload the page.");
    }
}

function createInferenceWorkers() {
    modelNames.forEach((n) => { 
        try {
            inferenceWorkers[n] = new Worker('./src/inference.js');
            
            inferenceWorkers[n].postMessage({
                name: n
            });
            
            inferenceWorkers[n].onmessage = function listenToWorker(msg) {
                // listen out for model output
                if (msg.data.predictions) {
                    const preds = msg.data.predictions;
                    // emit event to PredictionCollector object
                    inferenceResultPromises.push(new Promise((res) => {
                        res({ [n]: preds });
                    }));
                    collectPredictions();
                    console.log(`${n} predictions: `, preds);
                } else if (msg.data.error) {
                    // Handle errors from worker
                    console.error(`Model ${n} error:`, msg.data.error);
                    
                    // Still add a result so we don't block the UI
                    inferenceResultPromises.push(Promise.resolve({ [n]: [0.5] }));
                    collectPredictions();
                }
            };
            
            inferenceWorkers[n].onerror = function(err) {
                console.error(`Worker error for model ${n}:`, err);
                
                // Add a placeholder result to avoid blocking the UI
                inferenceResultPromises.push(Promise.resolve({ [n]: [0.5] }));
                collectPredictions();
            };
        } catch (err) {
            console.error(`Error creating worker for model ${n}:`, err);
            
            // Add a placeholder result
            inferenceResultPromises.push(Promise.resolve({ [n]: [0.5] }));
            collectPredictions();
        }
    });
}

function collectPredictions() {
    if (inferenceResultPromises.length == modelNames.length) {
        // Clear timeout since we have all results
        if (analysisTimer) {
            clearTimeout(analysisTimer);
            analysisTimer = null;
        }
        
        Promise.all(inferenceResultPromises).then((predictions) => {
            const allPredictions = {};
            Object.assign(allPredictions, ...predictions);
            resultsViz.updateMeters(allPredictions);
            resultsViz.updateValueBoxes(essentiaAnalysis);
            toggleLoader();
            if (controls) controls.toggleEnabled(true);

            inferenceResultPromises = [] // clear array
        }).catch(err => {
            console.error("Error processing predictions:", err);
            handleAnalysisError("Error processing analysis results. Some values may be inaccurate.");
        });
    }
}

function toggleLoader() {
    const loader = document.querySelector('#loader');
    loader.classList.toggle('disabled');
    loader.classList.toggle('active');
}

window.onload = () => {
    try {
        createInferenceWorkers();
        
        // Add timeout for Essentia initialization
        const essentiaTimeout = setTimeout(() => {
            console.warn("Essentia initialization timed out");
            essentia = null;
        }, 10000);
        
        EssentiaWASM().then((wasmModule) => {
            clearTimeout(essentiaTimeout);
            essentia = new wasmModule.EssentiaJS(false);
            essentia.arrayToVector = wasmModule.arrayToVector;
            console.log("Essentia WASM initialized successfully");
        }).catch(err => {
            clearTimeout(essentiaTimeout);
            console.error("Failed to initialize Essentia WASM:", err);
            essentia = null;
        });
    } catch (err) {
        console.error("Error during initialization:", err);
        alert("Error initializing application. Please reload the page.");
    }
};

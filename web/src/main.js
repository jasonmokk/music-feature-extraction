import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file
const ANALYSIS_TIMEOUT = 30000; // 30 seconds timeout for analysis per file

let essentia = null;
let featureExtractionWorkerPool = []; // Pool of workers if needed, or manage one at a time
let inferenceWorkerPools = {}; // Pools per model type
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];

// Data structure to hold info for each song
let songAnalyses = [];
let currentSongIndex = -1;

// UI Elements
const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.setAttribute('multiple', ''); // Allow multiple files
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
});

const dropArea = document.querySelector('#file-drop-area');
const songSelectDropdown = document.querySelector('#song-select-dropdown');
const songSelectorSection = document.querySelector('#song-selector-section');
const resultsSection = document.querySelector('#results');
const loader = document.querySelector('#loader');

dropArea.addEventListener('dragover', (e) => { e.preventDefault(); });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
});
dropArea.addEventListener('click', () => {
    dropInput.click();
});

songSelectDropdown.addEventListener('change', (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (selectedIndex >= 0 && selectedIndex < songAnalyses.length) {
        displaySongResults(selectedIndex);
    }
});


function processFileUpload(files) {
    if (!files.length) return;

    toggleLoader(true, "Processing files..."); // Show loader for processing

    // Clear previous results if any
    clearPreviousAnalysis();

    songAnalyses = Array.from(files).map((file, index) => ({
        id: index,
        file: file,
        fileName: file.name,
        audioBuffer: null,
        essentiaAnalysis: null,
        analysisResults: new AnalysisResults(modelNames), // Each song gets its own results object
        wavesurfer: null,
        controls: null,
        analysisPromise: null, // To track completion
        analysisTimeoutTimer: null,
        status: 'pending' // 'pending', 'processing', 'completed', 'error'
    }));

    // Show song selector and results area (initially with loader)
    songSelectorSection.style.display = 'block';
    resultsSection.style.display = 'block'; // Make sure results section is visible
    toggleUploadDisplayHTML('hide'); // Hide the initial upload prompt

    // Populate dropdown
    populateSongDropdown();

    // Start decoding and analysis for all files
    songAnalyses.forEach((song, index) => {
        song.status = 'processing';
        song.analysisPromise = decodeFile(song.file, index)
            .catch(err => {
                console.error(`Error processing song ${index} (${song.fileName}):`, err);
                song.status = 'error';
                handleAnalysisError(index, "File processing failed.");
                // Update dropdown entry?
            });
    });

    // Select the first song initially after a short delay to allow UI update
    if (songAnalyses.length > 0) {
       setTimeout(() => displaySongResults(0), 100);
    } else {
         toggleLoader(false); // Hide loader if no files processed
    }

    // Monitor all analyses completion
    monitorAllAnalyses();
}

function terminateAllWorkers() {
     console.log("Terminating all active workers...");
     // Terminate feature worker
     if (featureWorker) {
         try {
            featureWorker.terminate();
            console.log("Feature worker terminated.");
         } catch (e) { console.error("Error terminating feature worker:", e); }
         featureWorker = null;
     }
     // Terminate inference workers
     Object.entries(inferenceWorkers).forEach(([modelName, workerInfo]) => {
         if (workerInfo && workerInfo.worker && workerInfo.worker.terminate) {
             try {
                 workerInfo.worker.terminate();
                 console.log(`Inference worker for ${modelName} terminated.`);
             } catch (e) { console.error(`Error terminating inference worker ${modelName}:`, e); }
         }
     });
     inferenceWorkers = {}; // Clear the registry
}

function clearPreviousAnalysis() {
    console.log("Clearing previous analysis state...");
    // Stop and remove existing wavesurfer instances and controls
    songAnalyses.forEach(song => {
        if (song.wavesurfer) {
            song.wavesurfer.destroy();
        }
        if (song.controls) {
            // Assuming controls don't need explicit destruction, otherwise add here
        }
        clearTimeout(song.analysisTimeoutTimer);
    });
    songAnalyses = [];
    currentSongIndex = -1;
    songSelectDropdown.innerHTML = ''; // Clear dropdown
    songSelectorSection.style.display = 'none'; // Hide selector
    // Reset UI elements in results section if needed (e.g., clear meters, BPM, key)
    const resultsViz = new AnalysisResults(modelNames); // Reset global viz state temporarily? Or handle in displaySongResults
    resultsViz.resetDisplay();
    // Terminate all active workers
    terminateAllWorkers();
}

function populateSongDropdown() {
    songSelectDropdown.innerHTML = ''; // Clear existing options
    songAnalyses.forEach((song, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = song.fileName;
        songSelectDropdown.appendChild(option);
    });
}


async function decodeFile(file, index) {
    const song = songAnalyses[index];
    try {
        const arrayBuffer = await file.arrayBuffer();
        await audioCtx.resume();
        song.audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        console.info(`Done decoding audio for song ${index}!`);

        // Start analysis timeout for this specific file
        startAnalysisTimeout(index);

        const prepocessedAudio = preprocess(song.audioBuffer);
        await audioCtx.suspend(); // Suspend context after preprocessing

        // Compute Key/BPM (can happen in parallel)
        if (essentia) {
            song.essentiaAnalysis = computeKeyBPM(prepocessedAudio);
        } else {
            console.warn(`Essentia not loaded for song ${index}, skipping key/BPM analysis`);
            song.essentiaAnalysis = { keyData: { key: "?", scale: "?" }, bpm: 0 };
        }

        // Feature Extraction & Inference
        let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true);
        await triggerFeatureExtraction(audioData, index);

        // Note: Actual completion tracking needs refinement, likely within worker messages
        // For now, this promise resolves after *starting* the process
        console.log(`Started analysis pipeline for song ${index}`);

    } catch (err) {
        console.error(`Error decoding or starting analysis for song ${index}:`, err);
        handleAnalysisError(index, err.message || "Audio decoding or processing failed.");
        throw err; // Re-throw to be caught by processFileUpload caller
    }
}


function displaySongResults(index) {
    if (index === currentSongIndex || index < 0 || index >= songAnalyses.length) {
        return; // No change or invalid index
    }

    const previousSong = songAnalyses[currentSongIndex];
    const newSong = songAnalyses[index];

    console.log(`Switching display to song ${index}: ${newSong.fileName}`);
    currentSongIndex = index;
    songSelectDropdown.value = index; // Ensure dropdown reflects the change

    // Destroy previous Wavesurfer instance if it exists and belongs to a different song
    if (previousSong && previousSong.wavesurfer) {
        console.log(`Destroying wavesurfer for song ${previousSong.id}`);
        previousSong.wavesurfer.destroy();
        previousSong.wavesurfer = null;
        previousSong.controls = null; // Assuming controls are tied to wavesurfer instance
        // Hide playback controls explicitly if needed
        const container = document.getElementById('playback-controls-container');
        if (container) container.innerHTML = '';
    }

     // Update the main results display (meters, key, bpm)
     newSong.analysisResults.displayResults(newSong.essentiaAnalysis);


    // Show loader only if this specific song is still processing
    toggleLoader(newSong.status === 'processing', `Analyzing ${newSong.fileName}...`);

    // Setup Wavesurfer for the new song if analysis is complete or errored (allow playback)
    if (newSong.audioBuffer && !newSong.wavesurfer) {
        console.log(`Setting up wavesurfer for song ${index}`);
         // toggleUploadDisplayHTML should ideally return the container, not the wavesurfer instance
         // Let's assume it prepares a div with id 'waveform' and 'playback-controls-container'
         const vizElements = toggleUploadDisplayHTML('display'); // Ensure the waveform area is visible
         const waveContainer = document.getElementById('waveform'); // Assuming viz.js creates this
         const controlsContainer = document.getElementById('playback-controls-container'); // Assuming viz.js creates this

         if (waveContainer && controlsContainer) {
            try {
                 newSong.wavesurfer = WaveSurfer.create({
                     container: waveContainer,
                     waveColor: 'rgb(200, 200, 200)',
                     progressColor: 'rgb(100, 100, 100)',
                     // Add other wavesurfer options as needed
                 });

                 // Use the already decoded audio buffer
                 newSong.wavesurfer.loadDecodedBuffer(newSong.audioBuffer);

                 newSong.controls = new PlaybackControls(newSong.wavesurfer, controlsContainer); // Pass container
                 newSong.controls.toggleEnabled(true); // Enable controls immediately for playback

                 newSong.wavesurfer.on('error', (err) => {
                    console.error(`Wavesurfer error for song ${index}:`, err);
                    // Handle wavesurfer errors, maybe disable controls or show message
                 });

            } catch (err) {
                console.error(`Failed to create wavesurfer for song ${index}:`, err);
                // Handle error (e.g., show message in UI)
                if (controlsContainer) controlsContainer.innerHTML = '<p>Error loading audio player.</p>';
            }

         } else {
             console.error("Required waveform or controls container not found after calling toggleUploadDisplayHTML.");
         }

    } else if (newSong.wavesurfer) {
         // If wavesurfer already exists (e.g., user re-selects), ensure controls are enabled
         if (newSong.controls) newSong.controls.toggleEnabled(true);
    } else if (!newSong.audioBuffer && newSong.status !== 'error') {
        console.warn(`Audio buffer not ready for song ${index}, cannot create wavesurfer yet.`);
        // Loader should be visible in this case if status is 'processing'
    }

    // If the analysis failed for this song, show an indication
    if (newSong.status === 'error') {
        // Optionally display an error message specific to this song in the UI
        console.warn(`Displaying results for song ${index} which encountered an error.`);
        // Maybe disable controls or show default/error state in results viz
        if(newSong.controls) newSong.controls.toggleEnabled(false);
    }
}


function startAnalysisTimeout(index) {
    const song = songAnalyses[index];
    // Clear any existing timeout for this song
    if (song.analysisTimeoutTimer) clearTimeout(song.analysisTimeoutTimer);
    
    // Set new timeout
    song.analysisTimeoutTimer = setTimeout(() => {
        if (song.status === 'processing') { // Check if it's still processing
             console.warn(`Analysis timed out for song ${index}`);
             handleAnalysisError(index, "Analysis timed out. The audio file might be too large or complex.");
        }
    }, ANALYSIS_TIMEOUT);
}

function handleAnalysisError(index, message) {
    if (index < 0 || index >= songAnalyses.length) return; // Invalid index

    const song = songAnalyses[index];
    console.error(`Analysis Error for Song ${index} (${song.fileName}): ${message}`);

    // Clear timeout
    if (song.analysisTimeoutTimer) {
        clearTimeout(song.analysisTimeoutTimer);
        song.analysisTimeoutTimer = null;
    }

    song.status = 'error';

    // Update UI only if this song is currently selected
    if (index === currentSongIndex) {
        toggleLoader(false); // Hide loader if it was for this song
        // Update results display to show error or default state
        song.analysisResults.displayErrorState(message); // Need to add this method to viz.js AnalysisResults
        // Try to enable playback controls anyway if buffer exists
         if (song.controls) {
            song.controls.toggleEnabled(!!song.audioBuffer);
         } else if (song.audioBuffer) {
             // Attempt to create player even on error if buffer is ready
             displaySongResults(index);
         }
        alert(`Analysis failed for ${song.fileName}: ${message}`); // Notify user
    }

    // Update dropdown entry visually? (e.g., add [Error])
    const option = songSelectDropdown.querySelector(`option[value="${index}"]`);
    if (option && !option.textContent.includes('[Error]')) {
        option.textContent += ' [Error]';
    }

     // Check if all analyses are now complete (or errored)
     checkAllAnalysesCompletion();
}

function monitorAllAnalyses() {
    // Simple check: wait for all promises to settle
    // Note: This doesn't perfectly track worker completion, only promise resolution/rejection
    Promise.allSettled(songAnalyses.map(s => s.analysisPromise)).then(() => {
        console.log("Initial processing promises settled for all songs.");
        // A more robust solution would involve tracking worker messages back to each song's status
        checkAllAnalysesCompletion(); // Check completion status based on song state
    });
}

function checkAllAnalysesCompletion() {
    const allDone = songAnalyses.every(s => s.status === 'completed' || s.status === 'error');
    if (allDone) {
        console.log("All song analyses finished (completed or errored).");
        // Hide global loader only if the current song is not individually loading
        if (currentSongIndex !== -1 && songAnalyses[currentSongIndex].status !== 'processing') {
             toggleLoader(false);
        } else if (currentSongIndex === -1) {
             toggleLoader(false); // Hide if no song is selected
        }
    }
}


function computeKeyBPM(audioSignal) {
    // This function remains largely the same but is now called per song
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
        // Return default but don't call handleAnalysisError globally
        return {
            keyData: { key: "?", scale: "?" },
            bpm: 0
        };
    }
}


// --- Worker Management Refactoring ---
// We need dedicated workers per analysis task potentially, or manage message passing carefully.
// Using a single feature worker and multiple inference workers, tagged with song index.

let featureWorker = null; // Single reusable worker for now

async function triggerFeatureExtraction(audioData, index) {
    return new Promise((resolve, reject) => {
         if (!featureWorker) {
             try {
                 featureWorker = new Worker('./src/featureExtraction.js');

                 featureWorker.onmessage = function(msg) {
                     const { features, error, songIndex } = msg.data;
                     if (error) {
                         console.error(`Feature extraction error for song ${songIndex}:`, error);
                         handleAnalysisError(songIndex, `Feature extraction failed: ${error}`);
                         // Potentially reject the promise associated with this songIndex?
                     } else if (features && typeof songIndex !== 'undefined') {
                         console.log(`Received features for song ${songIndex}`);
                         triggerInference(features, songIndex);
                     } else {
                          console.warn("Feature worker sent unrecognised message:", msg.data);
                     }
                 };

                 featureWorker.onerror = function(err) {
                     // This is a general worker error, might affect multiple songs if requests are queued
            console.error("Feature extraction worker error:", err);
                     // Find which songs were processing and mark them as error? Complex.
                     // For now, maybe alert the user about a general failure.
                     alert("A critical error occurred during feature extraction. Please reload and try again.");
                     // Mark all 'processing' songs as error?
                     songAnalyses.forEach((song, idx) => {
                         if(song.status === 'processing') handleAnalysisError(idx, "Feature extraction worker failed.");
                     });
                     featureWorker = null; // Discard broken worker
        };
    } catch (err) {
        console.error("Error creating feature extraction worker:", err);
                 handleAnalysisError(index, "Could not initialize feature extraction.");
                 reject(err); // Reject the promise for the specific song
                 return;
             }
         }

         // Send audio data tagged with the song index
         console.log(`Posting audio data to feature worker for song ${index}`);
         featureWorker.postMessage({
             audio: audioData.buffer,
             songIndex: index
         }, [audioData.buffer]); // Transfer buffer
         audioData = null; // Clear reference
         resolve(); // Resolve the promise once the message is sent
    });
}

// Store inference workers AND their status: { worker: Worker, status: 'pending' | 'initializing' | 'ready' | 'failed' }
let inferenceWorkers = {};

function ensureInferenceWorker(modelName, index) {
     let workerInfo = inferenceWorkers[modelName];

     // If worker entry exists but failed previously, discard it
     if (workerInfo && workerInfo.status === 'failed') {
         console.warn(`Discarding previously failed worker for model ${modelName}.`);
         // Terminate the old worker explicitly if the browser supports it
         if (workerInfo.worker && workerInfo.worker.terminate) {
             try { workerInfo.worker.terminate(); } catch (e) { console.error("Error terminating failed worker:", e);}
         }
         workerInfo = null;
         delete inferenceWorkers[modelName];
     }

     // If no worker entry exists (or it was discarded), create a new one
     if (!workerInfo) {
         try {
             console.log(`Creating inference worker for model: ${modelName}`);
             const worker = new Worker('./src/inference.js');

             // Store worker with initial pending status
             workerInfo = {
                 worker: worker,
                 status: 'pending' // Initial state before sending init
             };
             inferenceWorkers[modelName] = workerInfo;

             // --- Setup Message Handler --- 
             worker.onmessage = function(msg) {
                 const { type, status, predictions, error, songIndex, modelName: workerModelName } = msg.data;

                 // Handle Status Updates from Worker
                 if (type === 'status') {
                     if (!inferenceWorkers[workerModelName]) return; // Might have been discarded
                     
                     console.log(`Received status update from ${workerModelName} worker: ${status}`);
                     if (status === 'initialized') {
                         inferenceWorkers[workerModelName].status = 'ready';
                     } else if (status === 'init_failed') {
                         inferenceWorkers[workerModelName].status = 'failed';
                         // Optional: Alert user or handle specific init failures
                         console.error(`Initialization failed for model ${workerModelName}:`, error);
                         alert(`Analysis model ${workerModelName} failed to load. Results for this model may be unavailable.`);
                         // We don't automatically retry here, but ensureInferenceWorker will create a new one next time
                     }
                     return; // Status messages don't need further processing here
                 }

                 // --- Handle Prediction Results/Errors --- 
                 if (typeof songIndex === 'undefined') {
                     console.warn(`Inference worker (${workerModelName}) sent message without songIndex:`, msg.data);
                     return;
                 }

                 if (error) {
                     console.error(`Model ${workerModelName} error for song ${songIndex}:`, error);
                     handleAnalysisError(songIndex, `Model ${workerModelName} inference failed: ${error}`);
                     if (songAnalyses[songIndex]) { // Check if song analysis object still exists
                         songAnalyses[songIndex].analysisResults.storeResult(workerModelName, [0.5], true); // Mark as error result
                     }
                 } else if (predictions !== undefined) { // Check explicitly for predictions property
                     console.log(`Received ${workerModelName} predictions for song ${songIndex}: `, predictions);
                     if (songAnalyses[songIndex]) { // Check if song analysis object still exists
                         songAnalyses[songIndex].analysisResults.storeResult(workerModelName, predictions);
                     }
                 } else {
                     console.warn(`Inference worker (${workerModelName}) sent unrecognised message type for song ${songIndex}:`, msg.data);
                 }

                 // Check if this song's analysis is complete after receiving result/error
                 if (songAnalyses[songIndex]) {
                     checkSongAnalysisCompletion(songIndex);
                 }
             };

             // --- Setup Error Handler --- 
             worker.onerror = function(err) {
                 const currentModelName = Object.keys(inferenceWorkers).find(key => inferenceWorkers[key] === workerInfo);
                 console.error(`Unhandled Worker error for model ${currentModelName || modelName}:`, err);
                 alert(`A critical error occurred with the ${currentModelName || modelName} analysis model. Results may be incomplete.`);
                 
                 if (currentModelName && inferenceWorkers[currentModelName]) {
                      inferenceWorkers[currentModelName].status = 'failed'; // Mark as failed
                      // Don't delete immediately, let the check at the start handle replacement
                 }
                 
                 // Mark relevant processing songs as error for this model
                 songAnalyses.forEach((song, idx) => {
                     if (song.status === 'processing' && (!currentModelName || !song.analysisResults.hasResult(currentModelName))) {
                          if (currentModelName) {
                               song.analysisResults.storeResult(currentModelName, [0.5], true);
                          }
                         checkSongAnalysisCompletion(idx);
                     }
                 });
             };
             
             // --- Send Init Command --- 
             console.log(`Sending init command to ${modelName} worker.`);
             workerInfo.status = 'initializing'; // Update status
             worker.postMessage({ command: 'init', name: modelName, songIndex: index }); // Pass index for context if needed by worker init logs

        } catch (err) {
             console.error(`Error creating worker for model ${modelName}:`, err);
             handleAnalysisError(index, `Could not initialize model ${modelName}.`);
             if (songAnalyses[index]) { // Check if song exists
                 songAnalyses[index].analysisResults.storeResult(modelName, [0.5], true);
                 checkSongAnalysisCompletion(index);
             }
             return null; // Indicate worker creation failed
         }
     }
     // Return the worker instance itself, not the info object
     return workerInfo ? workerInfo.worker : null;
}

function triggerInference(features, index) {
    console.log(`Triggering inference for all models for song ${index}`);
    const song = songAnalyses[index]; // Get the song object

    modelNames.forEach((n) => {
        const worker = ensureInferenceWorker(n, index); // This returns the worker instance or null
        const workerInfo = inferenceWorkers[n]; // Get the { worker, status } object

        if (worker && workerInfo) { // Check if worker instance and info object exist
             // Check status managed by main.js
            if (workerInfo.status === 'failed') {
                console.error(`[Main Thread] Worker for model ${n} previously failed. Skipping inference for song ${index}.`);
                // Store error result immediately
                if (song) { // Ensure song object still exists
                     song.analysisResults.storeResult(n, [0.5], true); // Mark as error
                     checkSongAnalysisCompletion(index); // Check if song is done now
                }
            } else {
                 // Send features if worker exists and hasn't definitively failed
                 // Status can be 'pending', 'initializing', or 'ready'
                 // The worker itself will wait for initialization via its promise if status is pending/initializing
                 console.log(`[Main Thread] Sending features for song ${index} to ${n} worker (status: ${workerInfo.status}).`);
                 worker.postMessage({
                     features: features, // Note: This copies features. Consider SharedArrayBuffer if needed.
                     songIndex: index
                 });
            }
        } else {
             // ensureInferenceWorker returned null or workerInfo doesn't exist (shouldn't happen if worker exists)
             console.error(`[Main Thread] Could not get or create worker for model ${n}. Skipping inference for song ${index}.`);
              // Store error result
             if (song) { // Ensure song object exists
                  song.analysisResults.storeResult(n, [0.5], true); // Mark as error
                  checkSongAnalysisCompletion(index); // Check if song is done now
             }
        }
    });
    // Features buffer is likely transferred or copied, nulling here might be premature
    // features = null; 
}


function checkSongAnalysisCompletion(index) {
    const song = songAnalyses[index];
    if (!song || song.status !== 'processing') return; // Check if song exists and is processing

    // Check if all models have returned a result (or errored) for this song
    const allModelsDone = modelNames.every(name => song.analysisResults.hasResult(name));

    if (allModelsDone) {
        console.log(`All model inferences completed (or errored) for song ${index}`);
        song.status = 'completed'; // Mark as completed (even if some models failed)
        clearTimeout(song.analysisTimeoutTimer); // Clear timeout as it finished
        song.analysisTimeoutTimer = null;

        // Update UI immediately if this is the currently selected song
        if (index === currentSongIndex) {
             console.log(`Updating display for completed song ${index}`);
             // Explicitly hide loader for the current song now that it's complete
             toggleLoader(false);
             // Directly update the meters/values using the now-complete data
             song.analysisResults.displayResults(song.essentiaAnalysis);
             // Ensure playback controls are enabled (displaySongResults might have done this, but let's be sure)
             if (song.controls) {
                 song.controls.toggleEnabled(true);
             } else if (song.audioBuffer && !song.wavesurfer) {
                 // If controls weren't created yet (e.g., very fast analysis), try creating player now
                  console.log(`[Completion Check] Triggering player creation for song ${index}`);
                 displaySongResults(index); // This will attempt to create wavesurfer/controls
             }
        } else {
             // If not currently selected, ensure loader is hidden if user switches TO it later
             // (displaySongResults handles loader visibility based on status)
             console.log(`Song ${index} completed analysis but is not currently displayed.`);
        }

         // Update dropdown entry text (e.g., remove processing indicator if any)
         const option = songSelectDropdown.querySelector(`option[value="${index}"]`);
         if (option && option.textContent.includes('[Processing]')) {
            option.textContent = song.fileName; // Or mark completion/error state if needed
         }
         if (option && song.status === 'error' && !option.textContent.includes('[Error]')) {
             option.textContent += ' [Error]'; // Add error mark if overall status is error
         }

        // Check if all songs are now done (for global state, potentially hiding loader if nothing is selected)
        checkAllAnalysesCompletion();
    }
}


function toggleLoader(show, message = "Analyzing audio...") {
    if (show) {
        loader.querySelector('.loader-text').textContent = message;
        loader.classList.remove('disabled');
    } else {
        loader.classList.add('disabled');
    }
}

// --- Initialization ---
        EssentiaWASM().then((wasmModule) => {
    essentia = new Essentia(wasmModule);
    console.log("Essentia.js loaded");
        }).catch(err => {
    console.error("Failed to load Essentia:", err);
    alert("Error loading audio analysis library (Essentia). Key/BPM features will be unavailable.");
    // Continue without essentia
});

// No need to create inference workers here, they are created on demand by ensureInferenceWorker

// Initial UI state
resultsSection.style.display = 'none';
songSelectorSection.style.display = 'none';
toggleLoader(false);
// Display initial upload state
toggleUploadDisplayHTML('initial');

console.log("Application Initialized");

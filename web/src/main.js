import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file
const ANALYSIS_TIMEOUT = 30000; // 30 seconds timeout for analysis per file
const BATCH_SIZE = 20; // Process 20 files at a time (increased from 3)

let essentia = null;
let featureExtractionWorkerPool = []; // Pool of workers if needed, or manage one at a time
let inferenceWorkerPools = {}; // Pools per model type
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];

// Data structure to hold info for each song
let songAnalyses = [];
let currentSongIndex = -1;

// Add these constants at the top with other constants
let currentBatchIndex = 0;
let pendingFiles = [];
let processedResults = [];

// Add a global map to store song analysis by ID
let songAnalysisMap = new Map();

// UI Elements
const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.setAttribute('multiple', ''); // Allow multiple files
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
});

// Add a new folder input element
const folderInput = document.createElement('input');
folderInput.setAttribute('type', 'file');
folderInput.setAttribute('webkitdirectory', ''); // Allow directory selection (Chrome, Safari, Edge)
folderInput.setAttribute('directory', ''); // Firefox (though less supported)
folderInput.setAttribute('multiple', ''); // Some browsers require this for folder selection
folderInput.addEventListener('change', () => {
    processFileUpload(folderInput.files);
});

const dropArea = document.querySelector('#file-drop-area');
const songSelectDropdown = document.querySelector('#song-select-dropdown');
const songSelectionContainer = document.querySelector('#song-selection');
const resultsSection = document.querySelector('#results');
const loader = document.querySelector('#loader');
const playerListContainer = document.querySelector('#player-list'); // Get ref to player list
let downloadCsvButton = document.querySelector('#download-csv'); // Get download button

dropArea.addEventListener('dragover', (e) => { e.preventDefault(); });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
});
dropArea.addEventListener('click', () => {
    // Show a menu with file or folder upload options
    showUploadOptions();
});

songSelectDropdown.addEventListener('change', (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (selectedIndex >= 0 && selectedIndex < songAnalyses.length) {
        displaySongResults(selectedIndex);
    }
});

// Function to ensure the download button has an event listener
function setupDownloadButton() {
    // Re-query the button in case it was recreated in the DOM
    downloadCsvButton = document.querySelector('#download-csv');
    
    if (!downloadCsvButton) {
        console.warn('Download CSV button not found in the DOM');
        return;
    }
    
    // Remove any existing listeners to prevent duplicates
    downloadCsvButton.removeEventListener('click', downloadResultsAsCsv);
    
    // Add the event listener
    downloadCsvButton.addEventListener('click', downloadResultsAsCsv);
    
    console.log('Download CSV button event listener attached');
}

// Add event listener for CSV download button
if (downloadCsvButton) {
    downloadCsvButton.addEventListener('click', () => {
        console.log('Download button clicked');
        downloadResultsAsCsv();
    });
    console.log('Initial download button event listener attached');
} else {
    console.warn('Download button not found during initial setup');
}

// Call setup during initialization
document.addEventListener('DOMContentLoaded', setupDownloadButton);

function processFileUpload(files) {
    if (!files.length) return;

    // Filter for audio files only
    const audioFiles = Array.from(files).filter(file => 
        file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3') || 
        file.name.toLowerCase().endsWith('.wav') || file.name.toLowerCase().endsWith('.ogg')
    );
    
    if (audioFiles.length === 0) {
        alert('No audio files found. Please upload MP3, WAV, or OGG files.');
        return;
    }

    console.log(`Processing ${audioFiles.length} audio files out of ${files.length} total files`);
    
    // Remove the initial state class to switch to the normal layout
    document.querySelector('.content-container').classList.remove('initial-state');
    console.log('Removed initial-state class');

    toggleLoader(true, `Preparing to process ${audioFiles.length} files...`); // Show loader for processing
    console.log('Showing loader');

    // Clear previous results and players
    clearPreviousAnalysis();
    console.log('Cleared previous analysis');

    // Create a single player container that we'll update as songs change
    playerListContainer.innerHTML = `
        <div id="active-player" class="song-player-item">
            <!-- Player content will be inserted here when a song is selected -->
        </div>
    `;
    console.log('Created player container');

    // Initialize arrays for batch processing
    pendingFiles = audioFiles;
    processedResults = [];
    currentBatchIndex = 0;
    songAnalysisMap.clear(); // Clear the map

    // Show song selector and results area (initially with loader)
    songSelectionContainer.style.display = 'block';
    console.log('Showing song selection container');
    
    resultsSection.style.display = 'block';
    console.log('Showing results section');
    
    toggleUploadDisplayHTML('display');
    console.log('Called toggleUploadDisplayHTML');

    // Start processing the first batch
    processNextBatch();
}

function terminateAllWorkers() {
     console.log("Terminating all active workers...");
     // Terminate feature worker
     if (typeof featureWorker !== 'undefined' && featureWorker) {
         try {
            featureWorker.terminate();
            console.log("Feature worker terminated.");
         } catch (e) { console.error("Error terminating feature worker:", e); }
         featureWorker = null;
     }
     // Terminate inference workers
     if (typeof inferenceWorkers !== 'undefined') {
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
}

function clearPreviousAnalysis() {
    console.log("Clearing previous analysis state...");
    // Stop and remove existing players and release resources
    songAnalyses.forEach(song => {
        // Clean up wavesurfer instance
        if (song.wavesurfer) {
            song.wavesurfer.destroy();
            song.wavesurfer = null;
        }
        
        // Clean up playback controls
        if (song.playbackControls) {
            song.playbackControls.destroy();
            song.playbackControls = null;
        }
        
        // Revoke Object URL to free memory
        if (song.objectURL) {
             URL.revokeObjectURL(song.objectURL);
             song.objectURL = null;
        }
        // Clear analysis timeout
        clearTimeout(song.analysisTimeoutTimer);
    });
    songAnalyses = [];
    currentSongIndex = -1;
    songSelectDropdown.innerHTML = ''; // Clear dropdown
    
    // Don't hide song selector here - we'll show it again right after in processFileUpload
    // But reset UI elements in results section
    const resultsViz = new AnalysisResults(modelNames); // Reset global viz state
    resultsViz.resetDisplay();
    
    // Terminate all active workers
    terminateAllWorkers();
    
    // Clear player list container
    if (playerListContainer) {
         playerListContainer.innerHTML = '';
    }
}

function populateSongDropdown() {
    songSelectDropdown.innerHTML = ''; // Clear existing options
    songAnalyses.forEach((song, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = song.fileName; // Just show the filename without "Play:" prefix
        songSelectDropdown.appendChild(option);
    });
}


async function decodeFile(file, index) {
    // Get the song from our map instead of relying on songAnalyses array position
    const song = songAnalysisMap.get(index);
    if (!song) {
        console.error(`Song with index ${index} not found in map.`);
        return Promise.reject(new Error(`Song with index ${index} not found.`));
    }

    console.log(`Starting decode for song ${index}: ${song.fileName} (Batch: ${song.batchId})`);
    
    try {
        console.log(`Reading file as array buffer: ${file.name}`);
        const arrayBuffer = await file.arrayBuffer();
        console.log(`Array buffer received for ${file.name}, size: ${arrayBuffer.byteLength} bytes`);

        // Create Blob and Object URL for the audio player source
        const audioBlob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' }); // Use file type or default
        song.objectURL = URL.createObjectURL(audioBlob);
        console.log(`Created object URL for ${file.name}`);
        
        // Decode for analysis (still needed)
        console.log(`Resuming audio context and decoding audio data for ${file.name}`);
        await audioCtx.resume();
        song.audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0)); // Use slice to create a copy
        console.info(`Done decoding audio for song ${index}!`);

        // Start analysis timeout for this specific file
        startAnalysisTimeout(index);
        console.log(`Started analysis timeout for ${file.name}`);

        console.log(`Preprocessing audio for ${file.name}`);
        const prepocessedAudio = preprocess(song.audioBuffer);
        await audioCtx.suspend(); // Suspend context after preprocessing
        console.log(`Audio preprocessing complete for ${file.name}`);

        // Compute Key/BPM (can happen in parallel)
        if (essentia) {
            console.log(`Computing key/BPM with Essentia for ${file.name}`);
            song.essentiaAnalysis = computeKeyBPM(prepocessedAudio);
            console.log(`Key/BPM analysis complete for ${file.name}:`, song.essentiaAnalysis);
        } else {
            console.warn(`Essentia not loaded for song ${index}, skipping key/BPM analysis`);
            song.essentiaAnalysis = { keyData: { key: "?", scale: "?" }, bpm: 0 };
        }

        // Feature Extraction & Inference
        console.log(`Shortening audio for feature extraction for ${file.name}`);
        let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true);
        console.log(`Triggering feature extraction for ${file.name}`);
        await triggerFeatureExtraction(audioData, index);
        
        // Release large audio data after processing
        audioData = null;
        prepocessedAudio = null;

        // Note: Actual completion tracking needs refinement, likely within worker messages
        // For now, this promise resolves after *starting* the process
        console.log(`Started analysis pipeline for song ${index}`);
        
        // Ensure the results are displayed
        if (index === currentSongIndex) {
            console.log(`Refreshing results display for current song ${index}`);
            displaySongResults(index);
        }

    } catch (err) {
        console.error(`Error decoding or starting analysis for song ${index}:`, err);
        handleAnalysisError(index, err.message || "Audio decoding or processing failed.");
        throw err; // Re-throw to be caught by processFileUpload caller
    }
}

function initWaveSurfer(song, index) {
    try {
        // Check if wavesurfer instance already exists for this song
        if (song.wavesurfer) {
            return;
        }
        
        // Create a WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
            container: `#waveform-${index}`,
            waveColor: '#c7d2fe',
            progressColor: 'var(--waveform-progress-color)',
            cursorColor: 'transparent',
            barWidth: 2,
            barRadius: 2,
            barGap: 1,
            height: 60,
            responsive: true,
            normalize: true,
            backend: 'MediaElement'
        });

        // Load the audio
        const audioElement = document.getElementById(`audio-player-${index}`);
        if (audioElement) {
            audioElement.src = song.objectURL;
            wavesurfer.load(audioElement);
        }

        // Update time display - use the active-player container instead of song-player-${index}
        const timeContainer = document.querySelector(`#active-player .time-display`);
        const currentTimeElement = timeContainer.querySelector('.current-time');
        const durationElement = timeContainer.querySelector('.duration');

        wavesurfer.on('ready', function() {
            const duration = wavesurfer.getDuration();
            durationElement.textContent = formatTime(duration);
            
            // Initialize playback controls
            const controlsContainer = document.querySelector(`#controls-${index}`);
            if (controlsContainer) {
                song.playbackControls = new PlaybackControls(wavesurfer, controlsContainer);
            }
        });

        wavesurfer.on('audioprocess', function() {
            const currentTime = wavesurfer.getCurrentTime();
            currentTimeElement.textContent = formatTime(currentTime);
        });

        wavesurfer.on('seek', function() {
            const currentTime = wavesurfer.getCurrentTime();
            currentTimeElement.textContent = formatTime(currentTime);
        });

        song.wavesurfer = wavesurfer;

    } catch (error) {
        console.error(`Error initializing WaveSurfer for song ${index}:`, error);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function displaySongResults(index) {
    const song = songAnalysisMap.get(index);
    if (!song) {
        console.error(`Cannot display results for song ${index} - not found in map`);
        return;
    }

    const previousSong = songAnalysisMap.get(currentSongIndex);

    console.log(`Switching results display to song ${index}: ${song.fileName} (Batch: ${song.batchId})`);
    currentSongIndex = index;
    songSelectDropdown.value = index; // Ensure dropdown reflects the change

    // Make sure results section is visible
    resultsSection.style.display = 'block';
    
    // Update the main results display (meters, key, bpm)
    if (song.essentiaAnalysis) {
        console.log('Displaying analysis results:', song.essentiaAnalysis);
        song.analysisResults.displayResults(song.essentiaAnalysis);
    } else {
        console.log('No analysis results available yet for', song.fileName);
    }

    // Show loader only if this specific song is still processing analysis
    toggleLoader(song.status === 'processing', `Analyzing ${song.fileName}...`);
    
    // Clean up previous player if it exists
    cleanupCurrentPlayer();
    
    // Create the player for the selected song - but keep it closed
    createPlayerForSong(index);
    
    // Initialize the player but keep it closed (removed auto-open code)
    setTimeout(() => {
        // Make sure the wavesurfer instance is created
        const song = songAnalysisMap.get(currentSongIndex);
        if (song && !song.isPlayerInitialized && song.objectURL) {
            console.log('Initializing waveform without opening player');
            initWaveSurfer(song, index);
            song.isPlayerInitialized = true;
        }
        
        // Ensure download button is set up each time results are displayed
        setupDownloadButton();
    }, 200);
}

function cleanupCurrentPlayer() {
    // Get all songs that have initialized players
    songAnalyses.forEach(song => {
        if (song.wavesurfer) {
            song.wavesurfer.destroy();
            song.wavesurfer = null;
        }
        
        if (song.playbackControls) {
            song.playbackControls.destroy();
            song.playbackControls = null;
        }
        
        song.isPlayerInitialized = false;
    });
    
    // Reset the player container
    const activePlayer = document.getElementById('active-player');
    if (activePlayer) {
        activePlayer.innerHTML = '';
    }
}

function createPlayerForSong(index) {
    const song = songAnalyses[index];
    if (!song) return;
    
    const activePlayer = document.getElementById('active-player');
    if (!activePlayer) return;
    
    console.log(`Creating player for song ${index}: ${song.fileName}`);
    
    // Set the content for the active player
    activePlayer.innerHTML = `
        <div class="song-header" data-index="${index}">
            <div class="song-title" title="${song.fileName}">Play Track</div>
            <div class="toggle-player"><i class="fa-solid fa-chevron-down"></i></div>
        </div>
        <div class="player-content">
            <div class="waveform-container">
                <div id="waveform-${index}" class="player-wave"></div>
            </div>
            <div class="time-display">
                <span class="current-time">0:00</span>
                <span class="duration">0:00</span>
            </div>
            <div id="controls-${index}" class="controls-container"></div>
            <audio id="audio-player-${index}" style="display:none;"></audio>
        </div>
    `;
    
    // Set up the toggle event
    const songHeader = activePlayer.querySelector('.song-header');
    songHeader.addEventListener('click', () => {
        togglePlayer();
    });
    
    // Initialize the player (but don't automatically open it)
    if (song.objectURL && !song.isPlayerInitialized) {
        console.log('Player created, will initialize wavesurfer');
        setTimeout(() => {
            initWaveSurfer(song, index);
            song.isPlayerInitialized = true;
        }, 50);
    }
}

// Function to toggle the current player's expansion state
function togglePlayer() {
    const activePlayer = document.getElementById('active-player');
    if (!activePlayer) return;
    
    const content = activePlayer.querySelector('.player-content');
    const toggle = activePlayer.querySelector('.toggle-player');
    
    if (content.classList.contains('open')) {
        // Close the player
        content.classList.remove('open');
        toggle.classList.remove('open');
    } else {
        // Open the player
        content.classList.add('open');
        toggle.classList.add('open');
        
        // Make sure the player is initialized
        const song = songAnalysisMap.get(currentSongIndex);
        if (song && !song.isPlayerInitialized && song.objectURL) {
            console.log('Initializing waveform for song:', currentSongIndex);
            initWaveSurfer(song, currentSongIndex);
            song.isPlayerInitialized = true;
        } else if (song && song.wavesurfer) {
            // Force wavesurfer to redraw when container becomes visible
            console.log('Forcing wavesurfer to redraw');
            setTimeout(() => {
                song.wavesurfer.drawBuffer();
            }, 50);
        }
    }
}

function startAnalysisTimeout(index) {
    const song = songAnalysisMap.get(index);
    if (!song) return;
    
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
    const song = songAnalysisMap.get(index);
    if (!song) return; // Song not found

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
         if (song.audioBuffer) {
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
        if (!essentia) {
            console.warn("Essentia is not loaded, returning default values");
            return {
                keyData: { key: "?", scale: "?" },
                bpm: 0
            };
        }
        
        console.log("Computing key/BPM with Essentia");
        let vectorSignal = essentia.arrayToVector(audioSignal);
        const keyData = essentia.KeyExtractor(vectorSignal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 16000, 0.0001, 440, 'cosine', 'hann');
        const bpm = essentia.PercivalBpmEstimator(vectorSignal, 1024, 2048, 128, 128, 210, 50, 16000).bpm;
        
        console.log("Key/BPM computation complete:", { keyData, bpm });
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
    console.log(`Creating feature extraction worker for song ${index}`);
    
    // Get the song from our map
    const song = songAnalysisMap.get(index);
    if (!song) {
        console.error(`Song with index ${index} not found in map.`);
        return Promise.reject(new Error(`Song with index ${index} not found for feature extraction.`));
    }
    
    try {
        // Create a new worker for each song
        const featureWorker = new Worker('src/featureExtraction.js');
        
        // Set up communication with the worker
        featureWorker.onmessage = function(e) {
            // Check for errors from worker
            if (e.data.error) {
                console.error(`Feature extraction error for song ${index}:`, e.data.error);
                handleAnalysisError(index, e.data.error);
                featureWorker.terminate();
                return;
            }
            
            // Get features from worker
            const features = e.data.features;
            const songIndex = e.data.songIndex;
            
            if (features && typeof songIndex !== 'undefined') {
                console.info(`Received feature extraction results for song ${songIndex}`);
                
                // Process features with inference models
                triggerInference(features, songIndex);
                
                // Terminate the worker now that it's done
                featureWorker.terminate();
            }
        };
        
        // Set timeout for worker operations
        const workerTimeout = setTimeout(() => {
            console.error(`Feature extraction worker timed out for song ${index}`);
            handleAnalysisError(index, "Feature extraction timed out");
            if (featureWorker) {
                featureWorker.terminate();
            }
        }, ANALYSIS_TIMEOUT);
        
        // Handle worker errors
        featureWorker.onerror = function(err) {
            console.error(`Feature extraction worker error for song ${index}:`, err);
            clearTimeout(workerTimeout);
            handleAnalysisError(index, "Feature extraction worker failed");
            featureWorker.terminate();
        };
        
        // Send audio data to the worker
        console.log(`Sending audio data to feature worker for song ${index}`);
        featureWorker.postMessage({
            audio: audioData,
            songIndex: index
        });
        
    } catch (err) {
        console.error(`Error creating or using feature extraction worker for song ${index}:`, err);
        handleAnalysisError(index, "Failed to initialize feature extraction");
    }
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
                     if (songAnalysisMap.get(songIndex)) { // Check if song analysis object still exists
                         songAnalysisMap.get(songIndex).analysisResults.storeResult(workerModelName, [0.5], true); // Mark as error result
                     }
                 } else if (predictions !== undefined) { // Check explicitly for predictions property
                     console.log(`Received ${workerModelName} predictions for song ${songIndex}: `, predictions);
                     if (songAnalysisMap.get(songIndex)) { // Check if song analysis object still exists
                         songAnalysisMap.get(songIndex).analysisResults.storeResult(workerModelName, predictions);
                     }
                 } else {
                     console.warn(`Inference worker (${workerModelName}) sent unrecognised message type for song ${songIndex}:`, msg.data);
                 }

                 // Check if this song's analysis is complete after receiving result/error
                 checkSongAnalysisCompletion(songIndex);
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
             if (songAnalysisMap.get(index)) { // Check if song exists
                 songAnalysisMap.get(index).analysisResults.storeResult(modelName, [0.5], true);
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
    const song = songAnalysisMap.get(index); // Get the song object

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
    const song = songAnalysisMap.get(index);
    if (!song || song.status !== 'processing') return; // Check if song exists and is processing

    // Check if all models have returned a result (or errored) for this song
    const allModelsDone = modelNames.every(name => song.analysisResults.hasResult(name));

    if (allModelsDone) {
        console.log(`All model inferences completed (or errored) for song ${index} (Batch: ${song.batchId})`);
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


function toggleLoader(show, message = "Analyzing audio...", progress = -1) {
    if (show) {
        loader.querySelector('.loader-text').textContent = message;
        loader.classList.remove('disabled');
        
        // Update progress bar if provided
        const progressBar = loader.querySelector('.progress-bar');
        if (progressBar) {
            if (progress >= 0 && progress <= 100) {
                progressBar.style.width = `${progress}%`;
                progressBar.textContent = `${Math.round(progress)}%`;
                progressBar.style.display = 'block';
            } else {
                progressBar.style.display = 'none';
            }
        }
    } else {
        loader.classList.add('disabled');
    }
}

// --- Initialization ---
let essentiaLoaded = false;

// Load Essentia.js
EssentiaWASM().then((wasmModule) => {
    essentia = new Essentia(wasmModule);
    essentiaLoaded = true;
    console.log("Essentia.js loaded successfully");
}).catch(err => {
    console.error("Failed to load Essentia:", err);
    alert("Error loading audio analysis library (Essentia). Key/BPM features will be unavailable.");
    // Continue without essentia
});

// No need to create inference workers here, they are created on demand by ensureInferenceWorker

// Initial UI state
resultsSection.style.display = 'none';
songSelectionContainer.style.display = 'none';
toggleLoader(false);

// Display initial upload state
toggleUploadDisplayHTML('initial');

console.log("Application Initialized");

// Function to generate and download CSV
function downloadResultsAsCsv() {
    console.log('Download CSV button clicked');
    
    // Debug song analysis state
    debugSongAnalysesState();
    
    if (songAnalyses.length === 0) {
        console.warn('No song analysis data available to download');
        alert('No audio files have been analyzed yet. Please upload and analyze audio files first.');
        return;
    }

    // Create CSV header row
    let csvContent = 'Song Name,';
    
    // Add model names to header
    modelNames.forEach(model => {
        csvContent += `${formatModelName(model)},`;
    });
    
    // Add BPM and Key to header
    csvContent += 'BPM,Key\n';
    
    let addedRows = 0;
    
    // Add data for each song
    songAnalyses.forEach(song => {
        console.log(`Processing CSV data for song: ${song.fileName}, status: ${song.status}`);
        
        // Include all songs, even those with errors or still processing
        // Add song name (escape commas and quotes in the filename)
        csvContent += `"${song.fileName.replace(/"/g, '""')}",`;
        
        // Add results for each model
        modelNames.forEach(model => {
            let value = '0';
            
            if (song.analysisResults && song.analysisResults.results && 
                song.analysisResults.results[model] && 
                !song.analysisResults.results[model].isError) {
                const predictions = song.analysisResults.results[model].predictions;
                if (typeof predictions === 'number') {
                    value = Math.round(predictions * 100);
                } else if (Array.isArray(predictions) && predictions.length > 0) {
                    value = Math.round(predictions[0] * 100);
                }
            }
            
            csvContent += `${value},`;
        });
        
        // Add BPM and Key
        let bpm = song.essentiaAnalysis && typeof song.essentiaAnalysis.bpm === 'number' ? 
            Math.round(song.essentiaAnalysis.bpm) : '';
        
        let key = '';
        if (song.essentiaAnalysis && song.essentiaAnalysis.keyData &&
            typeof song.essentiaAnalysis.keyData.key === 'string' && 
            song.essentiaAnalysis.keyData.key !== '?' &&
            typeof song.essentiaAnalysis.keyData.scale === 'string') {
            key = `${song.essentiaAnalysis.keyData.key} ${song.essentiaAnalysis.keyData.scale}`;
        }
        
        csvContent += `${bpm},"${key}"\n`;
        addedRows++;
    });
    
    console.log(`CSV content generated with ${addedRows} rows`);
    
    if (addedRows === 0) {
        alert('No results available to download.');
        return;
    }
    
    try {
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'music_analysis_results.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        console.log('Triggering CSV download...');
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log('CSV download complete');
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Failed to download CSV: ' + error.message);
    }
}

// Helper to format model names for CSV header
function formatModelName(name) {
    // Convert to Title Case and replace underscores with spaces
    return name.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Function to debug the state of songAnalyses
function debugSongAnalysesState() {
    console.log(`Total song analyses: ${songAnalyses.length}`);
    
    if (songAnalyses.length === 0) {
        console.log('No songs have been analyzed yet.');
        return;
    }
    
    songAnalyses.forEach((song, index) => {
        console.log(`Song ${index}: ${song.fileName}`);
        console.log(`  Status: ${song.status}`);
        console.log(`  Has audioBuffer: ${!!song.audioBuffer}`);
        console.log(`  Has essentiaAnalysis: ${!!song.essentiaAnalysis}`);
        
        if (song.analysisResults) {
            console.log(`  Results available for models:`);
            modelNames.forEach(model => {
                const hasResult = song.analysisResults.hasResult ? 
                    song.analysisResults.hasResult(model) : 
                    (song.analysisResults.results && song.analysisResults.results[model]);
                console.log(`    - ${model}: ${hasResult ? 'Yes' : 'No'}`);
            });
        } else {
            console.log(`  No analysis results object available`);
        }
    });
}

// Add new function for batch processing
function processNextBatch() {
    const batchStart = currentBatchIndex;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, pendingFiles.length);
    const currentBatch = pendingFiles.slice(batchStart, batchEnd);

    if (currentBatch.length === 0) {
        // All batches processed
        console.log('All batches processed');
        combineResults();
        return;
    }

    // Calculate and show progress
    const totalFiles = pendingFiles.length;
    const processedCount = batchStart;
    const progressPercentage = (processedCount / totalFiles) * 100;
    
    toggleLoader(
        true, 
        `Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1} of ${Math.ceil(totalFiles/BATCH_SIZE)} (${processedCount}/${totalFiles} files)`,
        progressPercentage
    );
    
    console.log(`Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1} of ${Math.ceil(pendingFiles.length/BATCH_SIZE)}`);

    // Clear songAnalyses for the current batch
    songAnalyses = [];

    // Create song analysis objects for current batch
    currentBatch.forEach((file, index) => {
        const globalIndex = batchStart + index;
        const song = {
            id: globalIndex,
            file: file,
            fileName: file.name,
            audioBuffer: null,
            essentiaAnalysis: null,
            analysisResults: new AnalysisResults(modelNames),
            objectURL: null,
            analysisPromise: null,
            analysisTimeoutTimer: null,
            status: 'pending',
            wavesurfer: null,
            playbackControls: null,
            isPlayerInitialized: false,
            batchId: Math.floor(batchStart/BATCH_SIZE) + 1 // Store which batch this belongs to
        };
        
        // Store in both the current array and the global map
        songAnalyses.push(song);
        songAnalysisMap.set(globalIndex, song);
    });

    // Populate dropdown with all processed and current batch songs
    populateSongDropdown();

    // Process current batch
    songAnalyses.forEach((song) => {
        song.status = 'processing';
        console.log(`Starting analysis for song ${song.id}: ${song.fileName} (Batch: ${song.batchId})`);
        song.analysisPromise = decodeFile(song.file, song.id)
            .catch(err => {
                console.error(`Error processing song ${song.id} (${song.fileName}):`, err);
                song.status = 'error';
                handleAnalysisError(song.id, "File processing failed.");
            });
    });

    // Monitor current batch completion
    monitorBatchCompletion();
}

// Modify the monitorBatchCompletion function to update progress
function monitorBatchCompletion() {
    const checkInterval = setInterval(() => {
        // Check if all songs in current batch are completed or errored
        const allCompleted = songAnalyses.every(song => 
            song.status === 'completed' || song.status === 'error'
        );

        if (allCompleted) {
            clearInterval(checkInterval);
            
            // Store results from current batch
            processedResults = processedResults.concat([...songAnalyses]);
            
            // Calculate and show progress
            const totalFiles = pendingFiles.length;
            const processedCount = Math.min(currentBatchIndex + BATCH_SIZE, totalFiles);
            const progressPercentage = (processedCount / totalFiles) * 100;
            
            toggleLoader(
                true, 
                `Processed ${processedCount}/${totalFiles} files (${Math.round(progressPercentage)}%)`,
                progressPercentage
            );
            
            // Move to next batch
            currentBatchIndex += BATCH_SIZE;
            
            // Enhanced resource cleanup for better memory management
            songAnalyses.forEach(song => {
                // Clean up wavesurfer instance
                if (song.wavesurfer) {
                    song.wavesurfer.destroy();
                    song.wavesurfer = null;
                }
                
                // Clean up playback controls
                if (song.playbackControls) {
                    song.playbackControls.destroy();
                    song.playbackControls = null;
                }
                
                // Free large buffers
                if (song.audioBuffer) {
                    song.audioBuffer = null;
                }
                
                // Release object URL
                if (song.objectURL) {
                    URL.revokeObjectURL(song.objectURL);
                    song.objectURL = null;
                }
                
                // Only keep essential analysis results, free memory from large data
                if (song.file) {
                    song.file = null; // Release reference to the file
                }
            });
            
            // Force garbage collection opportunity
            songAnalyses = [];
            
            // Small delay before processing next batch to allow garbage collection
            setTimeout(() => {
                // Process next batch
                processNextBatch();
            }, 100);
        } else {
            // Update progress within the current batch
            const completedInBatch = songAnalyses.filter(song => 
                song.status === 'completed' || song.status === 'error'
            ).length;
            
            const totalFiles = pendingFiles.length;
            const prevBatchesCount = currentBatchIndex;
            const currentBatchSize = songAnalyses.length;
            const processedCount = prevBatchesCount + completedInBatch;
            const progressPercentage = (processedCount / totalFiles) * 100;
            
            toggleLoader(
                true, 
                `Processing batch ${Math.floor(currentBatchIndex/BATCH_SIZE) + 1} of ${Math.ceil(totalFiles/BATCH_SIZE)} (${processedCount}/${totalFiles} files)`,
                progressPercentage
            );
        }
    }, 1000);
}

// Add new function to combine results
function combineResults() {
    console.log('Combining results from all batches');
    
    // Convert the Map to an array for the UI
    songAnalyses = Array.from(songAnalysisMap.values());
    
    // Sort by ID to maintain the original order
    songAnalyses.sort((a, b) => a.id - b.id);
    
    // Update UI with all results
    populateSongDropdown();
    
    // Select first song if available
    if (songAnalyses.length > 0) {
        displaySongResults(0);
    }
    
    toggleLoader(false);
    console.log(`Completed processing ${songAnalyses.length} files`);
    
    // Log detailed results for verification
    console.log('Final results summary:');
    songAnalyses.forEach((song) => {
        console.log(`Song ${song.id}: ${song.fileName} (Batch: ${song.batchId})`);
        console.log(`  Status: ${song.status}`);
        if (song.analysisResults && song.analysisResults.results) {
            Object.entries(song.analysisResults.results).forEach(([model, result]) => {
                console.log(`  ${model}: ${result.predictions}`);
            });
        }
    });
}

// Add a new function to show upload options
function showUploadOptions() {
    // Create or get the upload options menu
    let uploadOptions = document.getElementById('upload-options');
    
    if (!uploadOptions) {
        uploadOptions = document.createElement('div');
        uploadOptions.id = 'upload-options';
        uploadOptions.className = 'upload-options-menu';
        uploadOptions.innerHTML = `
            <div class="upload-option" id="file-upload-option">
                <i class="fa-solid fa-file-audio"></i> Upload Files
            </div>
            <div class="upload-option" id="folder-upload-option">
                <i class="fa-solid fa-folder-open"></i> Upload Folder
            </div>
        `;
        document.body.appendChild(uploadOptions);
        
        // Add event listeners
        document.getElementById('file-upload-option').addEventListener('click', () => {
            dropInput.click();
            hideUploadOptions();
        });
        
        document.getElementById('folder-upload-option').addEventListener('click', () => {
            folderInput.click();
            hideUploadOptions();
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!uploadOptions.contains(e.target) && e.target !== dropArea) {
                hideUploadOptions();
            }
        });
    }
    
    // Position the menu relative to the drop area
    const dropAreaRect = dropArea.getBoundingClientRect();
    uploadOptions.style.top = `${dropAreaRect.bottom + window.scrollY}px`;
    uploadOptions.style.left = `${dropAreaRect.left + window.scrollX}px`;
    uploadOptions.style.display = 'block';
}

// Add function to hide upload options
function hideUploadOptions() {
    const uploadOptions = document.getElementById('upload-options');
    if (uploadOptions) {
        uploadOptions.style.display = 'none';
    }
}

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
    dropInput.click();
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

    console.log(`Processing ${files.length} files`);
    
    // Remove the initial state class to switch to the normal layout
    document.querySelector('.content-container').classList.remove('initial-state');
    console.log('Removed initial-state class');

    toggleLoader(true, "Processing files..."); // Show loader for processing
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

    songAnalyses = Array.from(files).map((file, index) => ({
        id: index,
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
        isPlayerInitialized: false
    }));
    console.log('Created song analysis objects:', songAnalyses.length);

    // Show song selector and results area (initially with loader)
    songSelectionContainer.style.display = 'block';
    console.log('Showing song selection container');
    
    resultsSection.style.display = 'block'; // Make sure results section is visible
    console.log('Showing results section');
    
    toggleUploadDisplayHTML('display'); // Show the player list container
    console.log('Called toggleUploadDisplayHTML');

    // Populate dropdown
    populateSongDropdown();
    console.log('Populated song dropdown');

    // Start decoding and analysis for all files
    songAnalyses.forEach((song, index) => {
        song.status = 'processing';
        console.log(`Starting analysis for song ${index}: ${song.fileName}`);
        song.analysisPromise = decodeFile(song.file, index)
            .catch(err => {
                console.error(`Error processing song ${index} (${song.fileName}):`, err);
                song.status = 'error';
                handleAnalysisError(index, "File processing failed.");
            });
    });

    // Select the first song initially after a short delay to allow UI update
    if (songAnalyses.length > 0) {
       console.log('Setting timeout to display first song');
       setTimeout(() => {
         console.log('Displaying first song');
         displaySongResults(0);
       }, 100);
    } else {
         toggleLoader(false); // Hide loader if no files processed
    }

    // Monitor all analyses completion
    monitorAllAnalyses();
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
    const song = songAnalyses[index];
    console.log(`Starting decode for song ${index}: ${song.fileName}`);
    
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
        song.audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
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
    if (index < 0 || index >= songAnalyses.length) {
        return; 
    }

    const previousSong = songAnalyses[currentSongIndex];
    const newSong = songAnalyses[index];

    console.log(`Switching results display to song ${index}: ${newSong.fileName}`);
    currentSongIndex = index;
    songSelectDropdown.value = index; // Ensure dropdown reflects the change

    // Make sure results section is visible
    resultsSection.style.display = 'block';
    
    // Update the main results display (meters, key, bpm)
    if (newSong.essentiaAnalysis) {
        console.log('Displaying analysis results:', newSong.essentiaAnalysis);
        newSong.analysisResults.displayResults(newSong.essentiaAnalysis);
    } else {
        console.log('No analysis results available yet for', newSong.fileName);
    }

    // Show loader only if this specific song is still processing analysis
    toggleLoader(newSong.status === 'processing', `Analyzing ${newSong.fileName}...`);
    
    // Clean up previous player if it exists
    cleanupCurrentPlayer();
    
    // Create the player for the selected song - but keep it closed
    createPlayerForSong(index);
    
    // Initialize the player but keep it closed (removed auto-open code)
    setTimeout(() => {
        // Make sure the wavesurfer instance is created
        const song = songAnalyses[currentSongIndex];
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
        const song = songAnalyses[currentSongIndex];
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

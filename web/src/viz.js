export class AnalysisResults {
    constructor(modelNames) {
        this.modelNames = modelNames;
        this.results = {}; // Store { modelName: { predictions: [], isError: false } }
        this.meters = {};
        this.percentages = {};
        this.isErrorState = false; // Track if currently showing an error

        // Cache DOM elements for meters and percentages
        modelNames.forEach((name) => {
            const container = document.querySelector(`#${name}`);
            if (container) {
                this.meters[name] = container.querySelector('.classifier-meter');
                this.percentages[name] = container.querySelector('.meter-percentage');
            } else {
                 console.warn(`Container element not found for model: ${name}`);
            }
        });
         // Cache BPM and Key elements
        this.bpmValueElement = document.querySelector('#bpm-value');
        this.keyValueElement = document.querySelector('#key-value');
    }

    // Store a result for a specific model
    storeResult(modelName, predictions, isError = false) {
        if (this.modelNames.includes(modelName)) {
            this.results[modelName] = { predictions: predictions, isError: isError };
            console.log(`Stored result for ${modelName}:`, this.results[modelName]);
        } else {
            console.warn(`Attempted to store result for unknown model: ${modelName}`);
        }
    }

    // Check if a result (or error) exists for a model
    hasResult(modelName) {
        return modelName in this.results;
    }

    // Update the UI based on stored results and provided essentia data
    displayResults(essentiaAnalysis) {
        this.isErrorState = false;
        // Log the data being used to update the display
        try {
             console.log(`[viz.js] Displaying results. Stored model results:`, JSON.parse(JSON.stringify(this.results)), `Essentia:`, essentiaAnalysis);
        } catch (e) {
             console.error("[viz.js] Error logging results data:", e);
             console.log("[viz.js] Displaying results (raw). Stored model results:", this.results, `Essentia:`, essentiaAnalysis);
        }

        Object.entries(this.results).forEach(([model, resultData]) => {
            let value = 0.5; // Default value
            let isError = resultData.isError;

            if (!isError && resultData.predictions) {
                 // Use the first prediction value, similar to original logic
                if (typeof resultData.predictions === 'number') {
                    value = resultData.predictions;
                } else if (Array.isArray(resultData.predictions) && resultData.predictions.length > 0 && typeof resultData.predictions[0] === 'number') {
                    value = resultData.predictions[0];
                } else {
                    console.warn(`Invalid prediction format for ${model}:`, resultData.predictions);
                    isError = true; // Treat invalid format as error for display
                }
            }

            // Validate the value if not an error state
            if (!isError && (isNaN(value) || !isFinite(value))) {
                console.warn(`NaN or invalid value for ${model}, treating as error`);
                isError = true;
            }

            // Clamp value if not error
            if (!isError) {
                 value = Math.max(0, Math.min(1, value));
            }

            const normalizedValue = Math.round(value * 100);

            // Update meter and percentage text
            if (this.meters[model] && this.percentages[model]) {
                if (isError) {
                    // Indicate error visually (e.g., grey out, specific text)
                    this.meters[model].style.setProperty('--meter-width', 0); // Or a specific error style
                    this.percentages[model].textContent = 'Error';
                    this.meters[model].setAttribute('data-classifier', 'Error');
                    this.meters[model].classList.add('error'); // Add error class for styling
                } else {
                    this.meters[model].style.setProperty('--meter-width', normalizedValue);
                    this.percentages[model].textContent = `${normalizedValue}%`;
                    this.meters[model].setAttribute('data-classifier', `${normalizedValue}%`);
                    this.meters[model].classList.remove('error'); // Remove error class
                }
            }
        });

         // Update BPM and Key from essentiaAnalysis
        if (this.bpmValueElement && this.keyValueElement) {
            if (essentiaAnalysis) {
                let bpmValue = 0;
                if (typeof essentiaAnalysis.bpm === 'number' && !isNaN(essentiaAnalysis.bpm) && essentiaAnalysis.bpm > 0) {
                    bpmValue = Math.round(essentiaAnalysis.bpm);
                }
                 this.bpmValueElement.textContent = bpmValue ? bpmValue.toString() : "—";

                let keyText = "—";
                if (essentiaAnalysis.keyData &&
                    typeof essentiaAnalysis.keyData.key === 'string' && essentiaAnalysis.keyData.key !== '?' &&
                    typeof essentiaAnalysis.keyData.scale === 'string') {
                    keyText = `${essentiaAnalysis.keyData.key} ${essentiaAnalysis.keyData.scale}`;
                }
                this.keyValueElement.textContent = keyText;
            } else {
                 this.bpmValueElement.textContent = "—";
                 this.keyValueElement.textContent = "—";
            }
        }
    }

    // Reset the display to initial state
    resetDisplay() {
        this.isErrorState = false;
        this.results = {}; // Clear stored results
        this.modelNames.forEach((name) => {
             if (this.meters[name] && this.percentages[name]) {
                 this.meters[name].style.setProperty('--meter-width', 0);
                 this.percentages[name].textContent = '0%';
                 this.meters[name].setAttribute('data-classifier', `0%`);
                 this.meters[name].classList.remove('error');
             }
        });
         if (this.bpmValueElement) this.bpmValueElement.textContent = "—";
         if (this.keyValueElement) this.keyValueElement.textContent = "—";
    }

    // Display a general error state (e.g., analysis timed out)
    displayErrorState(message) {
        console.warn("Displaying general error state:", message);
        this.isErrorState = true;
        this.modelNames.forEach((name) => {
             if (this.meters[name] && this.percentages[name]) {
                 this.meters[name].style.setProperty('--meter-width', 0); // Or error style
                 this.percentages[name].textContent = 'N/A';
                 this.meters[name].setAttribute('data-classifier', 'Error');
                 this.meters[name].classList.add('error');
             }
        });
         if (this.bpmValueElement) this.bpmValueElement.textContent = "Error";
         if (this.keyValueElement) this.keyValueElement.textContent = "Error";
         // Optionally, display the message somewhere in the UI
    }
}

export class PlaybackControls {
    // Expects the wavesurfer instance and the container element to append controls to
    constructor(wavesurfer, containerElement) {
        if (!containerElement) {
             console.error("PlaybackControls: Container element not provided.");
             return;
        }
        this.container = containerElement;
        this.wavesurfer = wavesurfer;

        // Get template content
        const template = document.querySelector('#playback-controls');
        if (!template) {
             console.error("PlaybackControls: Template #playback-controls not found.");
             return;
        }
        const controlsContent = template.content.cloneNode(true);
        this.controlsElement = controlsContent.querySelector('.playback-controls'); // Get the root element

        // Append to the provided container
        this.container.innerHTML = ''; // Clear previous controls
        this.container.appendChild(controlsContent);

        // Setup control refs using the appended element
        this.playBtn = this.container.querySelector('#play');
        this.backwardBtn = this.container.querySelector('#backward');
        this.forwardBtn = this.container.querySelector('#forward');
        this.muteBtn = this.container.querySelector('#mute');

        // Check if buttons were found
         if (!this.playBtn || !this.backwardBtn || !this.forwardBtn || !this.muteBtn) {
             console.error("PlaybackControls: Could not find all control buttons within the template.");
             this.destroy(); // Clean up if setup failed
             return;
         }

        this.setupEventHandlers();
        this.updatePlayPauseIcon(); // Set initial icon state
        this.updateMuteIcon(); // Set initial mute icon state
    }

     // Bound event handlers to ensure `this` context is correct
     // And store references for easy removal
     boundPlayPauseHandler = () => {
        if (!this.wavesurfer) return;
        this.wavesurfer.playPause();
        this.updatePlayPauseIcon();
    };
    boundBackwardHandler = () => {
        if (!this.wavesurfer) return;
        this.wavesurfer.skip(-5);
    };
    boundForwardHandler = () => {
        if (!this.wavesurfer) return;
        this.wavesurfer.skip(5);
    };
    boundMuteHandler = () => {
        if (!this.wavesurfer) return;
        this.wavesurfer.toggleMute();
        this.updateMuteIcon();
    };
    boundAudioEndHandler = () => {
        // Reset icon to 'play' when audio finishes
        this.updatePlayPauseIcon();
    };

    setupEventHandlers() {
        this.playBtn.addEventListener('click', this.boundPlayPauseHandler);
        this.backwardBtn.addEventListener('click', this.boundBackwardHandler);
        this.forwardBtn.addEventListener('click', this.boundForwardHandler);
        this.muteBtn.addEventListener('click', this.boundMuteHandler);
        // Listen to wavesurfer events to update UI accordingly
        this.wavesurfer.on('play', this.updatePlayPauseIcon.bind(this));
        this.wavesurfer.on('pause', this.updatePlayPauseIcon.bind(this));
        this.wavesurfer.on('finish', this.boundAudioEndHandler); // Reset icon on finish
        this.wavesurfer.on('mute', this.updateMuteIcon.bind(this));
    }

    updatePlayPauseIcon() {
        if (!this.playBtn || !this.wavesurfer) return;
        const playIcon = this.playBtn.querySelector('i');
        if (!playIcon) return;
        if (this.wavesurfer.isPlaying()) {
            playIcon.className = 'fa-solid fa-pause';
        } else {
            playIcon.className = 'fa-solid fa-play';
        }
    }

    updateMuteIcon() {
        if (!this.muteBtn || !this.wavesurfer) return;
        const muteIcon = this.muteBtn.querySelector('i');
         if (!muteIcon) return;
        // Note: wavesurfer.getMute() might not exist or behave differently depending on version
        // Let's assume toggleMute works and we can check the icon class or store state if needed.
        // For simplicity, let's assume initial state is unmuted.
        if (this.wavesurfer.getMute()) { // Check if getMute() exists and works
            muteIcon.className = 'fa-solid fa-volume-high'; // Icon when muted (shows speaker)
        } else {
            muteIcon.className = 'fa-solid fa-volume-xmark'; // Icon when unmuted
        }
    }

    toggleEnabled(isEnabled) {
        const buttons = [this.playBtn, this.backwardBtn, this.forwardBtn, this.muteBtn];
        buttons.forEach((btn) => {
            if (!btn) return;
            if (isEnabled) {
                btn.disabled = false;
                btn.classList.remove('disabled'); // Use class if styling depends on it
            } else {
                 btn.disabled = true;
                btn.classList.add('disabled');
            }
        });
    }

     // Clean up event listeners and remove the element
     destroy() {
        console.log("Destroying playback controls");
        // Remove event listeners from buttons
        if (this.playBtn) this.playBtn.removeEventListener('click', this.boundPlayPauseHandler);
        if (this.backwardBtn) this.backwardBtn.removeEventListener('click', this.boundBackwardHandler);
        if (this.forwardBtn) this.forwardBtn.removeEventListener('click', this.boundForwardHandler);
        if (this.muteBtn) this.muteBtn.removeEventListener('click', this.boundMuteHandler);

         // Remove event listeners from wavesurfer
         if (this.wavesurfer) {
            // Use un() or off() depending on wavesurfer version
             try {
                 this.wavesurfer.un('play', this.updatePlayPauseIcon.bind(this));
                 this.wavesurfer.un('pause', this.updatePlayPauseIcon.bind(this));
                 this.wavesurfer.un('finish', this.boundAudioEndHandler);
                 this.wavesurfer.un('mute', this.updateMuteIcon.bind(this));
             } catch (e) {
                 console.warn("Wavesurfer might use .off() for removing listeners.");
                 try {
                      this.wavesurfer.off('play');
                      this.wavesurfer.off('pause');
                      this.wavesurfer.off('finish');
                      this.wavesurfer.off('mute');
                 } catch (e2) {
                     console.error("Failed to remove wavesurfer listeners.", e2);
                 }
             }
         }

        // Remove the controls element from the DOM
        if (this.controlsElement && this.controlsElement.parentNode) {
            this.controlsElement.parentNode.removeChild(this.controlsElement);
        }
        // Clear references
        this.wavesurfer = null;
        this.container = null;
        this.controlsElement = null;
        this.playBtn = null;
        this.backwardBtn = null;
        this.forwardBtn = null;
        this.muteBtn = null;
    }
}

// Simplified: Manages visibility of upload vs player components
export function toggleUploadDisplayHTML(state) {
    const dropArea = document.querySelector('#file-drop-area');
    const waveformContainer = document.querySelector('#waveform-container');
    const controlsContainer = document.querySelector('#playback-controls-container');
    const uploadCardBody = document.querySelector('.upload-card .card-body'); // To potentially adjust padding etc.

    if (!dropArea || !waveformContainer || !controlsContainer || !uploadCardBody) {
        console.error("toggleUploadDisplayHTML: Could not find required UI elements.");
        return;
    }

    if (state === 'initial' || state === 'reset') {
        // Show drop area, hide player
        dropArea.style.display = 'flex';
        waveformContainer.style.display = 'none';
        waveformContainer.innerHTML = ''; // Clear any old waveform
        controlsContainer.style.display = 'none';
        controlsContainer.innerHTML = ''; // Clear any old controls
        // Optional: Adjust card padding/style for upload state
        uploadCardBody.classList.remove('showing-player');

        // If reset, also clear results display (handled by main.js calling AnalysisResults.resetDisplay)
        if (state === 'reset') {
            console.log("Resetting UI to initial upload state.");
        }

    } else if (state === 'display' || state === 'hide') {
        // Show player containers, hide drop area
         dropArea.style.display = 'none';
        waveformContainer.style.display = 'block';
        controlsContainer.style.display = 'block';
        // Optional: Adjust card padding/style for player state
        uploadCardBody.classList.add('showing-player');

         // 'hide' is effectively the same as 'display' in this new setup,
         // as main.js now controls showing/hiding the results/selector sections.
         // We just ensure the player area is visible within the upload card.
         console.log(`Setting upload area display state to: ${state}`);
    } else {
        console.warn(`toggleUploadDisplayHTML: Unknown state '${state}'`);
    }
}

// Add CSS for error state if desired (optional)
/*
.classifier-meter.error {
    background-color: #ef4444; // Example error color
}
.meter-percentage.error {
    color: #ef4444;
}
*/
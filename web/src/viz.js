export class AnalysisResults {
    constructor(modelNames) {
        this.modelNames = modelNames;
        this.meters = {};
        this.percentages = {};
        
        // Initialize meters and percentage display DOM refs
        modelNames.forEach((name) => {
            const meterElement = document.querySelector(`#${name} .classifier-meter`);
            const percentageElement = document.querySelector(`#${name} .meter-percentage`);
            this.meters[name] = meterElement;
            this.percentages[name] = percentageElement;
        });
    }

    updateMeters(predictions) {
        Object.entries(predictions).forEach(([model, preds]) => {
            // Ensure we have a valid prediction value
            let value = 0;
            
            // Check if preds is a number or an array
            if (typeof preds === 'number') {
                value = preds;
            } else if (Array.isArray(preds) && preds.length > 0 && typeof preds[0] === 'number') {
                value = preds[0];
            } else {
                console.warn(`Invalid prediction format for ${model}:`, preds);
                value = 0.5; // Default to 50% if invalid
            }
            
            // Validate the value
            if (isNaN(value) || !isFinite(value)) {
                console.warn(`NaN or invalid value for ${model}, using default`);
                value = 0.5;
            }
            
            // Ensure value is between 0 and 1
            value = Math.max(0, Math.min(1, value));
            
            // Convert to percentage (0-100)
            const normalizedValue = Math.round(value * 100);
            
            // Update the meter width
            this.meters[model].style.setProperty('--meter-width', normalizedValue);
            
            // Update the percentage text
            this.percentages[model].textContent = `${normalizedValue}%`;
            
            // Update the data attribute for accessibility
            this.meters[model].setAttribute('data-classifier', `${normalizedValue}%`);
        });
    }

    updateValueBoxes(essentiaAnalysis) {
        if (essentiaAnalysis) {
            // Update BPM (round to nearest integer and validate)
            let bpmValue = 0;
            if (typeof essentiaAnalysis.bpm === 'number' && !isNaN(essentiaAnalysis.bpm)) {
                bpmValue = Math.round(essentiaAnalysis.bpm);
            }
            document.querySelector('#bpm-value').textContent = bpmValue || "—";
            
            // Update Key (validate key and scale)
            let keyText = "—";
            if (essentiaAnalysis.keyData && 
                typeof essentiaAnalysis.keyData.key === 'string' && 
                typeof essentiaAnalysis.keyData.scale === 'string') {
                keyText = `${essentiaAnalysis.keyData.key} ${essentiaAnalysis.keyData.scale}`;
            }
            document.querySelector('#key-value').textContent = keyText;
        } else {
            // If no analysis data, show placeholder
            document.querySelector('#bpm-value').textContent = "—";
            document.querySelector('#key-value').textContent = "—";
        }
    }
}

export class PlaybackControls {
    constructor(wavesurfer) {
        // Get template content
        const template = document.querySelector('#playback-controls');
        const controls = template.content.cloneNode(true);
        
        // Append to the DOM after the waveform
        const fileSelectArea = document.querySelector('#file-select-area');
        fileSelectArea.appendChild(controls);
        
        // Setup control refs
        this.playBtn = document.querySelector('#play');
        this.backwardBtn = document.querySelector('#backward');
        this.forwardBtn = document.querySelector('#forward');
        this.muteBtn = document.querySelector('#mute');
        
        // Connect the WaveSurfer object
        this.wavesurfer = wavesurfer;
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // Play/pause
        this.playBtn.addEventListener('click', () => {
            this.wavesurfer.playPause();
            
            // Toggle play/pause icon
            const playIcon = this.playBtn.querySelector('i');
            if (this.wavesurfer.isPlaying()) {
                playIcon.className = 'fa-solid fa-pause';
            } else {
                playIcon.className = 'fa-solid fa-play';
            }
        });
        
        // Backward 5s
        this.backwardBtn.addEventListener('click', () => {
            this.wavesurfer.skip(-5);
        });
        
        // Forward 5s
        this.forwardBtn.addEventListener('click', () => {
            this.wavesurfer.skip(5);
        });
        
        // Toggle mute
        this.muteBtn.addEventListener('click', () => {
            this.wavesurfer.toggleMute();
            
            // Toggle mute icon
            const muteIcon = this.muteBtn.querySelector('i');
            if (this.wavesurfer.getMute()) {
                muteIcon.className = 'fa-solid fa-volume-high';
            } else {
                muteIcon.className = 'fa-solid fa-volume-xmark';
            }
        });
    }
    
    toggleEnabled(isEnabled) {
        const buttons = [this.playBtn, this.backwardBtn, this.forwardBtn, this.muteBtn];
        
        buttons.forEach((btn) => {
            if (isEnabled) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        });
    }
}

export function toggleUploadDisplayHTML(display) {
    const dropArea = document.querySelector('#file-drop-area');
    const fileSelectArea = document.querySelector('#file-select-area');
    const cardBody = fileSelectArea.closest('.card-body');
    
    if (display === 'display') {
        // Hide the drop area
        dropArea.style.display = 'none';
        
        // Create waveform container
        const waveformElement = document.createElement('div');
        waveformElement.id = 'waveform';
        
        // Add to DOM
        cardBody.appendChild(waveformElement);
        
        // Initialize wavesurfer
        const wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgba(16, 185, 129, 0.3)',
            progressColor: 'rgba(59, 130, 246, 0.8)',
            cursorColor: '#f97316',
            barWidth: 2,
            barRadius: 3,
            cursorWidth: 1,
            height: 80,
            barGap: 2
        });
        
        // Show loader when analyzing
        wavesurfer.on('loading', (percent) => {
            if (percent < 100) {
                document.querySelector('#loader').classList.remove('disabled');
            }
        });
        
        // Hide loader when done
        wavesurfer.on('ready', () => {
            document.querySelector('#loader').classList.add('disabled');
        });
        
        return wavesurfer;
    } else if (display === 'reset') {
        // Remove waveform
        const waveform = document.querySelector('#waveform');
        if (waveform) waveform.remove();
        
        // Remove controls
        const controls = document.querySelector('.playback-controls');
        if (controls) controls.remove();
        
        // Show drop area again
        dropArea.style.display = 'flex';
        
        // Reset all meters
        document.querySelectorAll('.classifier-meter').forEach(meter => {
            meter.style.setProperty('--meter-width', 0);
        });
        
        // Reset all percentage displays
        document.querySelectorAll('.meter-percentage').forEach(percentage => {
            percentage.textContent = '0%';
        });
        
        // Reset metric values
        document.querySelector('#bpm-value').textContent = '—';
        document.querySelector('#key-value').textContent = '—';
    }
}
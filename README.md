# Music Feature Extraction

A comprehensive audio analysis toolkit with both command-line scripts and a web interface for audio feature extraction and music classification. The application detects instruments and mood/theme tags in music files.

## Features

- **Instrument Detection**: Identifies up to 40 different instruments present in the audio
- **Mood/Theme Classification**: Classifies tracks into mood categories (happy, sad, relaxed, aggressive)
- **Audio Metrics Analysis**: Extracts danceability, BPM, and musical key
- **Command-line Scripts**: Run analysis directly from the terminal
- **Web Interface**: Easy-to-use browser-based interface for uploading and analyzing audio files
- **Batch Processing**: Analyze multiple audio files in batches
- **CSV Export**: Download analysis results in CSV format for further processing

## Project Structure

```
music-feature-extraction/
├── models/                      # Pre-trained models
│   ├── mood_model/              # Mood detection models
│   └── instrument_model/        # Instrument detection models
├── scripts/                     # Analysis scripts
│   ├── classify_instruments.py
│   └── classify_mood_theme.py
├── web/                         # Web interface
│   ├── src/                     # JavaScript sources
│   │   ├── main.js              # Core application logic
│   │   ├── audioUtils.js        # Audio processing utilities
│   │   ├── featureExtraction.js # Feature extraction worker
│   │   ├── inference.js         # Model inference worker
│   │   └── viz.js               # Visualization components
│   ├── models/                  # Client-side models
│   ├── index.html               # Main HTML page
│   └── style.css                # CSS styles
├── data/                        # Directory for audio files to analyze
└── results/                     # Analysis results are saved here
```

## Requirements

- **Python 3.8+**: For command-line scripts
- **TensorFlow**: For the pre-trained models
- **Essentia**: Audio processing and feature extraction
- **Modern Web Browser**: Chrome, Firefox, or Edge (for web interface)

## Installation

### Command-line Tools

1. Clone the repository:
   ```
   git clone https://github.com/jasonmokk/music-feature-extraction.git
   cd music-feature-extraction
   ```

2. Create a Python virtual environment and install dependencies:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Web Interface

1. Install Node.js dependencies (if you want to run the web interface locally):
   ```
   npm install
   npm start
   ```

2. Access the web interface at:
   ```
   http://localhost:3000
   ```

## Usage

### Command-line Scripts

1. Place your audio files (MP3, WAV, or OGG format) in the `data/` directory.

2. Run the mood/theme classification script:
   ```
   python scripts/classify_mood_theme.py
   ```

3. Run the instrument detection script:
   ```
   python scripts/classify_instruments.py
   ```

4. Find results in the `results/` directory:
   - `instrument_predictions.csv`: Contains instrument detection results
   - `mood_theme_predictions.csv`: Contains mood/theme classification results

### Web Interface

1. Upload your audio files using the file uploader or by dragging and dropping them onto the upload area.

2. For batch uploads, click on the upload area and select "Upload Folder" to process multiple files at once.

3. The analysis will automatically start and show progress as files are processed.

4. View the results for each file, including:
   - Mood analysis (happy, sad, relaxed, aggressive)
   - Danceability metric
   - BPM (Beats Per Minute)
   - Musical key

5. Download all results as a CSV file using the "Download Results as CSV" button.

## Batch Processing

The web interface supports processing files in batches:

- Upload up to 1000+ files at once
- Files are processed in batches of 20 to optimize memory usage
- Progress bar indicates overall completion percentage
- Results are combined at the end for a single CSV export

## Advanced Options

### Custom Model Integration

To use your own custom models:

1. Place TensorFlow models in the appropriate directories under `/models`
2. Update the model configuration in `src/main.js` (for web interface) or in the Python scripts

### Performance Optimization

- For large audio files, the system automatically shortens audio to 15% of its original length
- Worker threads handle parallel processing to maximize performance
- Memory is automatically freed between batches

## Troubleshooting

### Common Issues

- **Audio decoding errors**: Ensure your audio files are valid MP3, WAV, or OGG format
- **Memory issues with large batches**: Try reducing the batch size in `web/src/main.js`
- **Model loading errors**: Check that all required model files are present in the models directory

### Browser Compatibility

The web interface requires a modern browser with support for:
- Web Audio API
- Web Workers
- ES6+ JavaScript features

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Essentia team for their audio analysis tools
- TensorFlow.js for browser-based machine learning
- WaveSurfer.js for audio visualization
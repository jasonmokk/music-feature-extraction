# Music Feature Extraction

A comprehensive audio analysis toolkit with both command-line scripts and a web interface for audio feature extraction and music classification. The application detects instruments and mood/theme tags in music files.

## Features

- **Instrument Detection**: Identifies up to 40 different instruments present in the audio
- **Mood/Theme Classification**: Classifies tracks into 56 different mood/theme categories
- **Command-line Scripts**: Run analysis directly from the terminal
- **Web Interface**: Easy-to-use browser-based interface for uploading and analyzing audio files
- **Real-time Analysis**: Process audio files directly in your browser

## Project Structure

```
music-feature-extraction/
├── models/                      # Pre-trained models
│   ├── mtg_jamendo_instrument-discogs-effnet-1.pb
│   └── mtg_jamendo_moodtheme-discogs-effnet-1.pb
├── scripts/                     # Analysis scripts
│   ├── classify_instruments.py
│   └── classify_mood_theme.py
├── src/                         # Source code
│   ├── classifiers/             # Classifier modules
│   │   ├── instrument_detector.py
│   │   └── mood_theme_classifier.py
│   ├── utils/                   # Utility functions
│   │   ├── config.py
│   │   └── paths.py
│   ├── main.py                  # Main processing pipeline
│   └── server.py                # Web server
├── web/                         # Web interface
│   ├── src/                     # JavaScript sources
│   │   └── ...
│   ├── models/                  # Client-side models (if any)
│   ├── index.html               # Main HTML page
│   └── style.css                # CSS styles
├── data/                        # Directory for audio files to analyze
├── results/                     # Analysis results are saved here
├── requirements.txt             # Python dependencies
└── README.md                    # This file
```

## Requirements

- **Python 3.12**: This project requires Python 3.12 or later
- **TensorFlow**: Compatible with the pre-trained models
- **Essentia**: For audio processing and feature extraction

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/jasonmokk/music-feature-extraction.git
   cd music-feature-extraction
   ```

2. Create a Python 3.12 virtual environment and install dependencies:
   ```
   python3.12 -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   pip install -r requirements.txt
   ```

## Usage

### Command-line Scripts

1. Place your audio files (MP3 format) in the `data/` directory.

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
   - `mtg_jamendo_moodtheme_predictions.csv`: Contains mood/theme classification results

### Web Interface

1. Start the server:
   ```
   python src/server.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

3. Upload an audio file and analyze it using the web interface.

## Troubleshooting

If you encounter TensorFlow model loading errors:

```
RuntimeError: Error while configuring TensorflowPredictEffnetDiscogs: TensorflowPredict: Error importing graph. Invalid GraphDef
```

Try installing a compatible version of TensorFlow:

```
pip uninstall -y tensorflow tensorflow-cpu tensorflow-gpu
pip install tensorflow==2.8.0
```

=======
## **Results**

All results are saved as CSV files in the `results/` directory for easy analysis and integration with other tools.

## **Models**

Pre-trained models in the `models/` directory include:
- Discogs EfficientNet embeddings
- Mood classifiers
- Instrument detection
- Mood & theme classification


## **Acknowledgments**

- Essentia team for their audio analysis tools
- MTG-Jamendo dataset creators
- Dr. Xi Kang at the Owen Graduate School of Management

This project uses pre-trained models from the Music Technology Group (MTG) at Universitat Pompeu Fabra, Barcelona, specifically from their MTG-Jamendo dataset research. 

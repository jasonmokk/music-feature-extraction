# Music Feature Extraction

A web-based application for audio feature extraction and music classification. The application detects instruments and mood/theme tags in music files.

## Features

- **Instrument Detection**: Identifies up to 40 different instruments present in the audio
- **Mood/Theme Classification**: Classifies tracks into 56 different mood/theme categories
- **Web Interface**: Easy-to-use browser-based interface for uploading and analyzing audio files
- **Real-time Analysis**: Process audio files directly in your browser

## Project Structure

```
music-feature-extraction/
├── models/                      # Pre-trained models
│   ├── mtg_jamendo_instrument-discogs-effnet-1.pb
│   └── mtg_jamendo_moodtheme-discogs-effnet-1.pb
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
│   ├── images/                  # Images for the web interface
│   ├── index.html               # Main HTML page
│   └── style.css                # CSS styles
├── requirements.txt             # Python dependencies
└── README.md                    # This file
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/music-feature-extraction.git
   cd music-feature-extraction
   ```

2. Create a virtual environment and install dependencies:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   pip install -r requirements.txt
   ```

## Usage

1. Start the server:
   ```
   python src/server.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

3. Upload an audio file and analyze it using the web interface.

## Credits

This project uses pre-trained models from the Music Technology Group (MTG) at Universitat Pompeu Fabra, Barcelona, specifically from their MTG-Jamendo dataset research. 
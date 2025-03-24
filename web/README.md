# Music Feature Extraction Web Interface

This web application provides a user-friendly interface for the music feature extraction pipeline. Users can upload audio files, analyze them, and visualize the results in an interactive dashboard.

## Features

- **File Upload**: Upload MP3 or WAV files for analysis (up to 32MB)
- **Comprehensive Analysis**: Automatically extracts features, moods, genres, and instruments
- **Interactive Visualizations**: View analysis results through dynamic charts and graphs
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Make sure all models are downloaded in the models directory

## Running the Application

To start the web server:

```bash
python web/app.py
```

Then open http://localhost:5000 in your web browser.

## Directory Structure

```
web/
├── app.py               # Flask application
├── static/              # Static assets
│   ├── css/             # CSS stylesheets
│   ├── js/              # JavaScript files
│   ├── uploads/         # Uploaded audio files (temporary)
│   └── results/         # Analysis results and charts
└── templates/           # HTML templates
    ├── index.html       # Upload page
    └── results.html     # Results dashboard
```

## Usage

1. Visit the homepage and upload an MP3 or WAV file
2. Wait for the analysis to complete (processing time depends on file size)
3. View the detailed analysis results:
   - Basic audio features (tempo, key, energy, etc.)
   - Mood classification
   - Instrument detection
   - Mood theme analysis

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript
- **Visualizations**: Plotly.js
- **Styling**: Bootstrap 5
- **Data Processing**: Essentia and our custom ML models 
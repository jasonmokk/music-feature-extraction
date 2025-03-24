# **Music Feature Extraction**

A comprehensive audio analysis toolkit for extracting music features from audio files, including sonic characteristics, mood classification, genre identification, and instrument detection. Built with Essentia and TensorFlow.

## **Features**

- **Core Audio Analysis**: Extract Spotify-like features including tempo, energy, loudness, danceability, key, and more
- **Mood Classification**: Detect emotional content (happy, sad, aggressive, relaxed, party)  
- **Genre Recognition**: Classify music into 400 different genre categories using Discogs taxonomy
- **Instrument Detection**: Identify up to 40 different instruments present in audio
- **Mood & Theme Analysis**: Classify tracks into 56 different mood/theme categories

## **Tools & Tech Stack**

- **Essentia**: High-performance audio analysis library with TensorFlow integration
- **TensorFlow**: Pre-trained models for music classification
- **Pandas**: Data handling and CSV output
- **Python 3.12**: Modern Python for improved performance

## **Installation**

1. **Install Python 3.12**:
   - On macOS/Linux:
     ```bash
     brew install python@3.12
     ```
   - On Windows:
     Download from [python.org](https://www.python.org/downloads/)

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/music-feature-extraction.git
   cd music-feature-extraction
   ```

3. **Create Virtual Environment**:
   - Create:
     ```bash
     python3.12 -m venv venv
     ```
   - Activate:
     - macOS/Linux: `source venv/bin/activate`
     - Windows: `venv\Scripts\activate`

4. **Install Dependencies**:
   ```bash
   pip install -e .
   ```
   or
   ```bash
   pip install essentia-tensorflow pandas tqdm "numpy<2"
   ```

## **Usage**

### **Quick Start: Complete Pipeline**

The easiest way to run the complete analysis pipeline on your audio files:

```bash
python scripts/run_pipeline.py
```

This will process all audio files in the `data/` directory and extract all available features and classifications, saving results to CSV files in the `results/` directory.

You can also run specific parts of the pipeline:

```bash
# Run only mood classification
python scripts/run_pipeline.py --mood

# Run feature extraction and genre classification
python scripts/run_pipeline.py --features --genre

# Display help message with all options
python scripts/run_pipeline.py --help
```

### **Individual Components**

You can also run each component separately:

### **1. Prepare Audio**
Place your `.mp3` or `.wav` files in the `data/` directory.

### **2. Basic Feature Extraction**
Extract core audio features (tempo, key, energy, etc.):
```bash
python scripts/extract_features.py
```

### **3. Mood Analysis** 
Classify emotional content of tracks:
```bash
python scripts/classify_mood.py
```

### **4. Genre Classification**
Identify music genres using Discogs taxonomy:
```bash
python scripts/classify_genre.py
```

### **5. Instrument Detection**
Detect instruments present in audio:
```bash
python scripts/detect_instruments.py
```

### **6. Mood & Theme Classification**
Identify mood and thematic elements:
```bash
python scripts/classify_mood_theme.py
```

### **7. Low-Level Analysis**
Extract detailed audio characteristics:
```bash
python scripts/extract_low_level.py
```

## **Results**

All results are saved as CSV files in the `results/` directory for easy analysis and integration with other tools.

## **Models**

Pre-trained models in the `models/` directory include:
- Discogs EfficientNet embeddings
- Mood classifiers
- Genre classifier
- Instrument detection
- Mood & theme classification

## **License**

[Insert your license information here]

## **Acknowledgments**

- Essentia team for their audio analysis tools
- MTG-Jamendo dataset creators


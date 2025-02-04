"""
Feature extraction script for analyzing musical creativity and mood in AI-generated vs human music.
Extracts key audio features using Essentia library for later analysis of innovation/homogeneity.
"""

import os
import pandas as pd
from tqdm import tqdm  # Progress bar
from essentia.standard import (
    MonoLoader,          # Audio loading
    RhythmExtractor2013, # Tempo analysis
    KeyExtractor,        # Musical key detection
    Danceability,        # Groove/routine pattern detection
    Loudness,            # Perceived volume (EBU R128 standard)
    Energy,              # Signal intensity
    Duration,             # Track length
    DynamicComplexity
)

# --------------------------
# PATH CONFIGURATION
# --------------------------
# Using two-level parent directory structure:
# project/
# ├── src/ (script location)
# ├── data/ (input audio files)
# └── results/ (output CSVs)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")        # Input directory for audio files
RESULTS_DIR = os.path.join(BASE_DIR, "results")  # Output directory for features
os.makedirs(RESULTS_DIR, exist_ok=True)          # Create results dir if missing

def extract_features(file_path):
    """Extracts musical features from audio files with error handling.
    
    Args:
        file_path: Path to audio file (supports MP3, WAV, etc.)
        
    Returns:
        Dictionary of features or None if fatal error occurs
    """
    features = {"filename": os.path.basename(file_path)}
    
    try:
        # Load audio as mono channel at 44.1kHz for consistent analysis
        # Note: Essentia requires mono signals for most features
        loader = MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

    # --------------------------
    # CORE FEATURE EXTRACTION
    # --------------------------
    
    # Duration (seconds) - fundamental musical property
    try:
        features['duration'] = Duration()(audio)
    except Exception as e:
        features['duration'] = None  

    # Tempo (BPM) - rhythmic innovation analysis
    try:
        # Using RhythmExtractor2013 algorithm (Brossier's method)
        tempo, *_ = RhythmExtractor2013()(audio)
        features['tempo'] = tempo
    except Exception as e:
        features['tempo'] = None  

    # Tonality (Key/Scale) - harmonic creativity indicator
    try:
        key, scale, _ = KeyExtractor()(audio)
        features['key'] = key    # Musical key (C, D, etc.)
        features['scale'] = scale  # Major/minor tonality
    except Exception as e:
        features['key'] = None   # Fails on atonal/experimental music
        features['scale'] = None

    # Danceability - quantifies groove/routine patterns (0-1)
    try:
        # Combines rhythm stability and beat strength
        features['danceability'] = Danceability()(audio)[0]
    except Exception as e:
        features['danceability'] = None  # Fails on non-percussive tracks

    # Loudness (LUFS) - perceived volume normalization
    try:
        # Uses EBU R128 standard, important for loudness wars analysis
        features['loudness'] = Loudness()(audio)
    except Exception as e:
        features['loudness'] = None

    # Energy - correlates with musical intensity/innovation
    try:
        # RMS-based measure of signal power
        features['energy'] = Energy()(audio)
    except Exception as e:
        features['energy'] = None

    try:
        dyn_complex = DynamicComplexity()(audio)
        features['dynamic_complexity'] = dyn_complex[0]  # Higher = more dynamic range
    except:
        features['dynamic_complexity'] = None

    return features

def process_all_files(data_dir, results_csv):
    """Processes all audio files in directory with progress tracking.
    
    Args:
        data_dir: Input directory with audio files
        results_csv: Output path for CSV results
    """
    # Filter only MP3 files (modify if using other formats)
    audio_files = [f for f in os.listdir(data_dir) if f.endswith(".mp3")]
    
    if not audio_files:
        print(f"No MP3 files found in {data_dir}")
        return

    all_features = []
    
    # Process files with visual progress bar
    for file_name in tqdm(audio_files, desc="Analyzing Music"):
        file_path = os.path.join(data_dir, file_name)
        features = extract_features(file_path)
        
        if features:  # Only keep successful extractions
            all_features.append(features)

    # Save to CSV for statistical analysis
    if all_features:
        df = pd.DataFrame(all_features)
        df.to_csv(results_csv, index=False)
        print(f"\nSuccess: Processed {len(all_features)} files → {results_csv}")
    else:
        print("\nWarning: No features extracted. Check file formats/errors.")

if __name__ == "__main__":
    # Entry point - runs full processing pipeline
    output_path = os.path.join(RESULTS_DIR, "music_features.csv")
    process_all_files(DATA_DIR, output_path)
"""
Feature extraction script for analyzing musical creativity and mood in AI-generated vs human music.
Extracts a comprehensive set of features using Essentia's MusicExtractor.
Aggregates low-level, rhythm, and tonal frame features (mean and stdev) for each track.
"""

import os
import pandas as pd
from tqdm import tqdm  # For progress tracking
import essentia.standard as es

# --------------------------
# PATH CONFIGURATION
# --------------------------
# Directory structure:
# project/
# ├── data/ (input MP3 files)
# ├── scripts/ (this script)
# └── results/ (output CSV)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")        # Directory with audio files
RESULTS_DIR = os.path.join(BASE_DIR, "results")  # Output directory for CSV results
os.makedirs(RESULTS_DIR, exist_ok=True)          # Create results directory if it doesn't exist

def extract_features_music_extractor(file_path):
    """Extracts features from an audio file using Essentia's MusicExtractor.
    
    This function computes aggregated low-level, rhythm, and tonal features (mean and stdev)
    from the audio file by simply passing the filename to the extractor.
    
    Args:
        file_path (str): Path to the audio file.
    
    Returns:
        dict: A dictionary with aggregated feature names and values.
    """
    features = {"filename": os.path.basename(file_path)}
    
    try:
        # Instantiate MusicExtractor with aggregated statistics for low-level, rhythm, and tonal features.
        extractor = es.MusicExtractor(lowlevelStats=['mean', 'stdev'],
                                      rhythmStats=['mean', 'stdev'],
                                      tonalStats=['mean', 'stdev'])
        # Note: MusicExtractor accepts a filename directly.
        pool, pool_frames = extractor(file_path)
    except Exception as e:
        print(f"Error extracting features with MusicExtractor for {file_path}: {e}")
        return None

    # Flatten the aggregated pool: iterate over each descriptor in the pool.
    for key in pool.descriptorNames():
        try:
            value = pool[key]
            # If the value is a list or tuple (e.g. MFCC mean vector), convert it to a comma-separated string.
            if isinstance(value, (list, tuple)):
                features[key] = ", ".join(map(str, value))
            else:
                features[key] = value
        except Exception as e:
            print(f"Error processing feature '{key}' for {file_path}: {e}")
            features[key] = None

    return features

def process_all_files(data_dir, results_csv, use_music_extractor=True):
    """Processes all MP3 files in the specified directory using MusicExtractor.
    
    Args:
        data_dir (str): Directory containing MP3 files.
        results_csv (str): Path to save the output CSV.
        use_music_extractor (bool): Flag to select MusicExtractor extraction.
    """
    audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
    if not audio_files:
        print(f"No MP3 files found in {data_dir}")
        return

    all_features = []
    for file_name in tqdm(audio_files, desc="Analyzing Music"):
        file_path = os.path.join(data_dir, file_name)
        if use_music_extractor:
            features = extract_features_music_extractor(file_path)
        else:
            # Here you could call your original feature extraction method if needed.
            features = None

        if features:
            all_features.append(features)

    if all_features:
        df = pd.DataFrame(all_features)
        df.to_csv(results_csv, index=False)
        print(f"\nSuccess: Processed {len(all_features)} files → {results_csv}")
    else:
        print("\nWarning: No features extracted. Check file formats/errors.")

if __name__ == "__main__":
    output_path = os.path.join(RESULTS_DIR, "low_level_features.csv")
    # Set use_music_extractor=True to use MusicExtractor.
    process_all_files(DATA_DIR, output_path, use_music_extractor=True)

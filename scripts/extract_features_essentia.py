import os
import pandas as pd
from tqdm import tqdm
from essentia.standard import (
    MonoLoader,
    RhythmExtractor2013,
    KeyExtractor,
    Danceability,
    Loudness,
    Energy,
    Duration
)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def extract_features(file_path):
    features = {"filename": os.path.basename(file_path)}
    
    try:
        # Load audio
        loader = MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

    # --- Feature extraction with error handling ---
    try:
        duration_extractor = Duration()
        features['duration'] = duration_extractor(audio)
    except Exception as e:
        features['duration'] = None

    try:
        # Tempo only (beat intervals removed)
        rhythm_extractor = RhythmExtractor2013()
        tempo, *_ = rhythm_extractor(audio)  # Unpack only tempo
        features['tempo'] = tempo
    except Exception as e:
        features['tempo'] = None

    try:
        key_extractor = KeyExtractor()
        key, scale, _ = key_extractor(audio)
        features['key'] = key
        features['scale'] = scale
    except Exception as e:
        features['key'] = None
        features['scale'] = None

    try:
        danceability_extractor = Danceability()
        danceability, *_ = danceability_extractor(audio)
        features['danceability'] = danceability
    except Exception as e:
        features['danceability'] = None

    try:
        loudness_extractor = Loudness()
        features['loudness'] = loudness_extractor(audio)
    except Exception as e:
        features['loudness'] = None

    try:
        energy_extractor = Energy()
        features['energy'] = energy_extractor(audio)
    except Exception as e:
        features['energy'] = None

    return features

def process_all_files(data_dir, results_csv):
    audio_files = [f for f in os.listdir(data_dir) if f.endswith(".mp3")]
    all_features = []
    
    for file_name in tqdm(audio_files, desc="Processing files"):
        file_path = os.path.join(data_dir, file_name)
        features = extract_features(file_path)
        if features:
            all_features.append(features)

    if all_features:
        df = pd.DataFrame(all_features)
        df.to_csv(results_csv, index=False)
        print(f"\nResults saved to {results_csv}")
    else:
        print("\nNo features extracted. Check audio files.")

if __name__ == "__main__":
    results_csv = os.path.join(RESULTS_DIR, "essentia_results.csv")
    process_all_files(DATA_DIR, results_csv)
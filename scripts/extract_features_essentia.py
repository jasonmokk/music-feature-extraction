import os
import pandas as pd
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
    try:
        # Load audio
        loader = MonoLoader(filename=file_path)
        audio = loader()

        # Dictionary for storing features
        features = {"filename": os.path.basename(file_path)}

        # Duration
        duration_extractor = Duration()
        duration = duration_extractor(audio)
        features['duration'] = duration

        # Tempo and Beat Intervals
        rhythm_extractor = RhythmExtractor2013()
        tempo, _, _, _, bpmIntervals = rhythm_extractor(audio)
        features['tempo'] = tempo
        features['beat intervals'] = bpmIntervals

        # Key and Scale
        key_extractor = KeyExtractor()
        key, scale, _ = key_extractor(audio)
        features['key'] = key
        features['scale'] = scale

        # Danceability
        try:
            danceability_extractor = Danceability()
            danceability, *_ = danceability_extractor(audio)
            features['danceability'] = danceability
        except Exception as e:
            print(f"Warning: Could not extract danceability for {file_path} - {e}")
            features['danceability'] = None

        # Loudness
        loudness_extractor = Loudness()
        loudness = loudness_extractor(audio)
        features['loudness'] = loudness

        # Energy
        energy_extractor = Energy()
        energy = energy_extractor(audio)
        features['energy'] = energy

        return features
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def process_all_files(data_dir, results_csv):
    all_features = []
    for file_name in os.listdir(data_dir):
        if file_name.endswith(".mp3"):
            file_path = os.path.join(data_dir, file_name)
            print(f"Processing {file_name}...")

            # Extract features
            features = extract_features(file_path)
            if features:
                all_features.append(features)

    # Save all features to a CSV file
    if all_features:
        df = pd.DataFrame(all_features)
        df.to_csv(results_csv, index=False)
        print(f"Results saved to {results_csv}")
    else:
        print("No features extracted. Check your audio files.")

if __name__ == "__main__":
    results_csv = os.path.join(RESULTS_DIR, "audio_features_essentia.csv")
    process_all_files(DATA_DIR, results_csv)

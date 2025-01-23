import librosa
import os
import numpy as np
import pandas as pd

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

os.makedirs(RESULTS_DIR, exist_ok=True)

def extract_features(file_path):
    try:
        # Load audio
        y, sr = librosa.load(file_path, sr=None)

        # Dic for storing features
        features = {"filename": os.path.basename(file_path)}

        # Tempo and Beat
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        features['tempo'] = tempo

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
    results_csv = os.path.join(RESULTS_DIR, "audio_features_librosa.csv")
    process_all_files(DATA_DIR, results_csv)

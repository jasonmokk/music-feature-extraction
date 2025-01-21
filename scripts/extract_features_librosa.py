import librosa
import os
import numpy as np
import pandas as pd

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# Ensure results directory exists
os.makedirs(RESULTS_DIR, exist_ok=True)

def extract_features(file_path):
    try:
        # Load audio
        y, sr = librosa.load(file_path, sr=None)

        # Initialize a dictionary for storing features
        features = {"filename": os.path.basename(file_path)}

        # Tempo and Beat
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        features['tempo'] = tempo

        # Spectral Features
        features['spectral_centroid'] = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        features['spectral_bandwidth'] = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))
        features['spectral_contrast'] = np.mean(librosa.feature.spectral_contrast(y=y, sr=sr))
        features['spectral_rolloff'] = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))

        # MFCCs (First 13 Coefficients)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        for i in range(1, 14):
            features[f'mfcc_{i}'] = np.mean(mfccs[i-1])

        # Energy
        rms = librosa.feature.rms(y=y)
        features['rms_energy'] = np.mean(rms)

        # Zero-Crossing Rate
        zcr = librosa.feature.zero_crossing_rate(y)
        features['zero_crossing_rate'] = np.mean(zcr)

        # Harmonic and Percussive Components
        harmonic, percussive = librosa.effects.hpss(y)
        features['harmonic_energy'] = np.mean(harmonic)
        features['percussive_energy'] = np.mean(percussive)

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

# Main function
if __name__ == "__main__":
    results_csv = os.path.join(RESULTS_DIR, "audio_features_librosa.csv")
    process_all_files(DATA_DIR, results_csv)

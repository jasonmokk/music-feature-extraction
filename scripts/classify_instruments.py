"""
MTG-Jamendo Instrument Detection Script

This script processes audio files from the data directory, computes embeddings using the Discogs EfficientNet model,
and then predicts instrument presence using the MTG-Jamendo instrument detector. Predictions are saved to a CSV file.
"""

import os
import pandas as pd
import numpy as np
from tqdm import tqdm
from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D

# --------------------------
# PATH CONFIGURATION
# --------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

# --------------------------
# MODEL PATHS
# --------------------------
# Path for the base Discogs EfficientNet embedding model
EMBEDDING_MODEL_PATH = os.path.join(BASE_DIR, "models", "discogs-effnet-bs64-1.pb")
# Path for the MTG-Jamendo instrument detector model
INSTRUMENT_MODEL_PATH = os.path.join(BASE_DIR, "models", "mtg_jamendo_instrument-discogs-effnet-1.pb")

# --------------------------
# LOAD MODELS
# --------------------------
embedding_model = TensorflowPredictEffnetDiscogs(
    graphFilename=EMBEDDING_MODEL_PATH,
    output="PartitionedCall:1"
)
instrument_model = TensorflowPredict2D(
    graphFilename=INSTRUMENT_MODEL_PATH
)

# --------------------------
# LABELS (40 instruments)
# --------------------------
LABELS = [
    "accordion", "acousticbassguitar", "acousticguitar", "bass", "beat", "bell", "bongo", "brass", "cello",
    "clarinet", "classicalguitar", "computer", "doublebass", "drummachine", "drums", "electricguitar",
    "electricpiano", "flute", "guitar", "harmonica", "harp", "horn", "keyboard", "oboe", "orchestra", "organ",
    "pad", "percussion", "piano", "pipeorgan", "rhodes", "sampler", "saxophone", "strings", "synthesizer",
    "trombone", "trumpet", "viola", "violin", "voice"
]

def detect_instruments(file_path):
    """
    Detect instruments in an audio file using the MTG-Jamendo model.
    
    Args:
        file_path (str): Path to the audio file.
    
    Returns:
        dict: Dictionary with the file name and predicted probabilities for each instrument.
    """
    try:
        # Load audio at 16 kHz with resampleQuality=4
        audio = MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)()
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

    try:
        # Compute embeddings using the Discogs EfficientNet model
        embeddings = embedding_model(audio)
    except Exception as e:
        print(f"Error computing embeddings for {file_path}: {e}")
        return None

    try:
        # Predict instrument probabilities
        predictions = instrument_model(embeddings)
    except Exception as e:
        print(f"Error computing predictions for {file_path}: {e}")
        return None

    # Process predictions
    result = {"filename": os.path.basename(file_path)}
    try:
        if isinstance(predictions, np.ndarray):
            predictions = predictions.flatten()
            for i, label in enumerate(LABELS):
                result[label] = float(predictions[i]) if i < len(predictions) else None
        else:
            result["predictions"] = predictions
    except Exception as e:
        print(f"Error processing predictions for {file_path}: {e}")
        return None

    return result

def process_all_files(data_dir, results_csv):
    """
    Process all MP3 files in the data directory and save predictions to a CSV file.
    
    Args:
        data_dir (str): Directory containing MP3 files.
        results_csv (str): Output CSV file path.
    """
    audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
    if not audio_files:
        print(f"No MP3 files found in {data_dir}")
        return

    all_results = []
    for file_name in tqdm(audio_files, desc="Detecting Instruments"):
        file_path = os.path.join(data_dir, file_name)
        prediction = detect_instruments(file_path)
        if prediction is not None:
            all_results.append(prediction)

    if all_results:
        df = pd.DataFrame(all_results)
        df.to_csv(results_csv, index=False)
        print(f"Processed {len(all_results)} files. Results saved to {results_csv}")
    else:
        print("No predictions computed.")

if __name__ == "__main__":
    output_csv = os.path.join(RESULTS_DIR, "instrument_predictions.csv")
    process_all_files(DATA_DIR, output_csv)

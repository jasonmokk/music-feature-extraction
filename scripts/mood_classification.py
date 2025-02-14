"""
Discogs-based Mood Classification Script

This script classifies audio tracks by mood using Discogs-based models.
For each MP3 file in the data folder, it:
  - Loads the audio (resampling to 16 kHz with resampleQuality=4)
  - Computes embeddings using TensorflowPredictEffnetDiscogs
  - Predicts the probability for each mood (aggressive, happy, party, relaxed, sad)
The results are saved to a CSV file.
"""

import os
import pandas as pd
from tqdm import tqdm
import numpy as np
from essentia.standard import (
    MonoLoader,
    TensorflowPredictEffnetDiscogs,
    TensorflowPredict2D
)

# --------------------------
# PATH CONFIGURATION
# --------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(RESULTS_DIR, exist_ok=True)

# --------------------------
# MODEL PATHS
# --------------------------
embedding_model_path = os.path.join(MODELS_DIR, "discogs-effnet-bs64-1.pb")
mood_aggressive_path = os.path.join(MODELS_DIR, "mood_aggressive-discogs-effnet-1.pb")
mood_happy_path      = os.path.join(MODELS_DIR, "mood_happy-discogs-effnet-1.pb")
mood_party_path      = os.path.join(MODELS_DIR, "mood_party-discogs-effnet-1.pb")
mood_relaxed_path    = os.path.join(MODELS_DIR, "mood_relaxed-discogs-effnet-1.pb")
mood_sad_path        = os.path.join(MODELS_DIR, "mood_sad-discogs-effnet-1.pb")

# --------------------------
# LOAD MODELS
# --------------------------
# Use the Discogs EfficientNet model for embeddings.
embedding_model = TensorflowPredictEffnetDiscogs(
    graphFilename=embedding_model_path,
    output="PartitionedCall:1"
)

# Load each mood classifier.
mood_aggressive_model = TensorflowPredict2D(
    graphFilename=mood_aggressive_path,
    output="model/Softmax"
)
mood_happy_model = TensorflowPredict2D(
    graphFilename=mood_happy_path,
    output="model/Softmax"
)
mood_party_model = TensorflowPredict2D(
    graphFilename=mood_party_path,
    output="model/Softmax"
)
mood_relaxed_model = TensorflowPredict2D(
    graphFilename=mood_relaxed_path,
    output="model/Softmax"
)
mood_sad_model = TensorflowPredict2D(
    graphFilename=mood_sad_path,
    output="model/Softmax"
)

def predict_discogs_moods(file_path):
    """
    Predict mood probabilities using Discogs-based models.
    
    Args:
        file_path (str): Path to the audio file.
    
    Returns:
        dict: A dictionary with the predicted positive class probability for each mood.
    """
    try:
        # Load audio at 16 kHz with resampleQuality=4.
        audio = MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)()
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

    try:
        # Compute embeddings using the Discogs EfficientNet model.
        embeddings = embedding_model(audio)
    except Exception as e:
        print(f"Error computing embeddings for {file_path}: {e}")
        return None

    moods = {}
    try:
        # Compute predictions for each mood.
        pred_aggressive = mood_aggressive_model(embeddings)
        pred_happy      = mood_happy_model(embeddings)
        pred_party      = mood_party_model(embeddings)
        pred_relaxed    = mood_relaxed_model(embeddings)
        pred_sad        = mood_sad_model(embeddings)
        
        # Helper function: if the prediction is segmented, average over segments.
        # We assume each prediction is a 2-element vector and index 0 corresponds to the positive class.
        def get_positive_prob(pred):
            if isinstance(pred, np.ndarray):
                if pred.ndim > 1:
                    avg_pred = pred.mean(axis=0)
                else:
                    avg_pred = pred
                return float(avg_pred[0])
            return None
        
        moods["mood_aggressive"] = get_positive_prob(pred_aggressive)
        moods["mood_happy"]      = get_positive_prob(pred_happy)
        moods["mood_party"]      = get_positive_prob(pred_party)
        moods["mood_relaxed"]    = get_positive_prob(pred_relaxed)
        moods["mood_sad"]        = get_positive_prob(pred_sad)
        
    except Exception as e:
        print(f"Error predicting moods for {file_path}: {e}")
        return None

    return moods

def process_all_files(data_dir, results_csv):
    """
    Process all MP3 files in the data directory and save the Discogs-based mood predictions to CSV.
    
    Args:
        data_dir (str): Directory containing MP3 files.
        results_csv (str): Path to the output CSV file.
    """
    audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
    if not audio_files:
        print(f"No MP3 files found in {data_dir}")
        return

    results = []
    for file_name in tqdm(audio_files, desc="Predicting Discogs Moods"):
        file_path = os.path.join(data_dir, file_name)
        mood_predictions = predict_discogs_moods(file_path)
        if mood_predictions is not None:
            result = {"filename": file_name}
            result.update(mood_predictions)
            results.append(result)

    if results:
        df = pd.DataFrame(results)
        df.to_csv(results_csv, index=False)
        print(f"Processed {len(results)} files. Results saved to {results_csv}")
    else:
        print("No predictions computed.")

if __name__ == "__main__":
    output_csv = os.path.join(RESULTS_DIR, "discogs_mood_predictions.csv")
    process_all_files(DATA_DIR, output_csv)

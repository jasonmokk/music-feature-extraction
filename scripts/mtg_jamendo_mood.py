"""
MTG-Jamendo Mood and Theme Classification Script

This script processes audio files from the data directory, computes embeddings using the Discogs EfficientNet model,
and then predicts mood and theme labels using the MTG-Jamendo mood/theme classifier. Predictions are saved to a CSV file.
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
# Path for the MTG-Jamendo mood/theme classifier model
MTG_JAMENDO_MODEL_PATH = os.path.join(BASE_DIR, "models", "mtg_jamendo_moodtheme-discogs-effnet-1.pb")

# --------------------------
# LOAD MODELS
# --------------------------
embedding_model = TensorflowPredictEffnetDiscogs(
    graphFilename=EMBEDDING_MODEL_PATH,
    output="PartitionedCall:1"
)
mtg_jamendo_model = TensorflowPredict2D(
    graphFilename=MTG_JAMENDO_MODEL_PATH
)

# --------------------------
# LABELS (56 classes)
# --------------------------
LABELS = [
    "action", "adventure", "advertising", "background", "ballad", "calm", "children", "christmas",
    "commercial", "cool", "corporate", "dark", "deep", "documentary", "drama", "dramatic", "dream",
    "emotional", "energetic", "epic", "fast", "film", "fun", "funny", "game", "groovy", "happy",
    "heavy", "holiday", "hopeful", "inspiring", "love", "meditative", "melancholic", "melodic",
    "motivational", "movie", "nature", "party", "positive", "powerful", "relaxing", "retro",
    "romantic", "sad", "sexy", "slow", "soft", "soundscape", "space", "sport", "summer", "trailer",
    "travel", "upbeat", "uplifting"
]

def predict_mtg_jamendo_moodtheme(file_path):
    """
    Predict mood and theme labels for an audio file using the MTG-Jamendo model.
    
    Args:
        file_path (str): Path to the audio file.
    
    Returns:
        dict: Dictionary with the file name and predicted probabilities for each label.
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
        # Predict mood and theme probabilities
        predictions = mtg_jamendo_model(embeddings)
    except Exception as e:
        print(f"Error computing predictions for {file_path}: {e}")
        return None

    # Process predictions assuming a numpy array output
    result = {"filename": os.path.basename(file_path)}
    try:
        if isinstance(predictions, np.ndarray):
            # Flatten predictions in case of multi-dimensional output
            predictions = predictions.flatten()
            for i, label in enumerate(LABELS):
                # Map each probability to the corresponding label
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
    for file_name in tqdm(audio_files, desc="Predicting MTG-Jamendo Mood/Theme"):
        file_path = os.path.join(data_dir, file_name)
        prediction = predict_mtg_jamendo_moodtheme(file_path)
        if prediction is not None:
            all_results.append(prediction)

    if all_results:
        df = pd.DataFrame(all_results)
        df.to_csv(results_csv, index=False)
        print(f"Processed {len(all_results)} files. Results saved to {results_csv}")
    else:
        print("No predictions computed.")

if __name__ == "__main__":
    output_csv = os.path.join(RESULTS_DIR, "mtg_jamendo_moodtheme_predictions.csv")
    process_all_files(DATA_DIR, output_csv)

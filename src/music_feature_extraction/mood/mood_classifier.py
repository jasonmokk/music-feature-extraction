"""
Discogs-based Mood Classification Module

This module classifies audio tracks by mood using Discogs-based models.
It computes embeddings using TensorflowPredictEffnetDiscogs and predicts
the probability for emotional categories (aggressive, happy, party, relaxed, sad).
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


class MoodClassifier:
    """Class for mood classification of audio tracks."""
    
    def __init__(self, models_dir):
        """
        Initialize the mood classifier with model paths.
        
        Args:
            models_dir (str): Path to the directory containing models.
        """
        # Model paths
        embedding_model_path = os.path.join(models_dir, "discogs-effnet-bs64-1.pb")
        mood_aggressive_path = os.path.join(models_dir, "mood_aggressive-discogs-effnet-1.pb")
        mood_happy_path      = os.path.join(models_dir, "mood_happy-discogs-effnet-1.pb")
        mood_party_path      = os.path.join(models_dir, "mood_party-discogs-effnet-1.pb")
        mood_relaxed_path    = os.path.join(models_dir, "mood_relaxed-discogs-effnet-1.pb")
        mood_sad_path        = os.path.join(models_dir, "mood_sad-discogs-effnet-1.pb")
        
        # Load embedding model
        self.embedding_model = TensorflowPredictEffnetDiscogs(
            graphFilename=embedding_model_path,
            output="PartitionedCall:1"
        )
        
        # Load mood classifiers
        self.mood_aggressive_model = TensorflowPredict2D(
            graphFilename=mood_aggressive_path,
            output="model/Softmax"
        )
        self.mood_happy_model = TensorflowPredict2D(
            graphFilename=mood_happy_path,
            output="model/Softmax"
        )
        self.mood_party_model = TensorflowPredict2D(
            graphFilename=mood_party_path,
            output="model/Softmax"
        )
        self.mood_relaxed_model = TensorflowPredict2D(
            graphFilename=mood_relaxed_path,
            output="model/Softmax"
        )
        self.mood_sad_model = TensorflowPredict2D(
            graphFilename=mood_sad_path,
            output="model/Softmax"
        )
    
    def predict_moods(self, file_path):
        """
        Predict mood probabilities for an audio file.
        
        Args:
            file_path (str): Path to the audio file.
            
        Returns:
            dict: Dictionary with probabilities for each mood category.
        """
        try:
            # Load audio at 16 kHz with resampleQuality=4
            audio = MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)()
        except Exception as e:
            print(f"Failed to load {file_path}: {e}")
            return None

        try:
            # Compute embeddings using the Discogs EfficientNet model
            embeddings = self.embedding_model(audio)
        except Exception as e:
            print(f"Error computing embeddings for {file_path}: {e}")
            return None

        moods = {}
        try:
            # Compute predictions for each mood
            pred_aggressive = self.mood_aggressive_model(embeddings)
            pred_happy      = self.mood_happy_model(embeddings)
            pred_party      = self.mood_party_model(embeddings)
            pred_relaxed    = self.mood_relaxed_model(embeddings)
            pred_sad        = self.mood_sad_model(embeddings)
            
            # Helper function: if the prediction is segmented, average over segments
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
    
    def process_audio_files(self, data_dir, results_csv):
        """
        Process all MP3 files in a directory and save mood predictions to CSV.
        
        Args:
            data_dir (str): Directory containing MP3 files.
            results_csv (str): Path to save the CSV results.
        """
        audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
        if not audio_files:
            print(f"No MP3 files found in {data_dir}")
            return

        results = []
        for file_name in tqdm(audio_files, desc="Predicting Mood"):
            file_path = os.path.join(data_dir, file_name)
            mood_predictions = self.predict_moods(file_path)
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
"""
MTG-Jamendo Mood and Theme Classification Module

This module classifies tracks into 56 different mood/theme categories using 
MTG-Jamendo models. It provides detailed emotional and thematic tags for music tracks.
"""

import os
import pandas as pd
import numpy as np
from tqdm import tqdm
from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D


class MoodThemeClassifier:
    """Class for classifying mood and theme in audio tracks."""
    
    # Class-level constants for the 56 mood/theme labels
    LABELS = [
        "action", "adventure", "advertising", "background", "ballad", "calm", "children", "christmas",
        "commercial", "cool", "corporate", "dark", "deep", "documentary", "drama", "dramatic", "dream",
        "emotional", "energetic", "epic", "fast", "film", "fun", "funny", "game", "groovy", "happy",
        "heavy", "holiday", "hopeful", "inspiring", "love", "meditative", "melancholic", "melodic",
        "motivational", "movie", "nature", "party", "positive", "powerful", "relaxing", "retro",
        "romantic", "sad", "sexy", "slow", "soft", "soundscape", "space", "sport", "summer", "trailer",
        "travel", "upbeat", "uplifting"
    ]
    
    def __init__(self, models_dir):
        """
        Initialize the mood/theme classifier with model paths.
        
        Args:
            models_dir (str): Path to the directory containing models.
        """
        # Model paths
        embedding_model_path = os.path.join(models_dir, "discogs-effnet-bs64-1.pb")
        mood_theme_model_path = os.path.join(models_dir, "mtg_jamendo_moodtheme-discogs-effnet-1.pb")
        
        # Load embedding model
        self.embedding_model = TensorflowPredictEffnetDiscogs(
            graphFilename=embedding_model_path,
            output="PartitionedCall:1"
        )
        
        # Load mood/theme model
        self.mood_theme_model = TensorflowPredict2D(
            graphFilename=mood_theme_model_path
        )
    
    def predict_mood_theme(self, file_path):
        """
        Predict mood and theme for an audio file.
        
        Args:
            file_path (str): Path to the audio file.
            
        Returns:
            dict: Dictionary with probabilities for each mood/theme label.
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

        try:
            # Predict mood and theme probabilities
            predictions = self.mood_theme_model(embeddings)
        except Exception as e:
            print(f"Error computing predictions for {file_path}: {e}")
            return None

        # Process predictions
        result = {"filename": os.path.basename(file_path)}
        try:
            if isinstance(predictions, np.ndarray):
                # Flatten predictions in case of multi-dimensional output
                predictions = predictions.flatten()
                for i, label in enumerate(self.LABELS):
                    # Map each probability to the corresponding label
                    result[label] = float(predictions[i]) if i < len(predictions) else None
            else:
                result["predictions"] = predictions
        except Exception as e:
            print(f"Error processing predictions for {file_path}: {e}")
            return None

        return result
    
    def process_audio_files(self, data_dir, results_csv):
        """
        Process all MP3 files in a directory and save mood/theme predictions to CSV.
        
        Args:
            data_dir (str): Directory containing MP3 files.
            results_csv (str): Path to save the CSV results.
        """
        audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
        if not audio_files:
            print(f"No MP3 files found in {data_dir}")
            return

        all_results = []
        for file_name in tqdm(audio_files, desc="Predicting Mood/Theme"):
            file_path = os.path.join(data_dir, file_name)
            prediction = self.predict_mood_theme(file_path)
            if prediction is not None:
                all_results.append(prediction)

        if all_results:
            df = pd.DataFrame(all_results)
            df.to_csv(results_csv, index=False)
            print(f"Processed {len(all_results)} files. Results saved to {results_csv}")
        else:
            print("No predictions computed.") 
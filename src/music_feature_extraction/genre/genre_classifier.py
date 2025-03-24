"""
Genre Classification Module

This module classifies music into genres based on the Discogs taxonomy.
It can identify up to 400 different genres/styles using pre-trained models.
"""

import os
import pandas as pd
from tqdm import tqdm
import numpy as np
from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D


class GenreClassifier:
    """Class for genre classification of audio tracks."""
    
    def __init__(self, models_dir):
        """
        Initialize the genre classifier with model paths.
        
        Args:
            models_dir (str): Path to the directory containing models.
        """
        # Model paths
        embedding_model_path = os.path.join(models_dir, "discogs-effnet-bs64-1.pb")
        genre_model_path = os.path.join(models_dir, "genre_discogs400-discogs-effnet-1.pb")
        
        # Load embedding model
        self.embedding_model = TensorflowPredictEffnetDiscogs(
            graphFilename=embedding_model_path, 
            output="PartitionedCall:1"
        )
        
        # Load genre model
        self.genre_model = TensorflowPredict2D(
            graphFilename=genre_model_path,
            input="serving_default_model_Placeholder",
            output="PartitionedCall:0"
        )
    
    def predict_genre(self, file_path):
        """
        Predict genres for an audio file and return the top 5 predictions.
        
        Args:
            file_path (str): Path to the audio file.
            
        Returns:
            tuple: (top5_indices, top5_probabilities) where each is a numpy array of length 5.
                  Returns None if prediction fails.
        """
        try:
            # Load audio at 16 kHz with resampleQuality=4
            audio = MonoLoader(filename=file_path, sampleRate=16000, resampleQuality=4)()
        except Exception as e:
            print(f"Failed to load {file_path}: {e}")
            return None

        try:
            # Compute embeddings for the audio
            embeddings = self.embedding_model(audio)
            # Compute genre predictions from embeddings
            predictions = self.genre_model(embeddings)
        except Exception as e:
            print(f"Error predicting genre for {file_path}: {e}")
            return None

        # If predictions have multiple segments, average them to get a single 400-dimensional vector
        if isinstance(predictions, np.ndarray):
            if predictions.ndim > 1:
                avg_predictions = predictions.mean(axis=0)
            else:
                avg_predictions = predictions

            # Get indices of top 5 predictions in descending order
            sorted_indices = np.argsort(avg_predictions)[::-1]
            top5_indices = sorted_indices[:5]
            top5_probs = avg_predictions[top5_indices]
        else:
            top5_indices = None
            top5_probs = None

        return top5_indices, top5_probs
    
    def process_audio_files(self, data_dir, results_csv):
        """
        Process all MP3 files in a directory and save genre predictions to CSV.
        
        Args:
            data_dir (str): Directory containing MP3 files.
            results_csv (str): Path to save the CSV results.
        """
        audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
        if not audio_files:
            print(f"No MP3 files found in {data_dir}")
            return

        results = []
        for file_name in tqdm(audio_files, desc="Predicting Genres"):
            file_path = os.path.join(data_dir, file_name)
            prediction = self.predict_genre(file_path)
            if prediction is not None:
                top5_indices, top5_probs = prediction
                # Convert arrays to comma-separated strings
                indices_str = ", ".join(map(str, top5_indices))
                probs_str = ", ".join(map(lambda x: f"{x:.4f}", top5_probs))
                results.append({
                    "filename": file_name,
                    "top_genre_indices": indices_str,
                    "top_genre_probabilities": probs_str
                })

        if results:
            df = pd.DataFrame(results)
            df.to_csv(results_csv, index=False)
            print(f"Processed {len(results)} files. Results saved to {results_csv}")
        else:
            print("No predictions computed.") 
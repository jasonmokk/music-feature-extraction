"""
MTG-Jamendo Instrument Detection Module

This module detects instruments in audio tracks using MTG-Jamendo models.
It can identify up to 40 different instruments present in the audio.
"""

import os
import pandas as pd
import numpy as np
from tqdm import tqdm
from essentia.standard import MonoLoader, TensorflowPredictEffnetDiscogs, TensorflowPredict2D


class InstrumentDetector:
    """Class for detecting instruments in audio tracks."""
    
    # Class-level constant
    LABELS = [
        "accordion", "acousticbassguitar", "acousticguitar", "bass", "beat", "bell", "bongo", "brass", "cello",
        "clarinet", "classicalguitar", "computer", "doublebass", "drummachine", "drums", "electricguitar",
        "electricpiano", "flute", "guitar", "harmonica", "harp", "horn", "keyboard", "oboe", "orchestra", "organ",
        "pad", "percussion", "piano", "pipeorgan", "rhodes", "sampler", "saxophone", "strings", "synthesizer",
        "trombone", "trumpet", "viola", "violin", "voice"
    ]
    
    def __init__(self, models_dir):
        """
        Initialize the instrument detector with model paths.
        
        Args:
            models_dir (str): Path to the directory containing models.
        """
        # Model paths
        embedding_model_path = os.path.join(models_dir, "discogs-effnet-bs64-1.pb")
        instrument_model_path = os.path.join(models_dir, "mtg_jamendo_instrument-discogs-effnet-1.pb")
        
        # Load embedding model
        self.embedding_model = TensorflowPredictEffnetDiscogs(
            graphFilename=embedding_model_path,
            output="PartitionedCall:1"
        )
        
        # Load instrument detection model
        self.instrument_model = TensorflowPredict2D(
            graphFilename=instrument_model_path
        )
    
    def detect_instruments(self, file_path):
        """
        Detect instruments in an audio file.
        
        Args:
            file_path (str): Path to the audio file.
            
        Returns:
            dict: Dictionary with probabilities for each instrument.
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
            # Predict instrument probabilities
            predictions = self.instrument_model(embeddings)
        except Exception as e:
            print(f"Error computing predictions for {file_path}: {e}")
            return None

        # Process predictions
        result = {"filename": os.path.basename(file_path)}
        try:
            if isinstance(predictions, np.ndarray):
                predictions = predictions.flatten()
                for i, label in enumerate(self.LABELS):
                    result[label] = float(predictions[i]) if i < len(predictions) else None
            else:
                result["predictions"] = predictions
        except Exception as e:
            print(f"Error processing predictions for {file_path}: {e}")
            return None

        return result
    
    def process_audio_files(self, data_dir, results_csv):
        """
        Process all MP3 files in a directory and save instrument predictions to CSV.
        
        Args:
            data_dir (str): Directory containing MP3 files.
            results_csv (str): Path to save the CSV results.
        """
        audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
        if not audio_files:
            print(f"No MP3 files found in {data_dir}")
            return

        all_results = []
        for file_name in tqdm(audio_files, desc="Detecting Instruments"):
            file_path = os.path.join(data_dir, file_name)
            prediction = self.detect_instruments(file_path)
            if prediction is not None:
                all_results.append(prediction)

        if all_results:
            df = pd.DataFrame(all_results)
            df.to_csv(results_csv, index=False)
            print(f"Processed {len(all_results)} files. Results saved to {results_csv}")
        else:
            print("No predictions computed.") 
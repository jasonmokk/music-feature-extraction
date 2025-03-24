#!/usr/bin/env python3
"""
Entry point script for mood classification.
Classifies audio files by mood (aggressive, happy, party, relaxed, sad).
"""
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.music_feature_extraction.mood.mood_classifier import MoodClassifier
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir, get_models_dir
from src.music_feature_extraction.utils.config import MOOD_CSV


def main():
    """Classify mood in audio files from the data directory."""
    data_dir = get_data_dir()
    results_dir = get_results_dir()
    models_dir = get_models_dir()
    output_path = os.path.join(results_dir, MOOD_CSV)
    
    print(f"Classifying mood in audio files from {data_dir}")
    mood_classifier = MoodClassifier(models_dir)
    mood_classifier.process_audio_files(data_dir, output_path)


if __name__ == "__main__":
    main() 
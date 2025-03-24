#!/usr/bin/env python3
"""
Entry point script for mood and theme classification.
Classifies audio files into 56 different mood/theme categories.
"""
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.music_feature_extraction.mood.mood_theme_classifier import MoodThemeClassifier
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir, get_models_dir
from src.music_feature_extraction.utils.config import MOOD_THEME_CSV


def main():
    """Classify mood and theme in audio files from the data directory."""
    data_dir = get_data_dir()
    results_dir = get_results_dir()
    models_dir = get_models_dir()
    output_path = os.path.join(results_dir, MOOD_THEME_CSV)
    
    print(f"Classifying mood and theme in audio files from {data_dir}")
    mood_theme_classifier = MoodThemeClassifier(models_dir)
    mood_theme_classifier.process_audio_files(data_dir, output_path)


if __name__ == "__main__":
    main() 
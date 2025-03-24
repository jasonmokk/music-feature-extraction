#!/usr/bin/env python3
"""
Entry point script for genre classification.
Classifies audio files into genres using the Discogs taxonomy.
"""
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.music_feature_extraction.genre.genre_classifier import GenreClassifier
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir, get_models_dir
from src.music_feature_extraction.utils.config import GENRE_CSV


def main():
    """Classify genres in audio files from the data directory."""
    data_dir = get_data_dir()
    results_dir = get_results_dir()
    models_dir = get_models_dir()
    output_path = os.path.join(results_dir, GENRE_CSV)
    
    print(f"Classifying genres in audio files from {data_dir}")
    genre_classifier = GenreClassifier(models_dir)
    genre_classifier.process_audio_files(data_dir, output_path)


if __name__ == "__main__":
    main() 
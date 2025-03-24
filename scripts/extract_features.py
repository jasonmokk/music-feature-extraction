#!/usr/bin/env python3
"""
Entry point script for basic feature extraction.
Extracts core musical features from audio files.
"""
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.music_feature_extraction.core.features import extract_features, process_all_files
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir
from src.music_feature_extraction.utils.config import FEATURE_CSV


def main():
    """Extract basic features from audio files in the data directory."""
    data_dir = get_data_dir()
    results_dir = get_results_dir()
    output_path = os.path.join(results_dir, FEATURE_CSV)
    
    print(f"Extracting features from audio files in {data_dir}")
    process_all_files(data_dir, output_path)


if __name__ == "__main__":
    main() 
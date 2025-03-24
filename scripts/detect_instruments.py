#!/usr/bin/env python3
"""
Entry point script for instrument detection.
Detects up to 40 different instruments in audio files.
"""
import os
import sys

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.music_feature_extraction.instrument.instrument_detector import InstrumentDetector
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir, get_models_dir
from src.music_feature_extraction.utils.config import INSTRUMENT_CSV


def main():
    """Detect instruments in audio files from the data directory."""
    data_dir = get_data_dir()
    results_dir = get_results_dir()
    models_dir = get_models_dir()
    output_path = os.path.join(results_dir, INSTRUMENT_CSV)
    
    print(f"Detecting instruments in audio files from {data_dir}")
    instrument_detector = InstrumentDetector(models_dir)
    instrument_detector.process_audio_files(data_dir, output_path)


if __name__ == "__main__":
    main() 
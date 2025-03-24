#!/usr/bin/env python3
"""
Complete Music Feature Extraction Pipeline

This script runs the entire feature extraction and classification pipeline in one go.
It sequentially processes audio files to extract:
1. Core features (tempo, key, energy, etc.)
2. Low-level features via MusicExtractor
3. Mood classifications
4. Genre classifications
5. Instrument detections
6. Mood/theme classifications

All results are saved to separate CSV files in the results directory.
"""
import os
import sys
import argparse
import time
from tqdm import tqdm

# Add the src directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import all components
from src.music_feature_extraction.core.features import process_all_files as process_features
from src.music_feature_extraction.core.low_level import process_all_files as process_low_level
from src.music_feature_extraction.mood.mood_classifier import MoodClassifier
from src.music_feature_extraction.mood.mood_theme_classifier import MoodThemeClassifier
from src.music_feature_extraction.genre.genre_classifier import GenreClassifier
from src.music_feature_extraction.instrument.instrument_detector import InstrumentDetector
from src.music_feature_extraction.utils.paths import get_data_dir, get_results_dir, get_models_dir
from src.music_feature_extraction.utils.config import (
    FEATURE_CSV,
    LOW_LEVEL_CSV,
    MOOD_CSV,
    MOOD_THEME_CSV,
    GENRE_CSV,
    INSTRUMENT_CSV
)


def run_pipeline(run_features=True, run_low_level=True, run_mood=True, 
                 run_genre=True, run_instruments=True, run_mood_theme=True,
                 data_dir=None, results_dir=None, models_dir=None):
    """
    Run the complete music feature extraction pipeline.
    
    Args:
        run_features (bool): Whether to run core feature extraction
        run_low_level (bool): Whether to run low-level feature extraction
        run_mood (bool): Whether to run mood classification
        run_genre (bool): Whether to run genre classification
        run_instruments (bool): Whether to run instrument detection
        run_mood_theme (bool): Whether to run mood/theme classification
        data_dir (str): Directory containing audio files (default: auto-detect)
        results_dir (str): Directory to save results (default: auto-detect)
        models_dir (str): Directory containing models (default: auto-detect)
    """
    # Use default directories if not specified
    if data_dir is None:
        data_dir = get_data_dir()
    if results_dir is None:
        results_dir = get_results_dir()
    if models_dir is None:
        models_dir = get_models_dir()
    
    print("\n========== MUSIC FEATURE EXTRACTION PIPELINE ==========")
    print(f"Data directory: {data_dir}")
    print(f"Results directory: {results_dir}")
    print(f"Models directory: {models_dir}")
    print("=======================================================\n")
    
    # Track overall start time
    total_start_time = time.time()
    
    # Step 1: Basic feature extraction
    if run_features:
        print("\n🎵 STEP 1: Extracting basic audio features...")
        output_path = os.path.join(results_dir, FEATURE_CSV)
        start_time = time.time()
        process_features(data_dir, output_path)
        print(f"✓ Basic features saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Step 2: Low-level feature extraction
    if run_low_level:
        print("\n🔍 STEP 2: Extracting low-level audio features...")
        output_path = os.path.join(results_dir, LOW_LEVEL_CSV)
        start_time = time.time()
        process_low_level(data_dir, output_path)
        print(f"✓ Low-level features saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Step 3: Mood classification
    if run_mood:
        print("\n😊 STEP 3: Classifying moods (happy, sad, aggressive, relaxed, party)...")
        output_path = os.path.join(results_dir, MOOD_CSV)
        start_time = time.time()
        mood_classifier = MoodClassifier(models_dir)
        mood_classifier.process_audio_files(data_dir, output_path)
        print(f"✓ Mood classifications saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Step 4: Genre classification
    if run_genre:
        print("\n🎸 STEP 4: Classifying genres...")
        output_path = os.path.join(results_dir, GENRE_CSV)
        start_time = time.time()
        genre_classifier = GenreClassifier(models_dir)
        genre_classifier.process_audio_files(data_dir, output_path)
        print(f"✓ Genre classifications saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Step 5: Instrument detection
    if run_instruments:
        print("\n🎺 STEP 5: Detecting instruments...")
        output_path = os.path.join(results_dir, INSTRUMENT_CSV)
        start_time = time.time()
        instrument_detector = InstrumentDetector(models_dir)
        instrument_detector.process_audio_files(data_dir, output_path)
        print(f"✓ Instrument detections saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Step 6: Mood/theme classification
    if run_mood_theme:
        print("\n🎭 STEP 6: Classifying mood themes...")
        output_path = os.path.join(results_dir, MOOD_THEME_CSV)
        start_time = time.time()
        mood_theme_classifier = MoodThemeClassifier(models_dir)
        mood_theme_classifier.process_audio_files(data_dir, output_path)
        print(f"✓ Mood/theme classifications saved to {output_path}")
        print(f"  Time taken: {time.time() - start_time:.2f} seconds")
    
    # Report total time
    total_time = time.time() - total_start_time
    print(f"\n✅ Pipeline complete! Total time: {total_time:.2f} seconds ({total_time/60:.2f} minutes)")


def main():
    """Parse command line arguments and run the pipeline."""
    parser = argparse.ArgumentParser(
        description="Run the complete music feature extraction pipeline."
    )
    
    # Analysis selection options
    parser.add_argument("--all", action="store_true", help="Run all analyses (default)")
    parser.add_argument("--features", action="store_true", help="Run only basic feature extraction")
    parser.add_argument("--low-level", action="store_true", help="Run only low-level feature extraction")
    parser.add_argument("--mood", action="store_true", help="Run only mood classification")
    parser.add_argument("--genre", action="store_true", help="Run only genre classification")
    parser.add_argument("--instruments", action="store_true", help="Run only instrument detection")
    parser.add_argument("--mood-theme", action="store_true", help="Run only mood/theme classification")
    
    # Path options
    parser.add_argument("--data-dir", help="Directory containing audio files")
    parser.add_argument("--results-dir", help="Directory to save results")
    parser.add_argument("--models-dir", help="Directory containing models")
    
    args = parser.parse_args()
    
    # Determine which analyses to run
    # If specific analyses are selected, run only those
    # If --all or no specific analyses are selected, run everything
    specified_analyses = args.features or args.low_level or args.mood or args.genre or args.instruments or args.mood_theme
    
    if specified_analyses:
        run_features = args.features
        run_low_level = args.low_level
        run_mood = args.mood
        run_genre = args.genre
        run_instruments = args.instruments
        run_mood_theme = args.mood_theme
    else:
        # Default: run everything
        run_features = True
        run_low_level = True
        run_mood = True
        run_genre = True
        run_instruments = True
        run_mood_theme = True
    
    run_pipeline(
        run_features=run_features,
        run_low_level=run_low_level,
        run_mood=run_mood,
        run_genre=run_genre,
        run_instruments=run_instruments,
        run_mood_theme=run_mood_theme,
        data_dir=args.data_dir,
        results_dir=args.results_dir,
        models_dir=args.models_dir
    )


if __name__ == "__main__":
    main() 
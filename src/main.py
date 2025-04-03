#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Main entry point for the Music Feature Extraction application.
This file serves as a bridge between the web interface and the backend classifiers.
"""

import os
import sys
from pathlib import Path

# Import classifiers
from classifiers.mood_theme_classifier import MoodThemeClassifier
from classifiers.instrument_detector import InstrumentDetector
from utils.paths import get_models_path

def load_classifiers():
    """
    Load the mood theme and instrument classifiers
    """
    models_path = get_models_path()
    
    mood_theme_model = os.path.join(models_path, "mtg_jamendo_moodtheme-discogs-effnet-1.pb")
    instrument_model = os.path.join(models_path, "mtg_jamendo_instrument-discogs-effnet-1.pb")
    
    mood_theme_classifier = MoodThemeClassifier(model_path=mood_theme_model)
    instrument_detector = InstrumentDetector(model_path=instrument_model)
    
    return mood_theme_classifier, instrument_detector

def process_audio(audio_path):
    """
    Process an audio file and extract features
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        Dict containing the extracted features
    """
    mood_theme_classifier, instrument_detector = load_classifiers()
    
    mood_results = mood_theme_classifier.predict(audio_path)
    instrument_results = instrument_detector.predict(audio_path)
    
    return {
        "mood_themes": mood_results,
        "instruments": instrument_results
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
        if os.path.exists(audio_path):
            results = process_audio(audio_path)
            print(results)
        else:
            print(f"File not found: {audio_path}")
    else:
        print("Please provide an audio file path") 
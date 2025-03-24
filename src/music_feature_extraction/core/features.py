"""
Core feature extraction module for analyzing musical creativity and mood in audio.
Extracts key audio features using Essentia library.
"""
import os
import pandas as pd
from tqdm import tqdm
from essentia.standard import (
    MonoLoader,
    RhythmExtractor2013,
    KeyExtractor,
    Danceability,
    Loudness,
    Energy,
    Duration,
    DynamicComplexity,
    LowLevelSpectralEqloudExtractor,
    LowLevelSpectralExtractor
)
import numpy as np


def extract_features(file_path):
    """Extracts musical features from audio files with error handling.
    
    Args:
        file_path: Path to audio file (supports MP3, WAV, etc.)
        
    Returns:
        Dictionary of features or None if a fatal error occurs.
    """
    features = {"filename": os.path.basename(file_path)}
    
    try:
        # Load audio as mono channel at 44.1kHz for consistent analysis.
        loader = MonoLoader(filename=file_path, sampleRate=44100)
        audio = loader()
    except Exception as e:
        print(f"Failed to load {file_path}: {e}")
        return None

    # --------------------------
    # CORE FEATURE EXTRACTION
    # --------------------------
    
    # Duration (seconds)
    try:
        features['duration'] = Duration()(audio)
    except Exception as e:
        features['duration'] = None  

    # Tempo (BPM)
    try:
        # Using RhythmExtractor2013 algorithm (Brossier's method)
        tempo, *_ = RhythmExtractor2013()(audio)
        features['tempo'] = tempo
    except Exception as e:
        features['tempo'] = None  

    # Tonality (Key/Scale)
    try:
        key, scale, _ = KeyExtractor()(audio)
        features['key'] = key    # Musical key (C, D, etc.)
        features['scale'] = scale  # Major/minor tonality
    except Exception as e:
        features['key'] = None
        features['scale'] = None

    # Danceability (0-1)
    try:
        features['danceability'] = Danceability()(audio)[0]
    except Exception as e:
        features['danceability'] = None

    # Loudness (LUFS)
    try:
        features['loudness'] = Loudness()(audio)
    except Exception as e:
        features['loudness'] = None

    # Energy (RMS-based)
    try:
        features['energy'] = Energy()(audio)
    except Exception as e:
        features['energy'] = None

    # Dynamic Complexity (energy fluctuation, mood shifts)
    try:
        dyn_complex = DynamicComplexity()(audio)
        features['dynamic_complexity'] = dyn_complex[0]
    except Exception as e:
        features['dynamic_complexity'] = None

    # Dissonance - using LowLevelSpectralEqloudExtractor to compute it
    try:
        eqloud_extractor = LowLevelSpectralEqloudExtractor(frameSize=2048, hopSize=1024, sampleRate=44100)
        eqloud_out = eqloud_extractor(audio)
        dissonance_vals = eqloud_out[0]
        if dissonance_vals is not None and len(dissonance_vals) > 0:
            # If it's a NumPy array, use its mean method.
            if isinstance(dissonance_vals, np.ndarray):
                features['dissonance'] = float(dissonance_vals.mean())
            else:
                features['dissonance'] = sum(dissonance_vals) / len(dissonance_vals)
        else:
            features['dissonance'] = None
    except Exception as e:
        print(f"Error computing dissonance via LowLevelSpectralEqloudExtractor for {file_path}: {e}")
        features['dissonance'] = None

    # Use LowLevelSpectralExtractor to compute inharmonicity, tristimulus, and oddToEvenHarmonicRatio
    try:
        spectral_extractor = LowLevelSpectralExtractor(frameSize=2048, hopSize=1024, sampleRate=44100)
        spectral_out = spectral_extractor(audio)
        # Extract outputs by index:
        inharmonicity_vals = spectral_out[26]
        tristimulus_vals = spectral_out[27]
        odd_even_vals    = spectral_out[28]
        
        # Inharmonicity
        if inharmonicity_vals is not None and len(inharmonicity_vals) > 0:
            if isinstance(inharmonicity_vals, np.ndarray):
                features['inharmonicity'] = float(inharmonicity_vals.mean())
            else:
                features['inharmonicity'] = sum(inharmonicity_vals) / len(inharmonicity_vals)
        else:
            features['inharmonicity'] = None

        # OddToEvenHarmonicRatio
        if odd_even_vals is not None and len(odd_even_vals) > 0:
            if isinstance(odd_even_vals, np.ndarray):
                features['oddToEvenHarmonicRatio'] = float(odd_even_vals.mean())
            else:
                features['oddToEvenHarmonicRatio'] = sum(odd_even_vals) / len(odd_even_vals)
        else:
            features['oddToEvenHarmonicRatio'] = None

        # Tristimulus: expected to be a list of vectors (each with at least 3 values)
        if tristimulus_vals is not None and len(tristimulus_vals) > 0:
            tristimulus_avg = [0.0, 0.0, 0.0]
            count = 0
            for vec in tristimulus_vals:
                # Ensure vec is a sequence and has at least 3 elements.
                if vec is not None and len(vec) >= 3:
                    tristimulus_avg[0] += vec[0]
                    tristimulus_avg[1] += vec[1]
                    tristimulus_avg[2] += vec[2]
                    count += 1
            if count > 0:
                tristimulus_avg = [x / count for x in tristimulus_avg]
                features['tristimulus'] = ", ".join(map(str, tristimulus_avg))
            else:
                features['tristimulus'] = None
        else:
            features['tristimulus'] = None
    except Exception as e:
        print(f"Error computing spectral features via LowLevelSpectralExtractor for {file_path}: {e}")
        features['inharmonicity'] = None
        features['tristimulus'] = None
        features['oddToEvenHarmonicRatio'] = None

    return features


def process_all_files(data_dir, results_csv):
    """Processes all audio files in the directory with progress tracking.
    
    Args:
        data_dir: Input directory with audio files.
        results_csv: Output path for CSV results.
    """
    # Filter only MP3 files
    audio_files = [f for f in os.listdir(data_dir) if f.lower().endswith(".mp3")]
    
    if not audio_files:
        print(f"No MP3 files found in {data_dir}")
        return

    all_features = []
    
    for file_name in tqdm(audio_files, desc="Analyzing Music"):
        file_path = os.path.join(data_dir, file_name)
        features = extract_features(file_path)
        if features:  # Only keep successful extractions
            all_features.append(features)

    if all_features:
        df = pd.DataFrame(all_features)
        df.to_csv(results_csv, index=False)
        print(f"\nSuccess: Processed {len(all_features)} files → {results_csv}")
    else:
        print("\nWarning: No features extracted. Check file formats/errors.") 
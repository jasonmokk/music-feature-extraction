"""
Configuration constants for the music feature extraction package.
"""

# Default audio formats supported
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a']

# Common sample rates
SAMPLE_RATE_HIGH = 44100  # Used for core feature extraction
SAMPLE_RATE_LOW = 16000   # Used for classification models

# Default frame sizes for spectral analysis
FRAME_SIZE = 2048
HOP_SIZE = 1024

# Default CSV output filenames
FEATURE_CSV = 'music_features.csv'
MOOD_CSV = 'mood_predictions.csv'
MOOD_THEME_CSV = 'mood_theme_predictions.csv'
GENRE_CSV = 'genre_predictions.csv'
INSTRUMENT_CSV = 'instrument_predictions.csv'
LOW_LEVEL_CSV = 'low_level_features.csv'

# Output verbosity
VERBOSE = True 
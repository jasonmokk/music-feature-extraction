"""
Path utility functions for the music feature extraction package.
Provides consistent path handling across the package.
"""

import os


def get_project_root():
    """
    Get the absolute path to the project root directory.
    
    Returns:
        str: Absolute path to the project root directory.
    """
    # The project root is 3 levels up from this file
    # src/music_feature_extraction/utils/paths.py -> project_root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, '..', '..', '..'))


def get_data_dir():
    """
    Get the absolute path to the data directory.
    
    Returns:
        str: Absolute path to the data directory.
    """
    return os.path.join(get_project_root(), 'data')


def get_models_dir():
    """
    Get the absolute path to the models directory.
    
    Returns:
        str: Absolute path to the models directory.
    """
    return os.path.join(get_project_root(), 'models')


def get_results_dir():
    """
    Get the absolute path to the results directory.
    Creates the directory if it doesn't exist.
    
    Returns:
        str: Absolute path to the results directory.
    """
    results_dir = os.path.join(get_project_root(), 'results')
    os.makedirs(results_dir, exist_ok=True)
    return results_dir


def ensure_dir_exists(directory):
    """
    Ensure that a directory exists, creating it if necessary.
    
    Args:
        directory (str): Path to the directory.
    
    Returns:
        str: Path to the directory.
    """
    os.makedirs(directory, exist_ok=True)
    return directory 
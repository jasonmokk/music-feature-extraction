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
    # The project root is 2 levels up from this file
    # src/utils/paths.py -> project_root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, '..', '..'))


def get_web_dir():
    """
    Get the absolute path to the web directory.
    
    Returns:
        str: Absolute path to the web directory.
    """
    return os.path.join(get_project_root(), 'web')


def get_models_path():
    """
    Get the absolute path to the models directory.
    
    Returns:
        str: Absolute path to the models directory.
    """
    return os.path.join(get_project_root(), 'models')


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
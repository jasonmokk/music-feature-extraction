"""
Setup script for the music-feature-extraction package.
"""
from setuptools import setup, find_packages
import os

# Read the contents of the README file
with open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()

# Get the version from src/music_feature_extraction/__init__.py
about = {}
with open(os.path.join("src", "music_feature_extraction", "__init__.py"), "r", encoding="utf-8") as f:
    exec(f.read(), about)

setup(
    name="music-feature-extraction",
    version=about["__version__"],
    description="A comprehensive toolkit for extracting musical features from audio files",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Your Name",
    author_email="your.email@example.com",
    url="https://github.com/your-username/music-feature-extraction",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.12",
    install_requires=[
        "essentia-tensorflow",
        "pandas",
        "tqdm",
        "numpy<2",
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.12",
    ],
    entry_points={
        "console_scripts": [
            "extract-features=scripts.extract_features:main",
            "extract-low-level=scripts.extract_low_level:main",
            "classify-mood=scripts.classify_mood:main",
            "classify-mood-theme=scripts.classify_mood_theme:main",
            "classify-genre=scripts.classify_genre:main",
            "detect-instruments=scripts.detect_instruments:main",
            "run-music-pipeline=scripts.run_pipeline:main",
        ],
    },
) 
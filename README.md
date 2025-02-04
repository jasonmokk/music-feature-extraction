# **Music Feature Extraction**

This repository houses the workflow for extracting audio features for music files, focusing on replicating Spotify-like attributes such as tempo, energy, loudness, and more. Currently provides scripts for using Librosa and Essentia, more to come soon.

---

## **Tools Used**
- **Librosa**: General-purpose music feature extraction.
- **Essentia**: Advanced high-level and low-level feature extraction.
- **Aubio**: Lightweight and efficient for tempo and beat detection.

---

## **Installation**

1. **Install Python 3.12**:
   If Python 3.12 is not installed, download and install it:
   - On macOS/Linux:
     ```bash
     brew install python@3.12
     ```
   - On Windows:
     Download the installer from [python.org](https://www.python.org/downloads/) and follow the instructions.

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/music-feature-extraction.git
   cd music-feature-extraction
   ```

3. **Create a Virtual Environment with Python 3.12**:
   - Create a virtual environment:
     ```bash
     python3.12 -m venv venv
     ```
   - Activate the environment:
     - On macOS/Linux:
       ```bash
       source venv/bin/activate
       ```
     - On Windows:
       ```cmd
       venv\Scripts\activate
       ```

4. **Install Dependencies**:
   - Install the necessary packages:
     ```bash
     pip install librosa essentia pandas tqdm "numpy<2"
     ```
---

## **Usage**

### **1. Add Audio Files**
Place your `.mp3` or `.wav` files in the `data/` directory.

### **2. Run Feature Extraction Scripts**
Each script corresponds to a specific tool. For example:
- **Librosa**:
  ```bash
  python scripts/extract_features_librosa.py
  ```
- **Essentia**:
  ```bash
  python scripts/extract_features_essentia.py
  ```
- **Aubio**:
  ```bash
  python scripts/extract_features_aubio.py
  ```
- **pyYAAFE**:
  ```bash
  python scripts/extract_features_pyyaafe.py
  ```

Extracted features will be saved as `.csv` files in the `results/` directory.

---

## **Spotify-Like Features Progress**
| **Feature**         | **Replicated** | **Tools Used**      |
|----------------------|----------------|---------------------|
| Tempo                | Yes            | Essentia, Librosa   |
| Energy               | Yes            | Essentia            |
| Loudness             | Yes            | Essentia            |
| Danceability         | Yes            | Essentia            |
| Key                  | Yes            | Essentia            |
| Mode                 | Yes            | Essentia            |
| Duration             | Yes            | Essentia            |
| Valence              | No             | -                   |
| Speechiness          | No             | -                   |
| Instrumentalness     | No             | -                   |
| Acousticness         | No             | -                   |
| Liveness             | No             | -                   |

---


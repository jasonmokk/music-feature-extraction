# **Music Feature Extraction Repository**

This repository is designed to extract audio features for music files, focusing on replicating Spotify-like attributes such as tempo, energy, loudness, and more. It provides scripts for using various tools like Librosa, Essentia, Aubio, and pyYAAFE, enabling detailed music analysis.

---

## **Project Structure**

```
music-feature-extraction/
├── data/             # Input directory for audio files (e.g., .mp3, .wav)
├── scripts/          # Python scripts for feature extraction
├── results/          # Output directory for extracted features (e.g., .csv)
├── notebooks/        # Jupyter notebooks for analysis and exploration
└── README.md         # Documentation for the project
```

---

## **Tools Used**
- **Librosa**: General-purpose music feature extraction.
- **Essentia**: Advanced high-level and low-level feature extraction.
- **Aubio**: Lightweight and efficient for tempo and beat detection.
- **pyYAAFE**: Focused on low-level features like MFCCs and ZCR.

---

## **Installation**

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/music-feature-extraction.git
   cd music-feature-extraction
   ```

2. **Set Up the Environment**:
   - Create a virtual environment:
     ```bash
     python3 -m venv venv
     source venv/bin/activate  # Activate the environment
     ```
   - Install dependencies:
     ```bash
     pip install -r requirements.txt
     ```

3. **Install Tool-Specific Dependencies**:
   - **Essentia**:
     ```bash
     pip install essentia
     ```
   - **Aubio**:
     ```bash
     brew install aubio
     pip install aubio
     ```
   - **pyYAAFE**:
     ```bash
     pip install yaafelib
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

### **3. Analyze Results**
Open the Jupyter notebooks in the `notebooks/` directory to analyze and compare the extracted features.

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

## **Contributing**
If you’d like to contribute, please fork the repository and submit a pull request. Suggestions for improving scripts or adding support for more features are always welcome!

---

## **License**
This project is licensed under the MIT License.

---

## **Contact**
For any questions or support, please reach out to [your email or GitHub profile].

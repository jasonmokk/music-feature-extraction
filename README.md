# **Music Feature Extraction**

This repository houses the workflow for extracting audio features for music files, focusing on replicating Spotify-like attributes such as tempo, energy, loudness, and more. Currently provides scripts for using Librosa and Essentia, more to come soon.

---

## **Project Structure**

```
music-feature-extraction/
├── data/             # Input directory for audio mp3 files 
├── scripts/          # Python scripts for feature extraction
├── results/          # Output directory for extracted features (e.g., .csv)
└── README.md         # Documentation for the project
```

---

## **Tools Used**
- **Librosa**: General-purpose music feature extraction.
- **Essentia**: Advanced high-level and low-level feature extraction.
- **Aubio**: Lightweight and efficient for tempo and beat detection.

---

## **Installation**

1. **Clone the Repository (or a fork)**:
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

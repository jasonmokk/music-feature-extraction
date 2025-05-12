# Music Analysis Pipeline

A web application for extracting features from music files, including mood analysis, danceability, BPM, and key detection.

## Features

- Upload individual files or entire folders of music
- Batch processing of multiple audio files
- Analyzes mood (happy, sad, relaxed, aggressive)
- Detects audio metrics (danceability, BPM, key)
- Download results as CSV

## Deployment to Vercel

### Prerequisites

- [Vercel CLI](https://vercel.com/download)
- [Node.js](https://nodejs.org/en/) (version 16 or later)
- A Vercel account

### Steps to Deploy

1. **Install Vercel CLI**:
   ```
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```
   vercel login
   ```

3. **Deploy to Vercel**:
   ```
   vercel
   ```

4. **For production deployment**:
   ```
   vercel --prod
   ```

## Local Development

1. **Install dependencies**:
   ```
   npm install
   ```

2. **Start local server**:
   ```
   npm start
   ```

3. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Technical Information

The application uses:
- Web Audio API for audio processing
- Essentia.js for audio feature extraction
- TensorFlow.js for machine learning inference
- Web Workers for parallel processing

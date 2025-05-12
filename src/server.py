#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Server module for the Music Feature Extraction application.
This file serves as a bridge between the web interface and the backend classifiers.
"""

import os
import json
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from main import process_audio
from utils.paths import get_web_dir

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Temporary directory for uploaded files
UPLOAD_FOLDER = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Limit uploads to 16MB

# Allowed file extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'flac'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/analyze', methods=['POST'])
def analyze_audio():
    """Handle audio analysis requests from the web interface"""
    # Check if the post request has the file part
    if 'audio' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['audio']
    
    # If user does not select file, browser also submits an empty part without filename
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            # Process the audio file
            results = process_audio(filepath)
            
            # Remove the temporary file
            os.remove(filepath)
            
            return jsonify(results)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_web(path):
    """Serve the web interface"""
    web_dir = get_web_dir()
    if path == '' or not os.path.exists(os.path.join(web_dir, path)):
        path = 'index.html'
    return send_from_directory(web_dir, path)

if __name__ == '__main__':
    print(f"Temporary upload directory: {UPLOAD_FOLDER}")
    app.run(debug=True, port=5000) 
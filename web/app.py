"""
Music Feature Extraction Web Interface

This web application provides a user-friendly interface for the music feature extraction pipeline.
Users can upload MP3 files, run analysis, and visualize the results.
"""
import os
import sys
import uuid
import json
import pandas as pd
import plotly
import plotly.express as px
import plotly.graph_objects as go
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import pipeline functionality
from src.music_feature_extraction.core.features import extract_features
from src.music_feature_extraction.mood.mood_classifier import MoodClassifier
from src.music_feature_extraction.genre.genre_classifier import GenreClassifier
from src.music_feature_extraction.instrument.instrument_detector import InstrumentDetector
from src.music_feature_extraction.mood.mood_theme_classifier import MoodThemeClassifier
from src.music_feature_extraction.utils.paths import get_models_dir

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
app.config['RESULTS_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'results')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload size
app.config['ALLOWED_EXTENSIONS'] = {'mp3', 'wav'}

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)

# Initialize classifiers globally to avoid reload overhead
models_dir = get_models_dir()
mood_classifier = MoodClassifier(models_dir)
genre_classifier = GenreClassifier(models_dir)
instrument_detector = InstrumentDetector(models_dir)
mood_theme_classifier = MoodThemeClassifier(models_dir)

def allowed_file(filename):
    """Check if the uploaded file is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file uploads and initial processing."""
    # Check if any file was submitted
    if 'file' not in request.files:
        flash('No file part')
        return redirect(request.url)
    
    file = request.files['file']
    
    # Check if user submitted an empty form
    if file.filename == '':
        flash('No file selected')
        return redirect(request.url)
    
    # Process valid file
    if file and allowed_file(file.filename):
        # Generate a unique ID for this analysis
        analysis_id = str(uuid.uuid4())
        
        # Create directory for this analysis
        analysis_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
        os.makedirs(analysis_dir, exist_ok=True)
        
        # Secure the filename and save the file
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Return the analysis ID for AJAX polling
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'analysis_id': analysis_id,
            'filename': filename,
            'file_path': file_path
        })
    
    flash('Invalid file type. Please upload MP3 or WAV files.')
    return redirect(request.url)

@app.route('/analyze/<analysis_id>/<filename>', methods=['POST'])
def analyze_file(analysis_id, filename):
    """Run the analysis pipeline on the uploaded file."""
    try:
        # File paths
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
        result_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
        
        # Extract basic features
        basic_features = extract_features(file_path)
        
        # Save basic features to JSON
        with open(os.path.join(result_dir, 'basic_features.json'), 'w') as f:
            # Filter out non-serializable values
            serializable_features = {k: v for k, v in basic_features.items() if isinstance(v, (int, float, str, bool, type(None)))}
            json.dump(serializable_features, f, indent=2)
        
        # Extract mood
        mood_results = mood_classifier.predict_moods(file_path)
        with open(os.path.join(result_dir, 'mood.json'), 'w') as f:
            json.dump(mood_results, f, indent=2)
        
        # Extract genre (top 5)
        genre_results = genre_classifier.predict_genre(file_path)
        if genre_results is not None:
            top_indices, top_probs = genre_results
            genre_data = {
                'top_indices': top_indices.tolist() if hasattr(top_indices, 'tolist') else list(top_indices),
                'top_probabilities': top_probs.tolist() if hasattr(top_probs, 'tolist') else list(top_probs)
            }
            with open(os.path.join(result_dir, 'genre.json'), 'w') as f:
                json.dump(genre_data, f, indent=2)
        
        # Extract instruments
        instrument_results = instrument_detector.detect_instruments(file_path)
        with open(os.path.join(result_dir, 'instruments.json'), 'w') as f:
            json.dump(instrument_results, f, indent=2)
        
        # Extract mood themes
        mood_theme_results = mood_theme_classifier.predict_mood_theme(file_path)
        with open(os.path.join(result_dir, 'mood_theme.json'), 'w') as f:
            json.dump(mood_theme_results, f, indent=2)
        
        # Generate visualizations
        generate_visualizations(analysis_id, result_dir)
        
        return jsonify({
            'success': True,
            'message': 'Analysis completed successfully',
            'analysis_id': analysis_id
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f"Error during analysis: {str(e)}"
        })

def generate_visualizations(analysis_id, result_dir):
    """Generate visualizations for the analysis results."""
    try:
        # 1. Mood radar chart
        with open(os.path.join(result_dir, 'mood.json'), 'r') as f:
            mood_data = json.load(f)
        
        # Remove filename from data
        mood_categories = []
        mood_values = []
        for key, value in mood_data.items():
            if key != 'filename' and value is not None:
                mood_categories.append(key.replace('mood_', '').capitalize())
                mood_values.append(value)
        
        # Create radar chart for moods
        fig = go.Figure()
        fig.add_trace(go.Scatterpolar(
            r=mood_values,
            theta=mood_categories,
            fill='toself',
            name='Mood'
        ))
        fig.update_layout(
            polar=dict(
                radialaxis=dict(
                    visible=True,
                    range=[0, 1]
                )
            ),
            title="Mood Analysis"
        )
        mood_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(result_dir, 'mood_chart.json'), 'w') as f:
            f.write(mood_json)
        
        # 2. Instrument bar chart
        with open(os.path.join(result_dir, 'instruments.json'), 'r') as f:
            instrument_data = json.load(f)
        
        # Filter top 10 instruments by probability
        instruments = {}
        for key, value in instrument_data.items():
            if key != 'filename' and value is not None and isinstance(value, (int, float)):
                instruments[key] = value
        
        # Sort and get top 10
        top_instruments = sorted(instruments.items(), key=lambda x: x[1], reverse=True)[:10]
        inst_names = [i[0].capitalize() for i in top_instruments]
        inst_values = [i[1] for i in top_instruments]
        
        # Create bar chart
        fig = go.Figure(go.Bar(
            x=inst_names,
            y=inst_values,
            marker_color='rgb(55, 83, 109)'
        ))
        fig.update_layout(
            title="Top 10 Detected Instruments",
            xaxis_title="Instrument",
            yaxis_title="Probability",
            yaxis=dict(range=[0, 1])
        )
        instrument_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(result_dir, 'instrument_chart.json'), 'w') as f:
            f.write(instrument_json)
        
        # 3. Mood theme visualization
        with open(os.path.join(result_dir, 'mood_theme.json'), 'r') as f:
            mood_theme_data = json.load(f)
        
        # Filter to get top 10 themes
        themes = {}
        for key, value in mood_theme_data.items():
            if key != 'filename' and value is not None and isinstance(value, (int, float)):
                themes[key] = value
        
        top_themes = sorted(themes.items(), key=lambda x: x[1], reverse=True)[:10]
        theme_names = [t[0].capitalize() for t in top_themes]
        theme_values = [t[1] for t in top_themes]
        
        # Create horizontal bar chart
        fig = go.Figure(go.Bar(
            y=theme_names,
            x=theme_values,
            orientation='h',
            marker_color='rgb(26, 118, 255)'
        ))
        fig.update_layout(
            title="Top 10 Mood/Theme Classifications",
            xaxis_title="Probability",
            yaxis_title="Theme",
            xaxis=dict(range=[0, 1])
        )
        theme_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(result_dir, 'theme_chart.json'), 'w') as f:
            f.write(theme_json)
            
    except Exception as e:
        print(f"Error generating visualizations: {e}")

@app.route('/results/<analysis_id>')
def show_results(analysis_id):
    """Show analysis results page."""
    result_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
    
    # Check if analysis exists
    if not os.path.exists(result_dir):
        flash('Analysis not found')
        return redirect(url_for('index'))
    
    # Load all the data
    feature_data = None
    if os.path.exists(os.path.join(result_dir, 'basic_features.json')):
        with open(os.path.join(result_dir, 'basic_features.json'), 'r') as f:
            feature_data = json.load(f)
    
    # Get all available chart files
    chart_files = {}
    for chart_type in ['mood_chart', 'instrument_chart', 'theme_chart']:
        chart_path = os.path.join(result_dir, f'{chart_type}.json')
        if os.path.exists(chart_path):
            with open(chart_path, 'r') as f:
                chart_files[chart_type] = f.read()
    
    return render_template(
        'results.html',
        analysis_id=analysis_id,
        feature_data=feature_data,
        chart_files=chart_files
    )

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files."""
    return send_from_directory(app.static_folder, filename)

if __name__ == '__main__':
    app.run(debug=True) 
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
from collections import defaultdict, Counter

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
app.config['BATCH_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'batch_results')
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB max upload size
app.config['ALLOWED_EXTENSIONS'] = {'mp3', 'wav'}

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)
os.makedirs(app.config['BATCH_FOLDER'], exist_ok=True)

# Initialize classifiers globally to avoid reload overhead
models_dir = get_models_dir()
mood_classifier = MoodClassifier(models_dir)
genre_classifier = GenreClassifier(models_dir)
instrument_detector = InstrumentDetector(models_dir)
mood_theme_classifier = MoodThemeClassifier(models_dir)

# In-memory storage for batch tracking
batch_registry = {}

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
    
    # Get batch information if provided
    batch_id = request.form.get('batch_id', str(uuid.uuid4()))
    file_index = request.form.get('file_index', 0)
    total_files = request.form.get('total_files', 1)
    
    # Process valid file
    if file and allowed_file(file.filename):
        # Generate a unique ID for this analysis
        analysis_id = str(uuid.uuid4())
        
        # Create directory for this analysis
        analysis_dir = os.path.join(app.config['RESULTS_FOLDER'], analysis_id)
        os.makedirs(analysis_dir, exist_ok=True)
        
        # Create batch directory if new batch
        batch_dir = os.path.join(app.config['BATCH_FOLDER'], batch_id)
        os.makedirs(batch_dir, exist_ok=True)
        
        # Register analysis in batch
        if batch_id not in batch_registry:
            batch_registry[batch_id] = {
                'files': [],
                'total_files': int(total_files),
                'processed_files': 0
            }
        
        # Secure the filename and save the file
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Add file to batch registry
        batch_registry[batch_id]['files'].append({
            'analysis_id': analysis_id,
            'filename': filename,
            'file_path': file_path
        })
        
        # Return the analysis ID for AJAX polling
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'analysis_id': analysis_id,
            'filename': filename,
            'file_path': file_path,
            'batch_id': batch_id
        })
    
    flash('Invalid file type. Please upload MP3 or WAV files.')
    return redirect(request.url)

@app.route('/analyze/<analysis_id>/<filename>', methods=['POST'])
def analyze_file(analysis_id, filename):
    """Run the analysis pipeline on the uploaded file."""
    batch_id = request.form.get('batch_id')
    
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
        
        # Update batch information
        if batch_id and batch_id in batch_registry:
            batch_registry[batch_id]['processed_files'] += 1
            
            # Find the file in the batch and update its data
            for file_info in batch_registry[batch_id]['files']:
                if file_info['analysis_id'] == analysis_id:
                    file_info.update({
                        'basic_features': basic_features,
                        'mood': mood_results,
                        'instruments': instrument_results,
                        'mood_theme': mood_theme_results
                    })
                    
                    # Determine primary mood and instrument
                    if mood_results:
                        # Get the mood with highest value
                        primary_mood = max(
                            [(k, v) for k, v in mood_results.items() if k != 'filename'], 
                            key=lambda x: x[1] if x[1] is not None else 0
                        )
                        file_info['primary_mood'] = primary_mood[0].replace('mood_', '').capitalize()
                    
                    if instrument_results:
                        # Get the instrument with highest value
                        primary_instrument = max(
                            [(k, v) for k, v in instrument_results.items() if k != 'filename'], 
                            key=lambda x: x[1] if x[1] is not None else 0
                        )
                        file_info['primary_instrument'] = primary_instrument[0].capitalize()
            
            # Check if all files in batch have been processed
            if batch_registry[batch_id]['processed_files'] >= batch_registry[batch_id]['total_files']:
                # Generate batch summary
                generate_batch_summary(batch_id)
        
        return jsonify({
            'success': True,
            'message': 'Analysis completed successfully',
            'analysis_id': analysis_id,
            'batch_id': batch_id
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

def generate_batch_summary(batch_id):
    """Generate summary visualizations for a batch of files."""
    try:
        batch_dir = os.path.join(app.config['BATCH_FOLDER'], batch_id)
        
        # Extract data from batch files
        batch_files = batch_registry[batch_id]['files']
        
        # Collect all mood data
        all_moods = defaultdict(list)
        for file_info in batch_files:
            if 'mood' in file_info:
                for mood, value in file_info['mood'].items():
                    if mood != 'filename' and value is not None:
                        all_moods[mood.replace('mood_', '').capitalize()].append(value)
        
        # Calculate average mood values
        avg_moods = {mood: sum(values) / len(values) for mood, values in all_moods.items()}
        
        # Create mood distribution pie chart
        fig = go.Figure(data=[go.Pie(
            labels=list(avg_moods.keys()),
            values=list(avg_moods.values()),
            hole=.3
        )])
        fig.update_layout(title="Mood Distribution Across All Files")
        mood_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(batch_dir, 'mood_distribution.json'), 'w') as f:
            f.write(mood_json)
        
        # Collect all instrument data
        all_instruments = defaultdict(list)
        for file_info in batch_files:
            if 'instruments' in file_info:
                for inst, value in file_info['instruments'].items():
                    if inst != 'filename' and value is not None and isinstance(value, (int, float)):
                        all_instruments[inst.capitalize()].append(value)
        
        # Calculate average instrument values and get top 10
        avg_instruments = {inst: sum(values) / len(values) for inst, values in all_instruments.items()}
        top_instruments = sorted(avg_instruments.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Create instrument distribution bar chart
        fig = go.Figure([go.Bar(
            x=[i[0] for i in top_instruments],
            y=[i[1] for i in top_instruments],
            marker_color='rgb(55, 83, 109)'
        )])
        fig.update_layout(
            title="Top 10 Instruments Across All Files",
            xaxis_title="Instrument",
            yaxis_title="Average Probability",
            yaxis=dict(range=[0, 1])
        )
        instrument_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(batch_dir, 'instrument_distribution.json'), 'w') as f:
            f.write(instrument_json)
        
        # Collect all tempo data
        all_tempos = []
        for file_info in batch_files:
            if 'basic_features' in file_info and 'tempo' in file_info['basic_features']:
                tempo = file_info['basic_features']['tempo']
                if tempo is not None:
                    all_tempos.append(tempo)
        
        # Create tempo histogram
        fig = go.Figure(data=[go.Histogram(
            x=all_tempos,
            nbinsx=20,
            marker_color='rgb(245, 177, 66)'
        )])
        fig.update_layout(
            title="Tempo Distribution",
            xaxis_title="Tempo (BPM)",
            yaxis_title="Number of Files"
        )
        tempo_json = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
        with open(os.path.join(batch_dir, 'tempo_distribution.json'), 'w') as f:
            f.write(tempo_json)
        
        # Save batch summary data
        with open(os.path.join(batch_dir, 'batch_summary.json'), 'w') as f:
            json.dump({
                'batch_id': batch_id,
                'total_files': len(batch_files),
                'file_summaries': [
                    {
                        'analysis_id': file_info['analysis_id'],
                        'filename': file_info['filename'],
                        'duration': file_info.get('basic_features', {}).get('duration'),
                        'tempo': file_info.get('basic_features', {}).get('tempo'),
                        'key': file_info.get('basic_features', {}).get('key'),
                        'scale': file_info.get('basic_features', {}).get('scale'),
                        'energy': file_info.get('basic_features', {}).get('energy'),
                        'primary_mood': file_info.get('primary_mood'),
                        'primary_instrument': file_info.get('primary_instrument')
                    }
                    for file_info in batch_files
                ]
            }, f, indent=2)
        
    except Exception as e:
        print(f"Error generating batch summary: {e}")

@app.route('/batch-results/<batch_id>')
def show_batch_results(batch_id):
    """Show batch analysis results page."""
    batch_dir = os.path.join(app.config['BATCH_FOLDER'], batch_id)
    
    # Check if batch exists
    if not os.path.exists(batch_dir):
        flash('Batch analysis not found')
        return redirect(url_for('index'))
    
    # Load batch summary
    with open(os.path.join(batch_dir, 'batch_summary.json'), 'r') as f:
        batch_summary = json.load(f)
    
    # Load distribution charts
    chart_data = {}
    for chart_type in ['mood_distribution', 'instrument_distribution', 'tempo_distribution']:
        chart_path = os.path.join(batch_dir, f'{chart_type}.json')
        if os.path.exists(chart_path):
            with open(chart_path, 'r') as f:
                chart_data[chart_type] = f.read()
    
    return render_template(
        'batch-results.html',
        batch_id=batch_id,
        total_files=batch_summary['total_files'],
        batch_files=batch_summary['file_summaries'],
        mood_distribution=chart_data.get('mood_distribution'),
        instrument_distribution=chart_data.get('instrument_distribution'),
        tempo_distribution=chart_data.get('tempo_distribution')
    )

@app.route('/results/<analysis_id>')
def show_results(analysis_id):
    """Show individual file analysis results page."""
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

@app.route('/export-batch/<batch_id>')
def export_batch_results(batch_id):
    """Export batch results as CSV."""
    batch_dir = os.path.join(app.config['BATCH_FOLDER'], batch_id)
    
    # Check if batch exists
    if not os.path.exists(batch_dir) or not os.path.exists(os.path.join(batch_dir, 'batch_summary.json')):
        flash('Batch not found')
        return redirect(url_for('index'))
    
    # Load batch summary
    with open(os.path.join(batch_dir, 'batch_summary.json'), 'r') as f:
        batch_summary = json.load(f)
    
    # Create DataFrame from file summaries
    df = pd.DataFrame(batch_summary['file_summaries'])
    
    # Save to CSV
    csv_path = os.path.join(batch_dir, 'batch_export.csv')
    df.to_csv(csv_path, index=False)
    
    # Return the file
    return send_from_directory(
        os.path.dirname(csv_path),
        os.path.basename(csv_path),
        as_attachment=True,
        download_name=f'music_analysis_batch_{batch_id}.csv'
    )

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files."""
    return send_from_directory(app.static_folder, filename)

if __name__ == '__main__':
    app.run(debug=True) 
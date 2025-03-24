/**
 * Music Feature Extraction Web UI
 * JavaScript for handling file upload and analysis.
 */

$(document).ready(function() {
    // File upload form submission
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();
        
        // Get the file
        const fileInput = document.getElementById('file');
        if (!fileInput.files.length) {
            alert('Please select a file to upload');
            return;
        }
        
        const file = fileInput.files[0];
        
        // Check file size (max 32MB)
        if (file.size > 32 * 1024 * 1024) {
            alert('File size exceeds the 32MB limit');
            return;
        }
        
        // Check file type
        const fileType = file.name.split('.').pop().toLowerCase();
        if (!['mp3', 'wav'].includes(fileType)) {
            alert('Only MP3 and WAV files are supported');
            return;
        }
        
        // Show progress container, hide upload form
        $('#upload-container').addClass('d-none');
        $('#progress-container').removeClass('d-none');
        
        // Prepare form data for upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload the file
        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        $('#upload-progress').width(percent + '%');
                        $('#upload-progress').text(percent + '%');
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                if (response.success) {
                    // Update status
                    $('#status-message').html(`
                        <i class="fas fa-cogs fa-spin me-2"></i>
                        Analyzing audio features...
                    `);
                    $('#upload-progress').width('50%');
                    $('#upload-progress').text('50%');
                    
                    // Start the analysis
                    startAnalysis(response.analysis_id, response.filename);
                } else {
                    showError('Upload failed: ' + response.message);
                }
            },
            error: function() {
                showError('An error occurred during file upload');
            }
        });
    });
    
    /**
     * Start the analysis process after upload
     */
    function startAnalysis(analysisId, filename) {
        $.ajax({
            url: `/analyze/${analysisId}/${filename}`,
            type: 'POST',
            success: function(response) {
                if (response.success) {
                    // Update progress
                    $('#upload-progress').width('100%');
                    $('#upload-progress').text('100%');
                    $('#status-message').html(`
                        <i class="fas fa-check-circle me-2"></i>
                        Analysis complete! Loading results...
                    `);
                    
                    // Redirect to results page
                    setTimeout(function() {
                        window.location.href = `/results/${analysisId}`;
                    }, 1000);
                } else {
                    showError('Analysis failed: ' + response.message);
                }
            },
            error: function() {
                showError('An error occurred during audio analysis');
            }
        });
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        $('#progress-container').addClass('d-none');
        $('#upload-container').removeClass('d-none');
        
        const errorAlert = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Error!</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        $('#upload-container').prepend(errorAlert);
    }
}); 
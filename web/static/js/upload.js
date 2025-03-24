/**
 * Music Feature Extraction Web UI
 * JavaScript for handling file upload and batch analysis.
 */

$(document).ready(function() {
    // File upload form submission
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();
        
        // Get the files
        const fileInput = document.getElementById('file');
        if (!fileInput.files.length) {
            alert('Please select at least one file to upload');
            return;
        }
        
        const files = fileInput.files;
        const totalFiles = files.length;
        let validFiles = [];
        
        // Validate all files
        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            
            // Check file size (max 32MB)
            if (file.size > 32 * 1024 * 1024) {
                alert(`File ${file.name} exceeds the 32MB limit and will be skipped`);
                continue;
            }
            
            // Check file type
            const fileType = file.name.split('.').pop().toLowerCase();
            if (!['mp3', 'wav'].includes(fileType)) {
                alert(`File ${file.name} is not an MP3 or WAV file and will be skipped`);
                continue;
            }
            
            validFiles.push(file);
        }
        
        if (validFiles.length === 0) {
            alert('No valid files to process');
            return;
        }
        
        // Show progress container, hide upload form
        $('#upload-container').addClass('d-none');
        $('#progress-container').removeClass('d-none');
        
        // Create a batch ID for this upload
        const batchId = generateUUID();
        
        // Track progress
        let filesProcessed = 0;
        let totalProgress = 0;
        
        // Start processing each file
        processNextFile(validFiles, 0, batchId, totalFiles);
    });
    
    /**
     * Process files one by one
     */
    function processNextFile(files, index, batchId, totalFiles) {
        if (index >= files.length) {
            // All files processed, redirect to batch results
            $('#status-message').html(`
                <i class="fas fa-check-circle me-2"></i>
                All files processed! Loading results...
            `);
            
            setTimeout(function() {
                window.location.href = `/batch-results/${batchId}`;
            }, 1500);
            
            return;
        }
        
        const file = files[index];
        const currentFileNum = index + 1;
        
        // Update status message
        $('#status-message').html(`
            <i class="fas fa-file-audio me-2"></i>
            Processing file ${currentFileNum} of ${files.length}: ${file.name}
        `);
        
        // Calculate overall progress percentage
        const overallProgress = Math.round((index / files.length) * 50);
        updateProgressBar(overallProgress);
        
        // Prepare form data for this file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('batch_id', batchId);
        formData.append('file_index', index);
        formData.append('total_files', files.length);
        
        // Upload the file
        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // Start the analysis for this file
                    analyzeFile(response.analysis_id, response.filename, batchId, function() {
                        // Move to next file
                        processNextFile(files, index + 1, batchId, totalFiles);
                    });
                } else {
                    alert(`Error processing ${file.name}: ${response.message}`);
                    // Continue with next file despite error
                    processNextFile(files, index + 1, batchId, totalFiles);
                }
            },
            error: function() {
                alert(`An error occurred during upload of ${file.name}`);
                // Continue with next file despite error
                processNextFile(files, index + 1, batchId, totalFiles);
            }
        });
    }
    
    /**
     * Analyze a single file after upload
     */
    function analyzeFile(analysisId, filename, batchId, callback) {
        // Update status
        $('#status-message').html(`
            <i class="fas fa-cogs fa-spin me-2"></i>
            Analyzing features for: ${filename}
        `);
        
        $.ajax({
            url: `/analyze/${analysisId}/${filename}`,
            type: 'POST',
            data: {
                batch_id: batchId
            },
            success: function(response) {
                if (response.success) {
                    // File analyzed successfully
                    callback();
                } else {
                    alert(`Analysis failed for ${filename}: ${response.message}`);
                    callback();
                }
            },
            error: function() {
                alert(`An error occurred during analysis of ${filename}`);
                callback();
            }
        });
    }
    
    /**
     * Update the progress bar
     */
    function updateProgressBar(percent) {
        $('#upload-progress').width(percent + '%');
        $('#upload-progress').text(percent + '%');
    }
    
    /**
     * Generate a UUID for batch tracking
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
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
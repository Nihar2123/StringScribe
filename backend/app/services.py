# backend/app/services.py
import os
import hashlib
import tempfile
import requests
from flask import current_app

def get_source_hash(request):
    """
    Calculates a hash for the source (file or URL).
    Returns (hash, source_info, temp_file_path)
    """
    data = request.form.to_dict()

    if 'youtube_url' in data and data['youtube_url']:
        source_info = f"youtube: {data['youtube_url']}"
        source_hash = data['youtube_url']
        return source_hash, source_info, None

    elif 'audio_file' in request.files:
        incoming_file = request.files['audio_file']
        source_info = f"file: {incoming_file.filename}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(incoming_file.filename)[1]) as temp_file:
            incoming_file.save(temp_file.name)
            temp_file_path = temp_file.name

        sha256 = hashlib.sha256()
        with open(temp_file_path, 'rb') as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        source_hash = sha256.hexdigest()

        return source_hash, source_info, temp_file_path

    return None, None, None

def forward_to_processor(data, temp_file_path):
    """ Forwards the request to the audio-tab-processor service. """
    files_to_forward = None
    try:
        if temp_file_path:
            files_to_forward = {'audio_file': (os.path.basename(temp_file_path), open(temp_file_path, 'rb'))}

        processor_response = requests.post(
            current_app.config['PROCESSOR_URL_AUDIO'],
            files=files_to_forward,
            data=data,
            timeout=300
        )
        processor_response.raise_for_status()
        return processor_response.json(), None

    except requests.exceptions.RequestException as e:
        print(f"Error communicating with processor: {e}")
        return None, "Processing service failed or timed out"

    finally:
        if files_to_forward:
            files_to_forward['audio_file'][1].close()
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

def delete_job_files(job):
    """ Deletes the physical files associated with a job."""
    if not job:
        return

    base_dir = current_app.config['PROCESSED_FILES_DIR']

    if job.midi_relative_path:
        path = os.path.join(base_dir, job.midi_relative_path)
        if os.path.exists(path):
            os.unlink(path)

    if job.wav_relative_path:
        path = os.path.join(base_dir, job.wav_relative_path)
        if os.path.exists(path):
            os.unlink(path)
# backend/app/routes.py
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from .models import db, User, bcrypt, AudioProcessingJob, TabGeneration
from flask_login import login_user, logout_user, login_required, current_user
from .services import get_source_hash, forward_to_processor, delete_job_files
import requests
from datetime import datetime

api = Blueprint('api', __name__)

# --- AUTHENTICATION ROUTES (Unchanged) ---
@api.route("/register", methods=["POST"])
def register():
    # ... (code from previous step)
    data = request.json
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already exists"}), 409
    new_user = User(username=data.get('username'), email=data.get('email'))
    new_user.set_password(data.get('password'))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": f"User {new_user.username} created"}), 201

@api.route("/login", methods=["POST"])
def login():
    # ... (code from previous step)
    data = request.json
    user = User.query.filter_by(email=data.get('email')).first()
    if user and user.check_password(data.get('password')):
        login_user(user)
        return jsonify({"user": {"id": user.id, "username": user.username}}), 200
    return jsonify({"error": "Invalid credentials"}), 401

@api.route("/logout", methods=["POST"])
@login_required
def logout():
    # ... (code from previous step)
    logout_user()
    return jsonify({"message": "Logout successful"}), 200

@api.route("/me", methods=["GET"])
@login_required
def get_me():
    # ... (code from previous step)
    return jsonify({"id": current_user.id, "username": current_user.username, "email": current_user.email}), 200


@api.route("/static/processed/<path:filename>")
def serve_processed_file(filename):
    """Serves the generated MIDI and WAV files."""
    return send_from_directory(current_app.config['PROCESSED_FILES_DIR'], filename)

# This function goes inside backend/app/routes.py

@api.route("/process", methods=["POST"])
@login_required
def process_request():
    """
    Handles audio file/URL submission.
    Creates a new AudioProcessingJob or overwrites an existing one for the current user.
    """
    user_id = current_user.id
    data = request.form.to_dict()

    # Use the helper function from services.py to get a unique hash for the audio source
    source_hash, source_info, temp_file_path = get_source_hash(request)
    if not source_hash:
        return jsonify({"error": "No audio file or YouTube URL provided"}), 400

    # Check if a job for this exact audio source already exists for this user
    existing_job = AudioProcessingJob.query.filter_by(
        user_id=user_id, source_hash=source_hash
    ).first()

    # Forward the audio to the processor service to get the MIDI and WAV files
    processor_data, error = forward_to_processor(data, temp_file_path)
    if error:
        return jsonify({"error": error}), 503

    if existing_job:
        # If a job exists, we overwrite it (destructive update)
        print(f"OVERWRITING existing job {existing_job.id} for user {user_id}")

        # 1. Delete the old physical .mid and .wav files from the server
        delete_job_files(existing_job)

        # 2. Update the existing database record with the new information
        existing_job.title = source_info  # Reset the title to the new source info
        existing_job.source_info = source_info
        existing_job.midi_relative_path = processor_data.get('midi_relative_path')
        existing_job.wav_relative_path = processor_data.get('wav_relative_path')
        existing_job.midi_filename = processor_data.get('midi_filename')
        existing_job.created_at = datetime.utcnow()

        db.session.commit()
        job_to_return = existing_job
    else:
        # If no job exists, we create a new one
        print(f"CREATING new job for user {user_id}")

        new_job = AudioProcessingJob(
            user_id=user_id,
            title=source_info,  # Use the source info as the default title
            source_hash=source_hash,
            source_info=source_info,
            midi_relative_path=processor_data.get('midi_relative_path'),
            wav_relative_path=processor_data.get('wav_relative_path'),
            midi_filename=processor_data.get('midi_filename')
        )
        db.session.add(new_job)
        db.session.commit()
        job_to_return = new_job

    # Return the full job object to the frontend
    return jsonify(job_to_return.to_dict()), 200

@api.route("/generate_tabs", methods=["POST"])
@login_required
def generate_tabs_proxy():
    """Generates a new tab version for a given audio job."""
    user_id = current_user.id
    data = request.json
    job_id = data.get('job_id')
    algorithm = data.get('algorithm', 'unknown')

    job = AudioProcessingJob.query.filter_by(id=job_id, user_id=user_id).first()
    if not job:
        return jsonify({"error": "Audio job not found or you do not own it"}), 404

    proxy_payload = {"midi_filename": job.midi_filename, "algorithm": algorithm}
    resp = requests.post(current_app.config['PROCESSOR_URL_TABS'], json=proxy_payload)
    if resp.status_code != 200:
        return jsonify(resp.json()), resp.status_code

    tab_data = resp.json()

    # We will add renaming and history later. For now, just return the text.
    return jsonify(tab_data), 201

@api.route("/get_midi_notes", methods=["POST"])
@login_required
def get_midi_notes_proxy():
    """Proxies the request to get MIDI note data for the visualizer."""
    resp = requests.post(current_app.config['PROCESSOR_URL_NOTES'], json=request.json)
    return jsonify(resp.json()), resp.status_code

@api.route("/my-jobs", methods=["GET"])
@login_required
def get_my_jobs():
    """Fetches all audio processing jobs for the current user."""
    jobs = AudioProcessingJob.query.filter_by(
        user_id=current_user.id
    ).order_by(AudioProcessingJob.created_at.desc()).all()

    return jsonify([j.to_dict() for j in jobs]), 200

@api.route("/jobs/<int:job_id>", methods=["PUT"])
@login_required
def rename_job(job_id):
    """Renames a specific audio processing job."""
    new_title = request.json.get('title')
    if not new_title:
        return jsonify({"error": "New title is required"}), 400

    job = AudioProcessingJob.query.get(job_id)
    if not job or job.user_id != current_user.id:
        return jsonify({"error": "Job not found or you do not own it"}), 404

    job.title = new_title
    db.session.commit()

    return jsonify(job.to_dict()), 200

@api.route("/jobs/<int:job_id>", methods=["DELETE"])
@login_required
def delete_job(job_id):
    """Deletes a job, its child tabs, and its physical files."""
    job = AudioProcessingJob.query.get(job_id)
    if not job or job.user_id != current_user.id:
        return jsonify({"error": "Job not found or you do not own it"}), 404

    # Delete the physical .mid and .wav files first
    delete_job_files(job)

    # The 'cascade' option in the model will automatically delete child TabGenerations
    db.session.delete(job)
    db.session.commit()

    return jsonify({"message": "Job deleted successfully"}), 200
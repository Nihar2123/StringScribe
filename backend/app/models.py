from flask_login import UserMixin
from . import db, bcrypt  # Imports the db and bcrypt instances from __init__.py
from datetime import datetime
from flask import url_for
import os

class User(db.Model, UserMixin):
    """Model for user accounts."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    # Establishes a one-to-many relationship: one User can have many AudioProcessingJobs.
    # If a User is deleted, all their associated jobs will also be deleted.
    audio_jobs = db.relationship('AudioProcessingJob', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        """Creates a securely hashed password."""
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf8')

    def check_password(self, password):
        """Checks if a provided password matches the stored hash."""
        return bcrypt.check_password_hash(self.password_hash, password)

class AudioProcessingJob(db.Model):
    """
    Represents one audio-to-MIDI processing run. This is the main
    'history' item that the user will see.
    """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # The user-editable name for this job (e.g., "My Song Idea").
    title = db.Column(db.String(255), nullable=False)
    
    # A unique fingerprint of the audio file or YouTube URL.
    source_hash = db.Column(db.String(64), nullable=True, index=True) 
    # The original filename or URL, for display purposes.
    source_info = db.Column(db.String(255), nullable=True)
    
    # The filenames of the generated files, stored in the 'processed_files' folder.
    midi_relative_path = db.Column(db.String(255), nullable=True)
    wav_relative_path = db.Column(db.String(255), nullable=True)
    midi_filename = db.Column(db.String(255), nullable=True) # Used for proxying to the processor
    
    # A database constraint to ensure a user can only have one job per unique audio source.
    __table_args__ = (
        db.UniqueConstraint('user_id', 'source_hash', name='_user_source_uc'),
    )
    
    # One AudioProcessingJob can have many TabGenerations.
    # If this job is deleted, all its child tabs will be deleted automatically.
    tab_generations = db.relationship('TabGeneration', backref='job', lazy=True, cascade="all, delete-orphan")

    def get_urls(self):
        """Generates the full, publicly accessible URLs for the generated files."""
        from .routes import api # Local import to prevent circular dependency
        return {
            "midi_url": url_for('api.serve_processed_file', filename=self.midi_relative_path, _external=True) if self.midi_relative_path else None,
            "wav_url": url_for('api.serve_processed_file', filename=self.wav_relative_path, _external=True) if self.wav_relative_path else None,
        }

    def to_dict(self):
        """Creates a JSON-serializable dictionary representation of the job."""
        return {
            "job_id": self.id,
            "title": self.title,
            "source_info": self.source_info,
            "created_at": self.created_at.isoformat(),
            "midi_filename": self.midi_filename,
            **self.get_urls(),
        }

class TabGeneration(db.Model):
    """
    Represents one version of a tab generated from an AudioProcessingJob.
    This is a child object and not directly exposed in the history.
    """
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('audio_processing_job.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    algorithm = db.Column(db.String(50), nullable=True)
    tab_text = db.Column(db.Text, nullable=True)


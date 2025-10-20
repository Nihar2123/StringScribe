# backend/app/models.py
from flask_login import UserMixin
from . import db, bcrypt  # <-- This now correctly imports from __init__.py
from datetime import datetime
from flask import url_for
import os

class User(db.Model, UserMixin):
    """Model for user accounts."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    audio_jobs = db.relationship('AudioProcessingJob', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

class AudioProcessingJob(db.Model):
    """Represents one audio-to-MIDI processing run for a user."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    source_hash = db.Column(db.String(64), nullable=True, index=True)
    source_info = db.Column(db.String(255), nullable=True)

    midi_relative_path = db.Column(db.String(255), nullable=True)
    wav_relative_path = db.Column(db.String(255), nullable=True)
    midi_filename = db.Column(db.String(255), nullable=True)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'source_hash', name='_user_source_uc'),
    )
    tab_generations = db.relationship('TabGeneration', backref='job', lazy=True, cascade="all, delete-orphan")

    def get_urls(self):
        from .routes import api
        return {
            "midi_url": url_for('api.serve_processed_file', filename=self.midi_relative_path, _external=True) if self.midi_relative_path else None,
            "wav_url": url_for('api.serve_processed_file', filename=self.wav_relative_path, _external=True) if self.wav_relative_path else None,
        }

class TabGeneration(db.Model):
    """Represents one version of a tab generated from an AudioProcessingJob."""
    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('audio_processing_job.id'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    algorithm = db.Column(db.String(50), nullable=True)
    tab_text = db.Column(db.Text, nullable=True)
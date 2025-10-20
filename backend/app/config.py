import os
from dotenv import load_dotenv

# Find the absolute path of the directory this file is in
basedir = os.path.abspath(os.path.dirname(__file__))
# Load the .env file from the parent directory (backend/)
load_dotenv(os.path.join(basedir, '..', '.env'))

class Config:
    """Set Flask configuration variables from .env file."""

    # General Config
    SECRET_KEY = os.environ.get('SECRET_KEY')
    FLASK_APP = os.environ.get('FLASK_APP')
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG')

    # Database
    # This creates a 'stringscribe.db' file in your 'backend' directory
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, '..', 'stringscribe.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    PROCESSOR_URL_AUDIO = "http://127.0.0.1:5002/process_audio"
    PROCESSOR_URL_TABS = "http://127.0.0.1:5002/generate_tabs"
    PROCESSOR_URL_NOTES = "http://127.0.0.1:5002/get_midi_notes"

    PROCESSED_FILES_DIR = os.path.join(
        basedir, '..', '..', 'audio-tab-processor', 'processed_files'
    )
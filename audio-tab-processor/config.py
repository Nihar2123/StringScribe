import os

# Base directory for all processed files.
# The Main Backend will serve files from this location.
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "processed_files")

# --- Guitar and Music Constants ---

# MIDI note numbers for open strings of a standard-tuned guitar (EADGBe)
# 6th string (E) to 1st string (e)
GUITAR_OPEN_PITCHES = [40, 45, 50, 55, 59, 64]

# Standard number of frets on a guitar
MAX_FRET = 22

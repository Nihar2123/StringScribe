from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import traceback
import time

from config import OUTPUT_DIR
from services.audio_service import process_audio_file
from services.youtube_service import download_youtube_audio
from services.ffmpeg_service import convert_wav_to_s16le
from services.tab_service import generate_tabs_from_midi, get_notes_from_midi
from utils import midi_to_hz

app = Flask(__name__)
CORS(app)

# Ensure the main output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)


@app.route("/process_audio", methods=["POST"])
def process_audio_endpoint():
    """
    Endpoint to process an audio file (from upload or YouTube) and convert it to MIDI.
    """
    # Create a unique directory for this processing job
    job_id = f"job_{int(time.time() * 1000)}"
    job_dir = os.path.join(OUTPUT_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        params = {
            "onset_threshold": float(request.form.get("onset_threshold", 0.5)),
            "frame_threshold": float(request.form.get("frame_threshold", 0.3)),
            "minimum_note_length": int(request.form.get("minimum_note_length", 120)),
            # Safely convert pitch values to frequency
            "minimum_frequency": midi_to_hz(int(request.form.get("minPitch", 0))) if request.form.get("minPitch") else None,
            "maximum_frequency": midi_to_hz(int(request.form.get("maxPitch", 127))) if request.form.get("maxPitch") else None,
        }

        midi_path, wav_path = None, None

        if "audio_file" in request.files:
            file = request.files["audio_file"]
            # Use a temporary file to safely handle the upload
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as t:
                file.save(t.name)
                temp_audio_path = t.name

            midi_path, wav_path = process_audio_file(temp_audio_path, job_dir, params)
            os.unlink(temp_audio_path) # Clean up the temporary file

        elif "youtube_url" in request.form and request.form.get("youtube_url"):
            youtube_url = request.form.get("youtube_url")
            # Use a temporary directory for the download
            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = download_youtube_audio(youtube_url, tmpdir)
                if audio_path:
                    midi_path, wav_path = process_audio_file(audio_path, job_dir, params)
        else:
            return jsonify({"error": "Processor expects 'audio_file' or 'youtube_url'"}), 400

        # Convert the generated wav file for better compatibility
        final_wav_path = convert_wav_to_s16le(wav_path) if wav_path else None

        response_data = {
            "midi_relative_path": os.path.join(job_id, os.path.basename(midi_path)) if midi_path else None,
            "wav_relative_path": os.path.join(job_id, os.path.basename(final_wav_path)) if final_wav_path else None,
            "midi_filename": os.path.join(job_id, os.path.basename(midi_path)) if midi_path else None,
        }
        return jsonify(response_data)

    except Exception as e:
        # Return a detailed error for easier debugging
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/generate_tabs", methods=["POST"])
def generate_tabs_endpoint():
    """
    Endpoint to generate guitar tabs from a processed MIDI file.
    """
    data = request.get_json(force=True)
    midi_filename = data.get("midi_filename")
    algorithm = data.get("algorithm", "efficient")

    if not midi_filename:
        return jsonify({"error": "midi_filename required"}), 400

    try:
        tab_text = generate_tabs_from_midi(midi_filename, algorithm)
        return jsonify({"tab_text": tab_text})
    except FileNotFoundError:
        return jsonify({"error": "MIDI file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/get_midi_notes", methods=["POST"])
def get_midi_notes_endpoint():
    """
    Endpoint to extract musical notes from a MIDI file.
    """
    data = request.get_json(force=True)
    midi_filename = data.get("midi_filename")
    if not midi_filename:
        return jsonify({"error": "midi_filename required"}), 400

    try:
        notes_data = get_notes_from_midi(midi_filename)
        return jsonify(notes_data)
    except FileNotFoundError:
        return jsonify({"error": "MIDI file not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5002)

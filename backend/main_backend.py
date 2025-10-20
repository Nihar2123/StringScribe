from flask import Flask, request, jsonify, url_for, send_from_directory
from flask_cors import CORS
import requests
import os
import tempfile # Add tempfile import

app = Flask(__name__)
CORS(app)

PROCESSOR_URL_AUDIO = "http://127.0.0.1:5002/process_audio"
PROCESSOR_URL_TABS = "http://127.0.0.1:5002/generate_tabs"
PROCESSOR_URL_NOTES = "http://127.0.0.1:5002/get_midi_notes"

PROCESSED_FILES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio-tab-processor", "processed_files")

def get_user_from_request(req):
    return {"id": "user_123"}

@app.route("/static/processed/<path:filename>")
def serve_processed_file(filename):
    return send_from_directory(PROCESSED_FILES_DIR, filename)

@app.route("/api/process", methods=["POST"])
def process_request():
    user = get_user_from_request(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.form.to_dict()
        files_to_forward = None

        # --- START: NEW FILE HANDLING LOGIC ---
        if 'audio_file' in request.files:
            incoming_file = request.files['audio_file']

            # Create a temporary file to save the stream
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(incoming_file.filename)[1]) as temp_file:
                incoming_file.save(temp_file.name)
                temp_file_path = temp_file.name

            # Now, prepare to send the newly saved file
            files_to_forward = {'audio_file': (os.path.basename(temp_file_path), open(temp_file_path, 'rb'), incoming_file.mimetype)}
            print(f"MAIN BACKEND: Temporarily saved file to {temp_file_path} before forwarding.")
        # --- END: NEW FILE HANDLING LOGIC ---

        processor_response = requests.post(PROCESSOR_URL_AUDIO, files=files_to_forward, data=data, timeout=300)

        # Clean up the temporary file after the request is sent
        if files_to_forward:
            files_to_forward['audio_file'][1].close() # Close the file handle
            os.unlink(temp_file_path) # Delete the file

        processor_response.raise_for_status()
        processor_data = processor_response.json()

    except requests.exceptions.RequestException as e:
        # Clean up temp file in case of an error too
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        print(f"Error communicating with processor: {e}")
        return jsonify({"error": "Processing service failed or timed out"}), 503

    final_response = {
        "midi_url": url_for('serve_processed_file', filename=processor_data.get('midi_relative_path'), _external=True) if processor_data.get('midi_relative_path') else None,
        "wav_url": url_for('serve_processed_file', filename=processor_data.get('wav_relative_path'), _external=True) if processor_data.get('wav_relative_path') else None,
        "midi_filename": processor_data.get('midi_filename'),
    }
    return jsonify(final_response)

# --- The other proxy routes remain the same ---
@app.route("/api/generate_tabs", methods=["POST"])
def generate_tabs_proxy():
    if not get_user_from_request(request): return jsonify({"error": "Unauthorized"}), 401
    resp = requests.post(PROCESSOR_URL_TABS, json=request.json)
    return jsonify(resp.json()), resp.status_code

@app.route("/api/get_midi_notes", methods=["POST"])
def get_midi_notes_proxy():
    if not get_user_from_request(request): return jsonify({"error": "Unauthorized"}), 401
    resp = requests.post(PROCESSOR_URL_NOTES, json=request.json)
    return jsonify(resp.json()), resp.status_code

if __name__ == "__main__":
    app.run(debug=True, port=5001)


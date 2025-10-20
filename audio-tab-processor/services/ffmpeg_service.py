import os
import subprocess

def convert_wav_to_s16le(wav_path):
    """
    Converts a WAV file to a more compatible format (16-bit PCM, 44100 Hz).
    This helps prevent issues with web playback.

    Args:
        wav_path (str): The path to the input WAV file.

    Returns:
        str: The path to the converted WAV file, or the original path if conversion fails.
    """
    if not wav_path or not os.path.exists(wav_path):
        return None

    # Define the output path for the converted file
    fixed_wav_path = os.path.splitext(wav_path)[0] + "_fixed.wav"

    # FFmpeg command to convert audio codec and sample rate
    command = [
        "ffmpeg",
        "-i", wav_path,
        "-acodec", "pcm_s16le", # Signed 16-bit PCM
        "-ar", "44100",        # 44.1 kHz sample rate
        "-y",                  # Overwrite output file if it exists
        fixed_wav_path
    ]

    try:
        # Execute the command
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        print(f"FFMPEG Success: Converted {wav_path} to {fixed_wav_path}")
        return fixed_wav_path
    except subprocess.CalledProcessError as e:
        # If FFmpeg fails, log the error and return the original path
        print(f"FFMPEG Error converting {wav_path}: {e.stderr}")
        return wav_path

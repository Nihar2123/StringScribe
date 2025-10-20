import os
import yt_dlp

def download_youtube_audio(youtube_url, tmpdir):
    """
    Downloads the audio from a YouTube URL and saves it as a WAV file.

    Args:
        youtube_url (str): The URL of the YouTube video.
        tmpdir (str): The temporary directory to save the downloaded file.

    Returns:
        str: The path to the downloaded WAV audio file, or None if download fails.
    """
    # Define options for yt-dlp
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"), # Output template
        "quiet": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",    # Convert to WAV
            "preferredquality": "192",  # Audio quality
        }],
    }

    try:
        print(f"Downloading audio from YouTube URL: {youtube_url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(youtube_url, download=True)

        # The output file should be named 'audio.wav' in the temp directory
        audio_path = os.path.join(tmpdir, "audio.wav")
        if os.path.exists(audio_path):
            print(f"Successfully downloaded and converted audio to {audio_path}")
            return audio_path
        else:
            print("Error: Audio file not found after yt-dlp processing.")
            return None
    except Exception as e:
        print(f"An error occurred during YouTube download: {e}")
        return None

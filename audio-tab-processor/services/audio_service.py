import os
from basic_pitch.inference import predict_and_save
from basic_pitch import ICASSP_2022_MODEL_PATH

def process_audio_file(audio_path, out_dir, params=None):
    """
    Processes an audio file using the basic-pitch library to generate MIDI and WAV files.

    Args:
        audio_path (str): The full path to the input audio file.
        out_dir (str): The directory where the output files will be saved.
        params (dict): A dictionary of parameters for the prediction model.

    Returns:
        (str, str): A tuple containing the paths to the generated MIDI and WAV files.
    """
    params = params or {}
    print(f"Processing audio file: {audio_path} with params: {params}")

    # Use basic-pitch to predict notes and create MIDI
    predict_and_save(
        audio_path_list=[audio_path],
        output_directory=out_dir,
        save_model_outputs=False,
        # CORRECTED: The parameter name should be 'model_or_model_path'
        model_or_model_path=ICASSP_2022_MODEL_PATH,
        save_midi=True,
        sonify_midi=True,
        save_notes=False,
        onset_threshold=params.get("onset_threshold", 0.5),
        frame_threshold=params.get("frame_threshold", 0.3),
        minimum_note_length=params.get("minimum_note_length", 120),
        minimum_frequency=params.get("minimum_frequency"),
        maximum_frequency=params.get("maximum_frequency"),
    )

    # Find the generated files in the output directory
    midi_path = next((os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.endswith(".mid")), None)
    wav_path = next((os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.endswith(".wav")), None)

    return midi_path, wav_path


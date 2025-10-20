import os
import pretty_midi
import numpy as np

from config import OUTPUT_DIR
# CORRECTED: Import the functions directly from their modules.
from .tab_algorithms.simple import generate_tab_simple
from .tab_algorithms.efficient import generate_tab_efficient

def generate_tabs_from_midi(midi_filename, algorithm="efficient"):
    """
    Generates guitar tabs from a MIDI file using a specified algorithm.

    Args:
        midi_filename (str): The relative path/filename of the MIDI file.
        algorithm (str): The algorithm to use ('simple' or 'efficient').

    Returns:
        str: The generated guitar tab as a string.
    """
    midi_path = os.path.join(OUTPUT_DIR, midi_filename)
    if not os.path.exists(midi_path):
        raise FileNotFoundError("The specified MIDI file was not found.")

    pm = pretty_midi.PrettyMIDI(midi_path)

    # Now we can call the functions directly
    if algorithm == "efficient":
        return generate_tab_efficient(pm)
    else:
        return generate_tab_simple(pm)

def get_notes_from_midi(midi_filename):
    """
    Extracts all musical notes from a MIDI file.

    Args:
        midi_filename (str): The relative path/filename of the MIDI file.

    Returns:
        dict: A dictionary containing a list of notes and the track's end time.
    """
    midi_path = os.path.join(OUTPUT_DIR, midi_filename)
    if not os.path.exists(midi_path):
        raise FileNotFoundError("The specified MIDI file was not found.")

    pm = pretty_midi.PrettyMIDI(midi_path)

    notes_list = [
        {'pitch': note.pitch, 'start': note.start, 'end': note.end}
        for instrument in pm.instruments if not instrument.is_drum
        for note in instrument.notes
    ]

    return {'notes': notes_list, 'end_time': pm.get_end_time()}


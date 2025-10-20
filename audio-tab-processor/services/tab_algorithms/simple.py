import numpy as np
import pretty_midi
from config import GUITAR_OPEN_PITCHES, MAX_FRET

def find_string_and_fret_simple(pitch):
    """
    Finds the guitar string and fret for a given MIDI pitch.
    This simple version prioritizes the lowest possible fret.
    """
    best_option = None
    min_fret = float('inf')

    # Iterate through each open string pitch
    for i, open_pitch in enumerate(GUITAR_OPEN_PITCHES):
        fret = pitch - open_pitch
        # Check if the fret is within the playable range and is the lowest found so far
        if 0 <= fret <= MAX_FRET and fret < min_fret:
            min_fret = fret
            # String number is 6 (low E) to 1 (high e)
            best_option = {"string": 6 - i, "fret": int(round(fret))}
    return best_option

def generate_tab_simple(pm: pretty_midi.PrettyMIDI, time_step=0.08):
    """
    Generates a guitar tablature from a PrettyMIDI object using the simple algorithm.
    """
    notes = [note for inst in pm.instruments if not inst.is_drum for note in inst.notes]
    if not notes:
        return "No valid musical notes detected in the MIDI file."

    notes.sort(key=lambda n: n.start)
    total_duration = pm.get_end_time()
    n_steps = int(np.ceil(total_duration / time_step))
    if n_steps == 0:
        return "Track is too short to process."

    # A list of lists to hold notes at each time step
    note_events = [[] for _ in range(n_steps)]
    for note in notes:
        start_step = int(note.start / time_step)
        if start_step < n_steps:
            note_events[start_step].append(note)

    # Initialize tab lines for each string
    tab_lines = {i: f"{s}|" for i, s in zip(range(1, 7), ['e', 'B', 'G', 'D', 'A', 'E'])}

    for step_notes in note_events:
        notes_on_strings = {}
        if step_notes:
            for note in step_notes:
                option = find_string_and_fret_simple(note.pitch)
                if option:
                    notes_on_strings[option['string']] = option['fret']

        # Determine width for formatting (to handle 2-digit fret numbers)
        is_two_digit = any(fret >= 10 for fret in notes_on_strings.values())
        width = 2 if is_two_digit else 1

        for i in range(1, 7):
            char_to_add = str(notes_on_strings[i]) if i in notes_on_strings else "-"
            tab_lines[i] += char_to_add.ljust(width, '-')

    # Join the lines into a single string
    return "\n".join(tab_lines.values()).strip()

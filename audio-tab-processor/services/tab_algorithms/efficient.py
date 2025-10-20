import numpy as np
import pretty_midi
from config import GUITAR_OPEN_PITCHES, MAX_FRET

def find_string_and_fret_efficient(pitch, last_positions):
    """
    Finds the guitar string and fret for a pitch, prioritizing minimal hand movement.
    It calculates a cost based on distance from the average fret of the last chord.
    """
    options = []
    for i, open_pitch in enumerate(GUITAR_OPEN_PITCHES):
        fret = pitch - open_pitch
        if 0 <= fret <= MAX_FRET:
            options.append({"string": 6 - i, "fret": int(round(fret))})

    if not options:
        return None
    # If it's the first note, just pick the one with the lowest fret number
    if not last_positions:
        return min(options, key=lambda x: x['fret'])

    # Calculate the average fret of the previously played notes
    avg_fret = sum(last_positions.values()) / len(last_positions)

    def calculate_cost(option):
        # Cost is a combination of distance from the average fret and a small penalty for higher frets
        fret_distance = abs(option['fret'] - avg_fret)
        fret_penalty = option['fret'] * 0.1 # Small bias towards lower frets
        return fret_distance + fret_penalty

    # Return the option with the lowest cost
    return min(options, key=calculate_cost)

def generate_tab_efficient(pm: pretty_midi.PrettyMIDI, time_step=0.08):
    """
    Generates a guitar tablature from a PrettyMIDI object using the efficient algorithm.
    """
    notes = [note for inst in pm.instruments if not inst.is_drum for note in inst.notes]
    if not notes:
        return "No valid musical notes detected in the MIDI file."

    notes.sort(key=lambda n: n.start)
    total_duration = pm.get_end_time()
    n_steps = int(np.ceil(total_duration / time_step))
    if n_steps == 0:
        return "Track is too short to process."

    note_events = [[] for _ in range(n_steps)]
    for note in notes:
        start_step = int(note.start / time_step)
        if start_step < n_steps:
            note_events[start_step].append(note)

    tab_lines = {i: f"{s}|" for i, s in zip(range(1, 7), ['e', 'B', 'G', 'D', 'A', 'E'])}
    last_fret_positions = {}

    for step_notes in note_events:
        current_notes_on_strings = {}
        if step_notes:
            for note in step_notes:
                option = find_string_and_fret_efficient(note.pitch, last_fret_positions)
                if option:
                    current_notes_on_strings[option['string']] = option['fret']

        is_two_digit = any(fret >= 10 for fret in current_notes_on_strings.values())
        width = 2 if is_two_digit else 1

        for i in range(1, 7):
            char_to_add = str(current_notes_on_strings[i]) if i in current_notes_on_strings else "-"
            tab_lines[i] += char_to_add.ljust(width, '-')

        # Update the last fret positions if any notes were played in this step
        if current_notes_on_strings:
            last_fret_positions = current_notes_on_strings

    return "\n".join(tab_lines.values()).strip()


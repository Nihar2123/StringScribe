def midi_to_hz(midi_note):
    """
    Converts a MIDI note number to its corresponding frequency in Hertz (Hz).
    Assumes A4 = 440 Hz.
    """
    if midi_note is None or midi_note <= 0:
        return None
    return 440 * (2 ** ((midi_note - 69) / 12))

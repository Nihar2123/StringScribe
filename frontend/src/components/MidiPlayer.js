import React, { useState } from "react";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

export default function MidiPlayer({ midiUrl }) {
    const [isPlaying, setIsPlaying] = useState(false);

    const handlePlay = async () => {
        if (!midiUrl) return;
        setIsPlaying(true);

        // Fetch and decode the MIDI file
        const response = await fetch(midiUrl);
        const arrayBuffer = await response.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        // Load a synth
        const synth = new Tone.PolySynth(Tone.Synth).toDestination();

        // Schedule all notes
        midi.tracks.forEach(track => {
            track.notes.forEach(note => {
                synth.triggerAttackRelease(
                    note.name,
                    note.duration,
                    note.time + Tone.now(),
                    note.velocity
                );
            });
        });

        // Start Tone.js audio context
        await Tone.start();
        setTimeout(() => setIsPlaying(false), midi.duration * 1000);
    };

    return (
        <button
            onClick={handlePlay}
            disabled={isPlaying}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
            {isPlaying ? "Playing..." : "Play MIDI"}
        </button>
    );
}

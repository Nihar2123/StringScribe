import React, { useRef, useEffect } from 'react';

const MidiVisualizer = ({ notesData, audioRef }) => {
    const canvasRef = useRef(null);
    const animationFrameId = useRef(null);

    useEffect(() => {
        if (!notesData || !notesData.notes || notesData.notes.length === 0) {
            // Don't draw if there's no data
            return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const { notes, end_time } = notesData;

        // --- START: ADAPTIVE PITCH RANGE LOGIC ---
        // 1. Find the actual min and max pitch from the provided notes
        let minPitch = 127;
        let maxPitch = 0;
        notes.forEach(note => {
            if (note.pitch < minPitch) minPitch = note.pitch;
            if (note.pitch > maxPitch) maxPitch = note.pitch;
        });

        // 2. Add a little vertical padding for better visuals
        minPitch = Math.max(0, minPitch - 3);
        maxPitch = Math.min(127, maxPitch + 3);

        const pitchRange = maxPitch - minPitch;
        // --- END: ADAPTIVE PITCH RANGE LOGIC ---


        // --- Configuration ---
        const noteHeight = 8;
        const noteSpacing = 2;

        // Resize canvas
        const width = canvas.parentElement.clientWidth;
        // The canvas height is now DYNAMIC based on the actual notes played
        const height = (noteHeight + noteSpacing) * (pitchRange + 1);
        canvas.width = width;
        canvas.height = height;

        const draw = () => {
            // Ensure the audio element is available before trying to get its time
            if (!audioRef.current) return;
            const currentTime = audioRef.current.currentTime;

            // Draw background
            context.fillStyle = '#282c34'; // Dark background
            context.fillRect(0, 0, width, height);

            // Draw faint horizontal lines for each pitch in our range
            for (let i = 0; i <= pitchRange; i++) {
                const pitch = maxPitch - i;
                const y = i * (noteHeight + noteSpacing);

                // Highlight C notes to act as visual guides
                if (pitch % 12 === 0) {
                    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
                    context.fillRect(0, y, width, noteHeight);
                }
            }

            // Draw the notes
            notes.forEach(note => {
                // The 'y' position is now calculated relative to our dynamic pitch range
                const y = (maxPitch - note.pitch) * (noteHeight + noteSpacing);
                const x = (note.start / end_time) * width;
                const w = Math.max(1, ((note.end - note.start) / end_time) * width);

                // Change color and opacity based on playback time
                const isPlayed = note.start <= currentTime;
                const opacity = isPlayed ? 1.0 : 0.7;
                const saturation = isPlayed ? 100 : 70;

                context.fillStyle = `hsla(210, ${saturation}%, 60%, ${opacity})`;
                context.fillRect(x, y, w, noteHeight);
            });

            // Draw the red playhead line
            if (audioRef.current && audioRef.current.duration > 0) {
                const playheadX = (currentTime / end_time) * width;
                context.fillStyle = '#ff5555';
                context.fillRect(playheadX, 0, 2, height);
            }

            // Loop the animation
            animationFrameId.current = requestAnimationFrame(draw);
        };

        draw();

        // Cleanup function to stop the animation when the component unmounts
        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };

    }, [notesData, audioRef]); // Rerun effect if notes or audioRef change

    return <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '4px' }} />;
};

export default MidiVisualizer;


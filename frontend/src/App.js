import React, { useState, useRef, useEffect, useCallback } from "react";
import MidiVisualizer from "./components/MidiVisualizer";
import Auth from "./components/Auth";

const midiToNoteName = (midiNumber) => {
    if (midiNumber < 0 || midiNumber > 127) return "";
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = notes[midiNumber % 12];
    return `${note}${octave}`;
};

function App() {
    // --- Authentication State ---
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoaded, setAuthLoaded] = useState(false);

    // --- State Management ---
    const [file, setFile] = useState(null);
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [status, setStatus] = useState("idle");
    const [progress, setProgress] = useState(0);
    const [midiUrl, setMidiUrl] = useState(null);
    const [wavUrl, setWavUrl] = useState(null);
    const [midiFilename, setMidiFilename] = useState(null);
    const [tabText, setTabText] = useState(null);
    const [error, setError] = useState(null);
    const [midiNotesData, setMidiNotesData] = useState(null);
    const [onsetThreshold, setOnsetThreshold] = useState(0.5);
    const [frameThreshold, setFrameThreshold] = useState(0.3);
    const [minNoteLength, setMinNoteLength] = useState(120);
    const [minPitch, setMinPitch] = useState(21);
    const [maxPitch, setMaxPitch] = useState(108);
    const [isTabScrolling, setIsTabScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(15);
    const [tabAlgorithm, setTabAlgorithm] = useState("efficient");

    const [activeJobId, setActiveJobId] = useState(null);

    // --- Refs ---
    const fileInputRef = useRef();
    const audioRef = useRef(null);
    const tabRef = useRef(null);
    const animationFrameRef = useRef(null);
    const initialTabGenerationDone = useRef(false); // Ref to track if the first tab has been generated

    const BACKEND_URL = "http://127.0.0.1:5001";

    // Check session on page load
    useEffect(() => {
        const checkLoggedIn = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/me`, { credentials: 'include' });
                if (res.ok) {
                    setCurrentUser(await res.json());
                }
            } catch (err) {
                console.error("Not logged in", err);
            } finally {
                setAuthLoaded(true);
            }
        };
        checkLoggedIn();
    }, []);

    // --- THIS IS THE FIX ---
    // This effect listens for changes in the tabAlgorithm state.
    useEffect(() => {
        // Only run this if the *initial* tab generation has already happened.
        // This prevents it from running on the first render.
        if (initialTabGenerationDone.current) {
            handleGenerateTabs();
        }
    }, [tabAlgorithm]); // The dependency array: this effect runs whenever 'tabAlgorithm' changes.
    // --- END OF FIX ---

    // Other effects (unchanged)
    useEffect(() => {
        if (status === "processing" || status === "generating_tabs") {
            let current = 0;
            const interval = setInterval(() => {
                current += Math.random() * 5; if (current >= 90) current = 90; setProgress(current);
            }, 400);
            return () => clearInterval(interval);
        } else if (status === "done" || status === "tabs_ready") {
            setProgress(100); setTimeout(() => setProgress(0), 2000);
        }
    }, [status]);

    useEffect(() => {
        if (isTabScrolling && tabRef.current) {
            const preElement = tabRef.current;
            const scrollStep = () => {
                preElement.scrollLeft += scrollSpeed / 50;
                if (preElement.scrollLeft < preElement.scrollWidth - preElement.clientWidth) {
                    animationFrameRef.current = requestAnimationFrame(scrollStep);
                } else { setIsTabScrolling(false); }
            };
            animationFrameRef.current = requestAnimationFrame(scrollStep);
        }
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [isTabScrolling, scrollSpeed]);

    // Authentication Handlers
    const handleAuthSuccess = (data) => {
        setCurrentUser(data.user);
    };

    const handleLogout = async () => {
        await fetch(`${BACKEND_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        setCurrentUser(null);
        resetAll();
    };

    // API Handlers
    const handleGenerate = async (e) => {
        e.preventDefault();
        setError(null); setTabText(null); setMidiNotesData(null);
        initialTabGenerationDone.current = false; // Reset the ref on new MIDI generation
        setStatus("processing"); setProgress(5);

        try {
            const allParams = { onset_threshold: onsetThreshold, frame_threshold: frameThreshold, minimum_note_length: minNoteLength, minPitch: minPitch, maxPitch: maxPitch };
            const formData = new FormData();
            if (file) { formData.append("audio_file", file); }
            else if (youtubeUrl) { formData.append("youtube_url", youtubeUrl); }
            else { throw new Error("Please upload a file or provide a URL."); }

            Object.keys(allParams).forEach(key => formData.append(key, allParams[key]));

            const response = await fetch(`${BACKEND_URL}/api/process`, {
                method: "POST",
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Processing failed");

            setMidiUrl(data.midi_url || null);
            setWavUrl(data.wav_url || null);
            setMidiFilename(data.midi_filename || null);
            setActiveJobId(data.job_id || null);
            setStatus("done");

            if (data.midi_filename) {
                const notesResponse = await fetch(`${BACKEND_URL}/api/get_midi_notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ midi_filename: data.midi_filename })
                });
                const notesData = await notesResponse.json();
                if (notesResponse.ok) setMidiNotesData(notesData);
            }
        } catch (err) {
            setError(err.message); setStatus("error");
        }
    };

    const handleGenerateTabs = async () => {
        if (!activeJobId) {
            setError("Cannot generate tabs without a processed audio job.");
            return;
        }

        setStatus("generating_tabs"); setProgress(10);
        try {
            const res = await fetch(`${BACKEND_URL}/api/generate_tabs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    job_id: activeJobId,
                    algorithm: tabAlgorithm
                }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Tab generation failed");
            setTabText(j.tab_text || "");
            setStatus("tabs_ready");
            initialTabGenerationDone.current = true; // Mark that the first tab generation is done
        } catch (err) {
            setError(err.message); setStatus("error");
        }
    };

    const resetAll = () => {
        setFile(null); setYoutubeUrl(""); setMidiUrl(null); setWavUrl(null);
        setMidiFilename(null); setTabText(null); setError(null); setStatus("idle");
        setProgress(0); setMidiNotesData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setOnsetThreshold(0.5); setFrameThreshold(0.3); setMinNoteLength(120);
        setMinPitch(21); setMaxPitch(108);
        setIsTabScrolling(false);
        if (tabRef.current) tabRef.current.scrollLeft = 0;
        setTabAlgorithm("efficient");
        setActiveJobId(null);
        initialTabGenerationDone.current = false;
    };

    if (!authLoaded) {
        return <div style={{textAlign: 'center', marginTop: 50}}>Loading...</div>;
    }

    return (
        <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
            <h1>🎶 StringScribe — Audio → MIDI → Tabs</h1>

            {!currentUser ? (
                <Auth onAuthSuccess={handleAuthSuccess} />
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <strong>Welcome, {currentUser.username}!</strong>
                        <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#f44336", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                            Logout
                        </button>
                    </div>

                    <form onSubmit={handleGenerate} style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8, background: "#fafafa" }}>
                        <h2>Input Options</h2>
                        <div style={{ marginBottom: 12 }}><input type="text" value={youtubeUrl} onChange={(e) => { setYoutubeUrl(e.target.value); if (e.target.value) setFile(null); }} placeholder="Paste YouTube link (e.g. https://youtu.be/...)" style={{ width: "100%", padding: 8 }}/></div>
                        <div style={{ marginBottom: 12 }}><input ref={fileInputRef} type="file" accept="audio/*" disabled={!!youtubeUrl} onChange={(e) => setFile(e.target.files[0])}/></div>
                        <div><button type="submit" style={{ padding: "8px 16px", background: "#4caf50", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Generate MIDI</button><button type="button" style={{ marginLeft: 12, padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 4, cursor: "pointer" }} onClick={resetAll}>Reset</button></div>
                        <h3 style={{marginTop: 20, marginBottom: 10}}>Model Parameters</h3>
                        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px 20px"}}>
                            <div><div style={{display: 'flex', justifyContent: 'space-between'}}><label>Onset Threshold</label><strong>{onsetThreshold.toFixed(1)}</strong></div><input type="range" step="0.1" min="0.1" max="0.9" value={onsetThreshold} onChange={(e) => setOnsetThreshold(parseFloat(e.target.value))} style={{width: "100%", marginTop: 8}}/></div>
                            <div><div style={{display: 'flex', justifyContent: 'space-between'}}><label>Frame Threshold</label><strong>{frameThreshold.toFixed(1)}</strong></div><input type="range" step="0.1" min="0.1" max="0.9" value={frameThreshold} onChange={(e) => setFrameThreshold(parseFloat(e.target.value))} style={{width: "100%", marginTop: 8}}/></div>
                            <div><div style={{display: 'flex', justifyContent: 'space-between'}}><label>Min. Note Length</label><strong>{minNoteLength} ms</strong></div><input type="range" step="10" min="50" max="500" value={minNoteLength} onChange={(e) => setMinNoteLength(parseInt(e.target.value))} style={{width: "100%", marginTop: 8}}/></div>
                        </div>
                        <h3 style={{marginTop: 20, marginBottom: 10}}>Pitch Range</h3>
                        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px 20px"}}>
                            <div><div style={{display: 'flex', justifyContent: 'space-between'}}><label>Min Pitch</label><strong>{midiToNoteName(minPitch)}</strong></div><input type="range" step="1" min="0" max="127" value={minPitch} onChange={(e) => setMinPitch(Math.min(parseInt(e.target.value), maxPitch - 1))} style={{width: "100%", marginTop: 8}}/></div>
                            <div><div style={{display: 'flex', justifyContent: 'space-between'}}><label>Max Pitch</label><strong>{midiToNoteName(maxPitch)}</strong></div><input type="range" step="1" min="0" max="127" value={maxPitch} onChange={(e) => setMaxPitch(Math.max(parseInt(e.target.value), minPitch + 1))} style={{width: "100%", marginTop: 8}}/></div>
                        </div>
                    </form>

                    <div style={{ marginTop: 20 }}><strong>Status:</strong> {status}{progress > 0 && ( <div style={{ height: 10, width: "100%", background: "#eee", borderRadius: 4, marginTop: 8 }}><div style={{ height: "100%", width: `${progress}%`, background: "#4caf50", borderRadius: 4, transition: "width 0.4s ease" }}/></div>)}</div>
                    {(status === "processing" || status === "generating_tabs") && ( <div style={{ marginTop: 20, textAlign: "center" }}><div style={{ width: 50, height: 50, border: "5px solid #ccc", borderTop: "5px solid #4caf50", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "15px auto" }}/><p>Processing your audio...</p></div>)}
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    {error && <div style={{ marginTop: 12, color: "red" }}>Error: {error}</div>}

                    <div style={{ marginTop: 20 }}>
                        {wavUrl && (<div><h3>🎧 Sonified Output</h3><audio ref={audioRef} controls src={wavUrl} key={wavUrl} style={{ width: "100%" }} /></div>)}
                        {midiNotesData && (
                            <div style={{ marginTop: '20px', padding: '15px', background: '#f7f7f7', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h3 style={{ margin: 0, fontSize: '1.2em', color: '#333' }}>🎵 MIDI Output</h3></div>
                                <div style={{ marginTop: '20px' }}><MidiVisualizer notesData={midiNotesData} audioRef={audioRef} /></div>
                            </div>
                        )}

                        {activeJobId && (status === 'done' || status === 'tabs_ready') && !tabText && (
                            <div style={{ marginTop: 20 }}>
                                <button onClick={handleGenerateTabs} style={{ padding: "8px 16px", background: "#2196f3", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Generate Tabs</button>
                            </div>
                        )}

                        {tabText && (
                            <div style={{ marginTop: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f0f0', padding: '10px 12px', borderRadius: '4px 4px 0 0', borderBottom: '1px solid #ddd' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1em' }}>🎸 Generated Tabs</h3>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.9em', color: '#555' }}>Algorithm:</span>
                                        <label style={{ cursor: 'pointer', fontWeight: tabAlgorithm === 'efficient' ? 'bold' : 'normal' }}><input type="radio" value="efficient" checked={tabAlgorithm === "efficient"} onChange={(e) => setTabAlgorithm(e.target.value)} /> Efficient</label>
                                        <label style={{ cursor: 'pointer', fontWeight: tabAlgorithm === 'simple' ? 'bold' : 'normal' }}><input type="radio" value="simple" checked={tabAlgorithm === "simple"} onChange={(e) => setTabAlgorithm(e.target.value)} /> Simple</label>
                                    </div>
                                </div>
                                <div style={{ background: '#f0f0f0', padding: '10px 12px', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <button onClick={() => setIsTabScrolling(!isTabScrolling)} style={{ padding: '4px 10px', minWidth: '80px' }}>{isTabScrolling ? 'Stop' : 'Start'} Scroll</button>
                                    <button onClick={() => { setIsTabScrolling(false); if(tabRef.current) tabRef.current.scrollLeft = 0; }} style={{ padding: '4px 10px' }}>Reset</button>
                                    <label style={{ marginLeft: 'auto' }}>Speed:</label>
                                    <input type="range" min="1" max="100" value={scrollSpeed} onChange={(e) => setScrollSpeed(parseInt(e.target.value))} style={{ width: '150px' }} />
                                </div>
                                <pre ref={tabRef} style={{ whiteSpace: "pre", overflowX: "auto", background: "#f0f0f0", padding: 12, borderRadius: '0 0 4px 4px', margin: 0 }}>{tabText}</pre>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default App;


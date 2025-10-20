import React, { useState, useRef, useEffect, useCallback } from "react";
import MidiVisualizer from "./components/MidiVisualizer";
import Auth from "./components/Auth";
import './App.css'; // <-- IMPORT THE NEW CSS FILE

const midiToNoteName = (midiNumber) => {
    if (midiNumber < 0 || midiNumber > 127) return "";
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(midiNumber / 12) - 1;
    const note = notes[midiNumber % 12];
    return `${note}${octave}`;
};

function App() {
    // --- Theme State ---
    const [theme, setTheme] = useState('light');

    // --- Authentication State ---
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoaded, setAuthLoaded] = useState(false);

    // --- History State ---
    const [history, setHistory] = useState([]);
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);

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

    const fileInputRef = useRef();
    const audioRef = useRef(null);
    const tabRef = useRef(null);
    const animationFrameRef = useRef(null);
    const initialTabGenerationDone = useRef(false);

    const BACKEND_URL = "http://127.0.0.1:5001";

    // --- Theme Effect ---
    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/my-jobs`, { credentials: 'include' });
            if (res.ok) {
                setHistory(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    }, []);

    // Check session on page load and fetch history
    useEffect(() => {
        const checkLoggedIn = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/me`, { credentials: 'include' });
                if (res.ok) {
                    setCurrentUser(await res.json());
                    fetchHistory();
                }
            } catch (err) {
                console.error("Not logged in", err);
            } finally {
                setAuthLoaded(true);
            }
        };
        checkLoggedIn();
    }, [fetchHistory]);

    // Re-generates tabs when algorithm is changed
    useEffect(() => {
        if (initialTabGenerationDone.current) {
            handleGenerateTabs();
        }
    }, [tabAlgorithm]);

    // Other effects (progress bar, tab scrolling)
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
        fetchHistory();
    };

    const handleLogout = async () => {
        await fetch(`${BACKEND_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        setCurrentUser(null);
        setHistory([]);
        resetAll();
    };

    // API and History Handlers
    const handleGenerate = async (e) => {
        e.preventDefault();
        setError(null); setTabText(null); setMidiNotesData(null);
        initialTabGenerationDone.current = false;
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

            const existingJobIndex = history.findIndex(job => job.job_id === data.job_id);
            if (existingJobIndex > -1) {
                const newHistory = [...history];
                newHistory[existingJobIndex] = data;
                setHistory(newHistory);
            } else {
                setHistory([data, ...history]);
            }

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
            initialTabGenerationDone.current = true;
        } catch (err) {
            setError(err.message); setStatus("error");
        }
    };

    const loadJob = (job) => {
        resetAll();
        setMidiUrl(job.midi_url);
        setWavUrl(job.wav_url);
        setMidiFilename(job.midi_filename);
        setActiveJobId(job.job_id);
        setStatus("done");

        if (job.midi_filename) {
            fetch(`${BACKEND_URL}/api/get_midi_notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ midi_filename: job.midi_filename })
            }).then(res => res.json()).then(notes => setMidiNotesData(notes));
        }
        window.scrollTo(0, 0);
    };

    const handleRenameJob = async (jobId, oldTitle) => {
        const newTitle = prompt("Enter a new name for this job:", oldTitle);
        if (!newTitle || newTitle === oldTitle) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title: newTitle })
            });
            const updatedJob = await res.json();
            if (!res.ok) throw new Error(updatedJob.error);

            setHistory(history.map(job => job.job_id === jobId ? updatedJob : job));
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (!window.confirm("Are you sure you want to delete this job? This cannot be undone.")) {
            return;
        }
        try {
            const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setHistory(history.filter(job => job.job_id !== jobId));
        } catch (err) {
            setError(err.message);
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
        <div className="app-container">
            <div className="app-header">
                <h1>🎶 StringScribe</h1>
                <div className="theme-toggle">
                    <span>Light</span>
                    <label className="switch">
                        <input type="checkbox" onChange={toggleTheme} checked={theme === 'dark'} />
                        <span className="slider"></span>
                    </label>
                    <span>Dark</span>
                </div>
            </div>

            {!currentUser ? (
                <div className="card">
                    <Auth onAuthSuccess={handleAuthSuccess} />
                </div>
            ) : (
                <>
                    <div className="app-header">
                        <h2>Welcome, {currentUser.username}!</h2>
                        <button onClick={handleLogout} className="btn btn-delete">
                            Logout
                        </button>
                    </div>

                    <div className="card">
                        <form onSubmit={handleGenerate}>
                            <h2>Input Options</h2>
                            <div style={{ marginBottom: 16 }}>
                                <input className="input-field" type="text" value={youtubeUrl} onChange={(e) => { setYoutubeUrl(e.target.value); if (e.target.value) setFile(null); }} placeholder="Paste YouTube link (e.g. https://youtu.be/...)" />
                            </div>
                            <div style={{ marginBottom: 24 }}>
                                <label className="file-input-label" htmlFor="audio-file">
                                    {file ? file.name : <span>Or click to upload an audio file</span>}
                                </label>
                                <input ref={fileInputRef} id="audio-file" type="file" accept="audio/*" disabled={!!youtubeUrl} onChange={(e) => setFile(e.target.files[0])} style={{ display: 'none' }} />
                            </div>

                            <h3>Model Parameters</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <div className="form-group-header"><label>Onset Threshold</label><strong>{onsetThreshold.toFixed(1)}</strong></div>
                                    <input type="range" step="0.1" min="0.1" max="0.9" value={onsetThreshold} onChange={(e) => setOnsetThreshold(parseFloat(e.target.value))} />
                                </div>
                                <div className="form-group">
                                    <div className="form-group-header"><label>Frame Threshold</label><strong>{frameThreshold.toFixed(1)}</strong></div>
                                    <input type="range" step="0.1" min="0.1" max="0.9" value={frameThreshold} onChange={(e) => setFrameThreshold(parseFloat(e.target.value))} />
                                </div>
                                <div className="form-group">
                                    <div className="form-group-header"><label>Min. Note Length</label><strong>{minNoteLength} ms</strong></div>
                                    <input type="range" step="10" min="50" max="500" value={minNoteLength} onChange={(e) => setMinNoteLength(parseInt(e.target.value))} />
                                </div>
                            </div>

                            <h3 style={{marginTop: 24}}>Pitch Range</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <div className="form-group-header"><label>Min Pitch</label><strong>{midiToNoteName(minPitch)}</strong></div>
                                    <input type="range" step="1" min="0" max="127" value={minPitch} onChange={(e) => setMinPitch(Math.min(parseInt(e.target.value), maxPitch - 1))} />
                                </div>
                                <div className="form-group">
                                    <div className="form-group-header"><label>Max Pitch</label><strong>{midiToNoteName(maxPitch)}</strong></div>
                                    <input type="range" step="1" min="0" max="127" value={maxPitch} onChange={(e) => setMaxPitch(Math.max(parseInt(e.target.value), minPitch + 1))} />
                                </div>
                            </div>

                            <div className="button-group">
                                <button type="submit" className="btn btn-primary">Generate MIDI</button>
                                <button type="button" className="btn btn-secondary" onClick={resetAll}>Reset</button>
                            </div>
                        </form>
                    </div>

                    {status !== 'idle' && status !== 'done' && (
                        <div className="card">
                            <div className="status-bar"><strong>Status:</strong> {status}</div>
                            {progress > 0 && (
                                <div className="progress-bar">
                                    <div className="progress-bar-inner" style={{ width: `${progress}%` }}/>
                                </div>
                            )}
                            {(status === "processing" || status === "generating_tabs") && (
                                <div style={{ textAlign: "center" }}>
                                    <div className="spinner" />
                                    <p>Processing your audio...</p>
                                </div>
                            )}
                            {error && <div className="error-message">Error: {error}</div>}
                        </div>
                    )}

                    {(wavUrl || midiNotesData || tabText) && (
                        <div className="card">
                            <h2>Results</h2>
                            {wavUrl && (
                                <>
                                    <h3>🎧 Sonified Output</h3>
                                    <audio ref={audioRef} controls src={wavUrl} key={wavUrl} style={{ width: "100%" }} />
                                </>
                            )}
                            {midiNotesData && (
                                <>
                                    <h3 style={{marginTop: 24}}>🎵 MIDI Output</h3>
                                    <MidiVisualizer notesData={midiNotesData} audioRef={audioRef} />
                                </>
                            )}

                            {activeJobId && (status === 'done' || status === 'tabs_ready') && !tabText && (
                                <div className="button-group">
                                    <button onClick={handleGenerateTabs} className="btn btn-primary">Generate Tabs</button>
                                </div>
                            )}

                            {tabText && (
                                <>
                                    <div className="tab-header">
                                        <h3>🎸 Generated Tabs</h3>
                                        <div className="radio-group">
                                            <span>Algorithm:</span>
                                            <label><input type="radio" value="efficient" checked={tabAlgorithm === "efficient"} onChange={(e) => setTabAlgorithm(e.target.value)} /> Efficient</label>
                                            <label><input type="radio" value="simple" checked={tabAlgorithm === "simple"} onChange={(e) => setTabAlgorithm(e.target.value)} /> Simple</label>
                                        </div>
                                    </div>
                                    <div className="tab-controls">
                                        <button className="btn btn-small" onClick={() => setIsTabScrolling(!isTabScrolling)}>{isTabScrolling ? 'Stop' : 'Start'} Scroll</button>
                                        <button className="btn btn-small" onClick={() => { setIsTabScrolling(false); if(tabRef.current) tabRef.current.scrollLeft = 0; }}>Reset</button>
                                        <label>Speed:</label>
                                        <input type="range" min="1" max="100" value={scrollSpeed} onChange={(e) => setScrollSpeed(parseInt(e.target.value))} style={{ width: '150px' }} />
                                    </div>
                                    <pre ref={tabRef} className="tab-content">{tabText}</pre>
                                </>
                            )}
                        </div>
                    )}

                    <div className="card">
                        <h2 className="history-title" onClick={() => setIsHistoryVisible(!isHistoryVisible)}>
                            <span>My Processed MIDI</span>
                            <span style={{ fontSize: '0.8em' }}>{isHistoryVisible ? '▼' : '►'}</span>
                        </h2>

                        {isHistoryVisible && (
                            history.length === 0 ? (
                                <p>You haven't processed any audio yet.</p>
                            ) : (
                                <ul className="history-list">
                                    {history.map(job => (
                                        <li key={job.job_id} className="history-item">
                                            <div className="history-item-info">
                                                <strong>{job.title}</strong>
                                                <div>{new Date(job.created_at).toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <button onClick={() => loadJob(job)} className="btn btn-small btn-load btn-action">Load</button>
                                                <button onClick={() => handleRenameJob(job.job_id, job.title)} className="btn btn-small btn-rename btn-action">Rename</button>
                                                <button onClick={() => handleDeleteJob(job.job_id)} className="btn btn-small btn-delete">Delete</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default App;


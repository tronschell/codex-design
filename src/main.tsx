import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { canvasProfilingEnabled, recordCanvasCommit } from './canvas-profile';
import './styles.css';
import './tailwind.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode>{canvasProfilingEnabled ? <React.Profiler id="canvas-editor" onRender={recordCanvasCommit}><App /></React.Profiler> : <App />}</React.StrictMode>);

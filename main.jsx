import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode is intentionally off: it double-invokes effects, which would spin
// up two game loops / two audio contexts during development.
createRoot(document.getElementById('root')).render(<App />)

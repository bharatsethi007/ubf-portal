import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'

// Tracking domain only serves /t/<token>. Anything else goes to the main site.
if (window.location.hostname.startsWith('tracking.') && !window.location.pathname.startsWith('/t/')) {
  window.location.replace('https://ubfreight.com')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

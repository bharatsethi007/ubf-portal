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

// Customer portal lives on its own domain. Forward /portal/* (incl. set-password tokens) there.
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL || '').replace(/\/+$/, '')
if (PORTAL_URL && window.location.pathname.startsWith('/portal') && !PORTAL_URL.includes(window.location.hostname)) {
  const { pathname, search, hash } = window.location
  window.location.replace(`${PORTAL_URL}${pathname}${search}${hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

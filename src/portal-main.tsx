// Entry for the customer-only build (portal.ubfreight.com). Staff code is never bundled here.
import React from 'react'
import ReactDOM from 'react-dom/client'
import PortalApp from './PortalApp'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PortalApp />
  </React.StrictMode>,
)

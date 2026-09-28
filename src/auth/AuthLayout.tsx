import type { ReactNode } from 'react'
import loginArt from '../assets/login-illustration.png'
import ubLogo from '../assets/ub-logo.jpg'
import '../pages/loginPage.css'

// Shared split layout for login, forgot password and set password screens.
export default function AuthLayout({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-page__left" {...(overlay ? { inert: '' } : {})}>
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <img src={ubLogo} alt="UB Freight" style={{ height: 44, marginBottom: 28 }} />
          {children}
        </div>
      </div>
      <div className="login-art-panel">
        <div className="login-art-panel__card">
          <img src={loginArt} className="login-art-panel__img" alt="" />
        </div>
      </div>
      {overlay}
    </div>
  )
}

export const authStyles = {
  title: { fontSize: 24, fontWeight: 500, color: '#0A2472', margin: '0 0 8px' },
  sub: { fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 },
  input: {
    width: '100%', height: 44, padding: '0 12px', marginBottom: 16,
    border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box',
  },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
  link: { color: '#0A2472', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
} as const

export function primaryButton(disabled: boolean) {
  return {
    width: '100%', height: 44, marginTop: 8, border: 'none', borderRadius: 8,
    background: disabled ? '#94a3b8' : '#0A2472', color: '#fff', fontSize: 15, fontWeight: 500,
    cursor: disabled ? 'default' : 'pointer',
  } as const
}

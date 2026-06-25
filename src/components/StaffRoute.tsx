import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStaff } from '../hooks/useStaff'

type Props = { children: ReactNode }

export default function StaffRoute({ children }: Props) {
  const { isStaff, loading } = useStaff()

  if (loading) return <div className="muted pad">Loading…</div>
  if (!isStaff) return <Navigate to="/" replace />
  return <>{children}</>
}

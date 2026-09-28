import { avatarUrl } from '../../pages/users/staffProfileApi'

type Props = { path: string | null; name: string; size?: number; muted?: boolean }

// Photo if set, else initials on a soft blue circle.
export default function StaffAvatar({ path, name, size = 32, muted = false }: Props) {
  const url = avatarUrl(path)
  const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' as const,
    opacity: muted ? 0.5 : 1, filter: muted ? 'grayscale(1)' : undefined,
  }
  if (url) return <img src={url} alt="" style={base} />
  return (
    <span style={{ ...base, display: 'inline-grid', placeItems: 'center', background: '#E8EEFD', color: '#2563EB',
      fontSize: Math.round(size * 0.38), fontWeight: 600, letterSpacing: '.02em' }}>
      {initials}
    </span>
  )
}

import { pillClass } from '../utils/status'

export default function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${pillClass(status)}`}>{status}</span>
}

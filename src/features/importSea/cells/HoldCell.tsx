import { Badge } from '@/components/ui/badge'

type Props = {
  label: string | null
}

export default function HoldCell({ label }: Props) {
  if (!label?.trim()) return null
  return (
    <Badge variant="destructive" className="import-sea-hold-pill">
      {label}
    </Badge>
  )
}

import { Link } from 'react-router-dom'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  customerId: string | null
  name: string | null
}

export default function ClientCell({ customerId, name }: Props) {
  const label = name?.trim() || '—'
  const content = customerId ? (
    <Link
      to={`/customers/${customerId}`}
      className="link import-sea-client"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  ) : (
    <span className="import-sea-client">{label}</span>
  )

  if (label === '—') return content

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="import-sea-client-wrap" />}>
        {content}
      </TooltipTrigger>
      <TooltipContent>{name?.trim()}</TooltipContent>
    </Tooltip>
  )
}

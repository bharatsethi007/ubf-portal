import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  initials: string | null
  name: string | null
}

export default function HandledByCell({ initials, name }: Props) {
  const hasHandler = Boolean(initials?.trim() || name?.trim())
  const avatar = (
    <span
      className={`import-sea-handler${hasHandler ? '' : ' import-sea-handler--empty'}`}
      aria-hidden
    >
      {initials?.trim() || ''}
    </span>
  )

  if (!hasHandler) return avatar

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="import-sea-handler-wrap" />}>
        {avatar}
      </TooltipTrigger>
      <TooltipContent>{name?.trim() ?? initials}</TooltipContent>
    </Tooltip>
  )
}

import { Badge } from '@/components/ui/badge'

type Props = { matched: boolean }

export default function MatchBadge({ matched }: Props) {
  return matched ? (
    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      Synced
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Manual
    </Badge>
  )
}

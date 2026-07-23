import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { DocumentTag } from './documentTypes'

type Props = {
  tags: DocumentTag[]
  value: string | null
  onChange: (tagId: string | null) => void
  onCreateTag: (name: string) => Promise<DocumentTag>
  compact?: boolean
}

export default function DocumentTagMenu({ tags, value, onChange, onCreateTag, compact }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const label = tags.find((t) => t.id === value)?.name ?? 'Untagged'

  async function submitNewTag() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const tag = await onCreateTag(trimmed)
    onChange(tag.id)
    setNewName('')
    setCreating(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={`booking-doc-tag-trigger${compact ? ' booking-doc-tag-trigger--compact' : ''}`}
          >
            <Badge variant="outline">{label}</Badge>
            <ChevronDown size={12} />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onChange(null)}>Untagged</DropdownMenuItem>
        {tags.map((tag) => (
          <DropdownMenuItem key={tag.id} onClick={() => onChange(tag.id)}>
            {tag.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {creating ? (
          <div className="booking-doc-tag-new" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={newName}
              placeholder="New tag name"
              className="h-8"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitNewTag()
                if (e.key === 'Escape') setCreating(false)
              }}
            />
            <button type="button" className="text-link" onClick={() => void submitNewTag()}>
              Create
            </button>
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setCreating(true)}>New tag…</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

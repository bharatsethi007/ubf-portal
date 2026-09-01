import { useState } from 'react'
import { Mail, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { shareMeeting } from './meetingShare'

export default function MeetingShareButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Share meeting"
        title="Share"
        onClick={() => setOpen((o) => !o)}
      >
        <Share2 className="size-[18px]" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => {
                setOpen(false)
                void shareMeeting(meetingId, 'whatsapp')
              }}
            >
              <MessageCircle size={15} />
              WhatsApp
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => {
                setOpen(false)
                void shareMeeting(meetingId, 'email')
              }}
            >
              <Mail size={15} />
              Email
            </button>
          </div>
        </>
      )}
    </div>
  )
}

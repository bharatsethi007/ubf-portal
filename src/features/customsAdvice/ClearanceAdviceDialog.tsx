import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = { url: string | null; title: string; onClose: () => void }

/** In-app popup for the Clearance Advice PDF. Same frame as booking document preview. */
export default function ClearanceAdviceDialog({ url, title, onClose }: Props) {
  return (
    <Dialog open={Boolean(url)} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="sm:max-w-4xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="booking-doc-preview">
          {url ? <iframe title={title} src={url} className="booking-doc-preview__frame" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

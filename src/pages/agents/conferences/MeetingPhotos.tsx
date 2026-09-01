import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteMeetingPhoto,
  listMeetingPhotos,
  uploadMeetingPhoto,
  type MeetingPhoto,
} from './meetingPhotosApi'

export default function MeetingPhotos({ meetingId }: { meetingId: string }) {
  const [photos, setPhotos] = useState<MeetingPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listMeetingPhotos(meetingId)
      .then((p) => {
        if (!cancelled) setPhotos(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [meetingId])

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const added: MeetingPhoto[] = []
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue
        added.push(await uploadMeetingPhoto(meetingId, f))
      }
      if (added.length) setPhotos((prev) => [...prev, ...added])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(id: string) {
    try {
      await deleteMeetingPhoto(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove photo')
    }
  }

  return (
    <div className="border-t border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Photos
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          Add photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                onClick={() => void remove(p.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

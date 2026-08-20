import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import {
  addConferencePhoto,
  deleteConferencePhoto,
  uploadConferenceImage,
  type ConferencePhoto,
  type ViewMode,
} from './conferencesApi'

type Props = {
  conferenceId: string
  photos: ConferencePhoto[]
  viewMode: ViewMode
  onReload: () => void
}

export default function ConferencePhotos({
  conferenceId,
  photos,
  viewMode,
  onReload,
}: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const isDesktop = viewMode === 'desktop'

  async function handleUpload(file: File) {
    setBusy(true)
    try {
      const url = await uploadConferenceImage(conferenceId, file, 'gallery')
      await addConferencePhoto(conferenceId, url)
      toast.success('Photo added')
      onReload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(photoId: string) {
    setBusy(true)
    try {
      await deleteConferencePhoto(photoId)
      toast.success('Photo removed')
      onReload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cp-card">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Photos</h3>
        {isDesktop && (
          <>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn--inline quotes-page__new-btn"
              disabled={busy}
              onClick={() => uploadRef.current?.click()}
            >
              Upload photo
            </button>
          </>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="text-muted-foreground pad-inline">No photos yet.</p>
      ) : (
        <div
          className={`conf-photos-grid pad-inline${viewMode === 'mobile' ? ' conf-photos-grid--mobile' : ''}`}
        >
          {photos.map((photo) => (
            <div key={photo.id} className="conf-photo-item">
              <img src={photo.image_url} alt={photo.caption ?? 'Conference photo'} />
              {isDesktop && (
                <button
                  type="button"
                  className="conf-photo-item__delete"
                  aria-label="Delete photo"
                  disabled={busy}
                  onClick={() => void handleDelete(photo.id)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

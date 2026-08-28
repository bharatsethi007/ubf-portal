import { useEffect, useState } from 'react'
import { UserCheck, X } from 'lucide-react'
import SignaturePad from './SignaturePad'
import CheckinPhotoStrip from './CheckinPhotoStrip'
import { signCheckinPaths } from './checkinSheetApi'

type Props = {
  me: string
  deliveredByName?: string
  signatureDataUrl: string | null
  onSignature: (url: string | null) => void
  existingSignaturePath: string | null
  onClearExistingSignature: () => void
  photoFiles: File[]
  onPhotoFiles: (files: File[]) => void
  existingPhotoPaths: string[]
  onRemoveExistingPhoto: (path: string) => void
}

export default function CheckinSignoffSection(props: Props) {
  const {
    me, deliveredByName, signatureDataUrl, onSignature, existingSignaturePath, onClearExistingSignature,
    photoFiles, onPhotoFiles, existingPhotoPaths, onRemoveExistingPhoto,
  } = props
  const [signed, setSigned] = useState<Record<string, string>>({})
  const photoKey = existingPhotoPaths.join('|')

  useEffect(() => {
    const paths = [existingSignaturePath, ...existingPhotoPaths].filter(Boolean) as string[]
    if (!paths.length) { setSigned({}); return }
    let alive = true
    signCheckinPaths(paths).then((m) => { if (alive) setSigned(m) }).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSignaturePath, photoKey])

  const showExistingSig = Boolean(existingSignaturePath) && !signatureDataUrl

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[13px] text-neutral-700">
          <UserCheck size={15} className="text-[#0A2472]" /><span className="text-neutral-500">Received by</span>
          <span className="font-medium text-neutral-800">{me || '—'}</span>
          {deliveredByName && <span className="ml-auto text-xs text-neutral-400">Driver: {deliveredByName}</span>}
        </div>
        {showExistingSig ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Signature</span>
            <div className="relative rounded-lg border border-neutral-300 bg-white p-2">
              {signed[existingSignaturePath as string]
                ? <img src={signed[existingSignaturePath as string]} alt="Signature" className="h-[120px] w-full object-contain" />
                : <div className="flex h-[120px] items-center justify-center text-xs text-neutral-400">Loading…</div>}
              <button type="button" onClick={onClearExistingSignature} className="absolute right-2 top-2 rounded-md border border-neutral-200 bg-white/90 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800">Replace</button>
            </div>
          </div>
        ) : (
          <SignaturePad label="Signature" value={signatureDataUrl} onChange={onSignature} />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">Photos</span>
        {existingPhotoPaths.length > 0 && (
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {existingPhotoPaths.map((p) => (
              <div key={p} className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200">
                {signed[p] ? <img src={signed[p]} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-neutral-100" />}
                <button type="button" onClick={() => onRemoveExistingPhoto(p)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white" aria-label="Remove photo"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <CheckinPhotoStrip files={photoFiles} onChange={onPhotoFiles} />
      </div>
    </div>
  )
}

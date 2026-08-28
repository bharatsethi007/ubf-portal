import { useEffect, useState, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'

type Props = {
  files: File[]
  onChange: (files: File[]) => void
  label?: string
}

/** Tablet-friendly photo capture. `capture="environment"` opens the rear camera on mobile/tablet. */
export default function CheckinPhotoStrip({ files, onChange, label }: Props) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  function add(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) onChange([...files, ...picked])
    e.target.value = ''
  }
  function remove(i: number) {
    onChange(files.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-neutral-500">{label}</span>}
      <div className="flex flex-wrap items-center gap-2">
        {urls.map((u, i) => (
          <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label="Remove photo"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-50">
          <Camera size={18} />
          <span className="text-[10px]">Add</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={add} />
        </label>
      </div>
    </div>
  )
}

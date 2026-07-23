import { useRef } from 'react'
import { Upload } from 'lucide-react'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*'

type Props = {
  dragOver: boolean
  onDragOver: (over: boolean) => void
  onFiles: (files: FileList | File[]) => void
}

export default function DocumentUploadZone({ dragOver, onDragOver, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className={`bf-docs__drop booking-docs-drop${dragOver ? ' bf-docs__drop--over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(true)
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDragOver(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        className="bf-docs__input"
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Upload size={18} className="booking-docs-drop__icon" />
      <p className="bf-docs__drop-text">Drop files anywhere on this tab, or click to browse</p>
      <p className="bf-docs__drop-hint muted">PDF, images, Word, Excel · multiple files supported</p>
    </div>
  )
}

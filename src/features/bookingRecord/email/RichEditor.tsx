import { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Undo2, Redo2, RemoveFormatting } from 'lucide-react'

type Props = { html: string; resetKey: string; onChange: (html: string) => void }

type Btn = { title: string; icon: typeof Bold; on?: (e: Editor) => boolean; run: (e: Editor) => void }
const BTNS: (Btn | 'sep')[] = [
  { title: 'Bold', icon: Bold, on: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { title: 'Italic', icon: Italic, on: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { title: 'Underline', icon: Underline, on: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  'sep',
  { title: 'Bullet list', icon: List, on: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered list', icon: ListOrdered, on: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  {
    title: 'Link', icon: Link2, on: (e) => e.isActive('link'),
    run: (e) => {
      const prev = e.getAttributes('link').href as string | undefined
      const url = window.prompt('Link address', prev ?? 'https://')
      if (url === null) return
      if (!url.trim()) { e.chain().focus().unsetLink().run(); return }
      e.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
    },
  },
  { title: 'Clear formatting', icon: RemoveFormatting, run: (e) => e.chain().focus().unsetAllMarks().clearNodes().run() },
  'sep',
  { title: 'Undo', icon: Undo2, run: (e) => e.chain().focus().undo().run() },
  { title: 'Redo', icon: Redo2, run: (e) => e.chain().focus().redo().run() },
]

export default function RichEditor({ html, resetKey, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } })],
    content: html,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  })

  // New template picked: replace content without re-mounting.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(html, { emitUpdate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor])

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white focus-within:border-blue-500">
      <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
        {BTNS.map((b, i) =>
          b === 'sep' ? <span key={i} className="mx-1 h-4 w-px bg-slate-200" /> : (
            <button
              key={b.title} type="button" title={b.title} aria-label={b.title}
              disabled={!editor} onClick={() => editor && b.run(editor)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 ${editor && b.on?.(editor) ? 'bg-blue-50 text-blue-700' : ''}`}
            >
              <b.icon size={15} />
            </button>
          ),
        )}
      </div>
      <EditorContent
        editor={editor}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-slate-800 [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_p]:min-h-[1.4em] [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  )
}

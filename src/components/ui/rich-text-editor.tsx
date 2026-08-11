import { useEffect, useRef, useState } from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Image as ImageIcon, Italic, List, ListOrdered, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  disabled?: boolean
  placeholder?: string
  className?: string
}

// Editor rich-text para la descripción de las tarjetas: soporta negrita,
// listas e imágenes intercaladas (botón, pegar o arrastrar). `onUploadImage`
// lo inyecta el caller para no acoplar este componente genérico a Supabase.
export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  disabled = false,
  placeholder,
  className,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: "rounded-md max-w-full" } }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap-content text-sm focus:outline-none min-h-24 px-3 py-2",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // El value puede cambiar por fuera (form.reset al abrir el diálogo con
  // otra tarea): sin esto el editor se queda con el contenido de la tarjeta
  // anterior porque Tiptap no re-sincroniza `content` tras el mount.
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  const insertImage = async (file: File, targetEditor: Editor) => {
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      targetEditor.chain().focus().setImage({ src: url }).run()
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  if (!editor) return null

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background dark:bg-input/30",
        disabled && "opacity-50",
        className
      )}
    >
      {!disabled && (
        <div className="flex items-center gap-0.5 border-b border-input p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Negrita"
            aria-pressed={editor.isActive("bold")}
            className="aria-pressed:bg-muted"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cursiva"
            aria-pressed={editor.isActive("italic")}
            className="aria-pressed:bg-muted"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Lista"
            aria-pressed={editor.isActive("bulletList")}
            className="aria-pressed:bg-muted"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Lista numerada"
            aria-pressed={editor.isActive("orderedList")}
            className="aria-pressed:bg-muted"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Insertar imagen"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <ImageIcon />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) void insertImage(file, editor)
            }}
          />
        </div>
      )}
      <EditorContent
        editor={editor}
        onPaste={(e) => {
          const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
            f.type.startsWith("image/")
          )
          if (file) {
            e.preventDefault()
            void insertImage(file, editor)
          }
        }}
        onDrop={(e) => {
          const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
            f.type.startsWith("image/")
          )
          if (file) {
            e.preventDefault()
            void insertImage(file, editor)
          }
        }}
      />
    </div>
  )
}

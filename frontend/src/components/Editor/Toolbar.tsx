'use client'
import { Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough, Code, Link, Image,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Quote, Minus,
  Undo, Redo, Subscript, Superscript, Highlighter,
  Table, ChevronDown, Type, Palette
} from 'lucide-react'
import { useState, useRef } from 'react'

interface ToolbarProps {
  editor: Editor | null
}

const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72']
const HEADING_OPTIONS = [
  { label: 'Normal text', tag: 'paragraph' },
  { label: 'Heading 1', tag: 'h1', class: 'text-2xl font-normal' },
  { label: 'Heading 2', tag: 'h2', class: 'text-xl font-normal' },
  { label: 'Heading 3', tag: 'h3', class: 'text-base font-semibold' },
  { label: 'Heading 4', tag: 'h4', class: 'text-sm font-semibold' },
]

const COLORS = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
  '#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff',
  '#ff00ff','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6fa8dc','#8e7cc3',
]

const Divider = () => <div className="w-px h-5 bg-gray-300 mx-1" />

const Dropdown = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="toolbar-btn gap-1 px-2 min-w-0"
        type="button"
      >
        {label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-40">
            {children}
          </div>
        </>
      )}
    </div>
  )
}

export default function Toolbar({ editor }: ToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)

  if (!editor) return null

  const getHeadingLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1'
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2'
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3'
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4'
    return 'Normal text'
  }

  const setLink = () => {
    const url = prompt('Enter URL:')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = prompt('Enter image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-0.5 flex-wrap sticky top-[56px] z-10">
      {/* History */}
      <button className="toolbar-btn" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
        <Undo size={16} />
      </button>
      <button className="toolbar-btn" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
        <Redo size={16} />
      </button>

      <Divider />

      {/* Heading style */}
      <Dropdown label={<span className="text-xs w-24 text-left truncate">{getHeadingLabel()}</span>}>
        {HEADING_OPTIONS.map(opt => (
          <button
            key={opt.tag}
            onClick={() => {
              if (opt.tag === 'paragraph') editor.chain().focus().setParagraph().run()
              else editor.chain().focus().toggleHeading({ level: parseInt(opt.tag[1]) as 1|2|3|4 }).run()
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition ${opt.class || ''}`}
          >
            {opt.label}
          </button>
        ))}
      </Dropdown>

      <Divider />

      {/* Font size */}
      <Dropdown label={<span className="text-xs w-8 text-center">11</span>}>
        <div className="max-h-48 overflow-y-auto">
          {FONT_SIZES.map(size => (
            <button
              key={size}
              onClick={() => editor.chain().focus().setMark('textStyle', { fontSize: `${size}pt` }).run()}
              className="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50 transition"
            >
              {size}
            </button>
          ))}
        </div>
      </Dropdown>

      <Divider />

      {/* Text format */}
      <button className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
        <Bold size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
        <Italic size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
        <Underline size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough size={16} />
      </button>

      {/* Text color */}
      <div className="relative">
        <button className="toolbar-btn" onClick={() => setShowColorPicker(v => !v)} title="Text color">
          <div className="flex flex-col items-center">
            <Palette size={14} />
          </div>
        </button>
        {showColorPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 w-48">
              <div className="grid grid-cols-8 gap-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition"
                    style={{ background: color }}
                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false) }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <button className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`} onClick={() => setShowHighlightPicker(v => !v)} title="Highlight">
          <Highlighter size={16} />
        </button>
        {showHighlightPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowHighlightPicker(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 w-48">
              <div className="grid grid-cols-8 gap-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition"
                    style={{ background: color }}
                    onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); setShowHighlightPicker(false) }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Divider />

      {/* Alignment */}
      <button className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
        <AlignLeft size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
        <AlignCenter size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
        <AlignRight size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify">
        <AlignJustify size={16} />
      </button>

      <Divider />

      {/* Lists */}
      <button className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
        <List size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <ListOrdered size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
        <CheckSquare size={16} />
      </button>

      <Divider />

      {/* Other */}
      <button className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">
        <Quote size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline code">
        <Code size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('subscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript">
        <Subscript size={16} />
      </button>
      <button className={`toolbar-btn ${editor.isActive('superscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript">
        <Superscript size={16} />
      </button>
      <button className="toolbar-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus size={16} />
      </button>

      <Divider />

      {/* Link & Image */}
      <button className={`toolbar-btn ${editor.isActive('link') ? 'active' : ''}`} onClick={setLink} title="Insert link">
        <Link size={16} />
      </button>
      <button className="toolbar-btn" onClick={addImage} title="Insert image">
        <Image size={16} />
      </button>

      {/* Table */}
      <button className="toolbar-btn" onClick={insertTable} title="Insert table">
        <Table size={16} />
      </button>
    </div>
  )
}

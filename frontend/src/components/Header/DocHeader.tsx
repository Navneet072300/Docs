'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Share2, Star, Clock, MessageSquare, Check, Globe, Lock,
  UserPlus, X, Loader2, Download, Printer, Copy, Scissors, ClipboardPaste,
  RotateCcw, RotateCw, Search, Bold, Italic, Underline, Strikethrough,
  AlignLeft, List, Link, Image, Table, Minus, Code, Type, ChevronRight,
  SpellCheck, ZoomIn, ZoomOut, Maximize2, PanelLeft, StickyNote,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { DocData } from '@/app/doc/[id]/page'

interface DocHeaderProps {
  doc: DocData
  user: { id: string; name: string; email: string; avatar_color?: string }
  onTitleChange: (title: string) => void
  onToggleComments: () => void
  showComments: boolean
  wordCount: number
  editor?: any
}

// ─── Menu data ────────────────────────────────────────────────────────────────

type MenuItem =
  | { type: 'item'; label: string; shortcut?: string; icon?: React.ReactNode; action?: () => void; disabled?: boolean }
  | { type: 'separator' }
  | { type: 'submenu'; label: string; icon?: React.ReactNode; children: MenuItem[] }

const buildMenus = (
  router: ReturnType<typeof useRouter>,
  doc: DocData,
  editor: any,
  setShowShare: (v: boolean) => void,
  title: string,
): Record<string, MenuItem[]> => ({
  File: [
    { type: 'item', label: 'New document', icon: <FileText size={14} />, action: () => router.push('/dashboard') },
    { type: 'separator' },
    { type: 'item', label: 'Share', icon: <Share2 size={14} />, action: () => setShowShare(true) },
    { type: 'separator' },
    {
      type: 'submenu', label: 'Download', icon: <Download size={14} />, children: [
        { type: 'item', label: 'PDF (.pdf)', action: () => window.print() },
        { type: 'item', label: 'Plain text (.txt)', action: () => {
          const text = editor?.getText() || ''
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
          a.download = `${title}.txt`; a.click()
        }},
        { type: 'item', label: 'HTML (.html)', action: () => {
          const html = editor?.getHTML() || ''
          const a = document.createElement('a')
          a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
          a.download = `${title}.html`; a.click()
        }},
      ],
    },
    { type: 'item', label: 'Print', icon: <Printer size={14} />, shortcut: '⌘P', action: () => window.print() },
  ],
  Edit: [
    { type: 'item', label: 'Undo', icon: <RotateCcw size={14} />, shortcut: '⌘Z', action: () => editor?.chain().focus().undo().run(), disabled: !editor?.can().undo() },
    { type: 'item', label: 'Redo', icon: <RotateCw size={14} />, shortcut: '⌘Y', action: () => editor?.chain().focus().redo().run(), disabled: !editor?.can().redo() },
    { type: 'separator' },
    { type: 'item', label: 'Cut', icon: <Scissors size={14} />, shortcut: '⌘X', action: () => document.execCommand('cut') },
    { type: 'item', label: 'Copy', icon: <Copy size={14} />, shortcut: '⌘C', action: () => document.execCommand('copy') },
    { type: 'item', label: 'Paste', icon: <ClipboardPaste size={14} />, shortcut: '⌘V', action: () => document.execCommand('paste') },
    { type: 'separator' },
    { type: 'item', label: 'Select all', shortcut: '⌘A', action: () => editor?.chain().focus().selectAll().run() },
    { type: 'separator' },
    { type: 'item', label: 'Find and replace', icon: <Search size={14} />, shortcut: '⌘H', action: () => {
      const term = prompt('Find:'); if (!term) return
      const replace = prompt(`Replace "${term}" with:`) ?? ''
      const html = editor?.getHTML() || ''
      editor?.commands.setContent(html.replace(new RegExp(term, 'g'), replace))
    }},
  ],
  View: [
    { type: 'item', label: 'Comments', icon: <StickyNote size={14} />, action: () => {} },
    { type: 'separator' },
    { type: 'item', label: 'Zoom in', icon: <ZoomIn size={14} />, shortcut: '⌘+', action: () => {
      const el = document.querySelector('.tiptap-editor') as HTMLElement
      if (el) el.style.zoom = String(Math.min(2, parseFloat(el.style.zoom || '1') + 0.1))
    }},
    { type: 'item', label: 'Zoom out', icon: <ZoomOut size={14} />, shortcut: '⌘-', action: () => {
      const el = document.querySelector('.tiptap-editor') as HTMLElement
      if (el) el.style.zoom = String(Math.max(0.5, parseFloat(el.style.zoom || '1') - 0.1))
    }},
    { type: 'item', label: 'Reset zoom', icon: <Maximize2 size={14} />, action: () => {
      const el = document.querySelector('.tiptap-editor') as HTMLElement
      if (el) el.style.zoom = '1'
    }},
    { type: 'separator' },
    { type: 'item', label: 'Full screen', icon: <Maximize2 size={14} />, action: () => document.documentElement.requestFullscreen?.() },
  ],
  Insert: [
    { type: 'item', label: 'Image', icon: <Image size={14} />, action: () => {
      const url = prompt('Image URL:')
      if (url) editor?.chain().focus().setImage({ src: url }).run()
    }},
    { type: 'item', label: 'Link', icon: <Link size={14} />, shortcut: '⌘K', action: () => {
      const url = prompt('URL:')
      if (url) editor?.chain().focus().setLink({ href: url }).run()
    }},
    { type: 'separator' },
    { type: 'item', label: 'Table', icon: <Table size={14} />, action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { type: 'item', label: 'Horizontal line', icon: <Minus size={14} />, action: () => editor?.chain().focus().setHorizontalRule().run() },
    { type: 'separator' },
    {
      type: 'submenu', label: 'Special characters', icon: <Type size={14} />, children: [
        { type: 'item', label: '© Copyright', action: () => editor?.chain().focus().insertContent('©').run() },
        { type: 'item', label: '® Registered', action: () => editor?.chain().focus().insertContent('®').run() },
        { type: 'item', label: '™ Trademark', action: () => editor?.chain().focus().insertContent('™').run() },
        { type: 'item', label: '— Em dash', action: () => editor?.chain().focus().insertContent('—').run() },
        { type: 'item', label: '– En dash', action: () => editor?.chain().focus().insertContent('–').run() },
        { type: 'item', label: '… Ellipsis', action: () => editor?.chain().focus().insertContent('…').run() },
      ],
    },
    {
      type: 'submenu', label: 'Footnote', icon: <StickyNote size={14} />, children: [
        { type: 'item', label: 'Add footnote', action: () => editor?.chain().focus().insertContent('<sup>[1]</sup>').run() },
      ],
    },
  ],
  Format: [
    {
      type: 'submenu', label: 'Text', icon: <Type size={14} />, children: [
        { type: 'item', label: 'Bold', icon: <Bold size={14} />, shortcut: '⌘B', action: () => editor?.chain().focus().toggleBold().run() },
        { type: 'item', label: 'Italic', icon: <Italic size={14} />, shortcut: '⌘I', action: () => editor?.chain().focus().toggleItalic().run() },
        { type: 'item', label: 'Underline', icon: <Underline size={14} />, shortcut: '⌘U', action: () => editor?.chain().focus().toggleUnderline().run() },
        { type: 'item', label: 'Strikethrough', icon: <Strikethrough size={14} />, action: () => editor?.chain().focus().toggleStrike().run() },
        { type: 'separator' },
        { type: 'item', label: 'Superscript', action: () => editor?.chain().focus().toggleSuperscript().run() },
        { type: 'item', label: 'Subscript', action: () => editor?.chain().focus().toggleSubscript().run() },
      ],
    },
    {
      type: 'submenu', label: 'Paragraph styles', icon: <AlignLeft size={14} />, children: [
        { type: 'item', label: 'Normal text', action: () => editor?.chain().focus().setParagraph().run() },
        { type: 'item', label: 'Heading 1', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
        { type: 'item', label: 'Heading 2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { type: 'item', label: 'Heading 3', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      ],
    },
    {
      type: 'submenu', label: 'Align & indent', icon: <AlignLeft size={14} />, children: [
        { type: 'item', label: 'Align left', shortcut: '⌘⇧L', action: () => editor?.chain().focus().setTextAlign('left').run() },
        { type: 'item', label: 'Align center', shortcut: '⌘⇧E', action: () => editor?.chain().focus().setTextAlign('center').run() },
        { type: 'item', label: 'Align right', shortcut: '⌘⇧R', action: () => editor?.chain().focus().setTextAlign('right').run() },
        { type: 'item', label: 'Justify', shortcut: '⌘⇧J', action: () => editor?.chain().focus().setTextAlign('justify').run() },
      ],
    },
    { type: 'separator' },
    {
      type: 'submenu', label: 'Lists', icon: <List size={14} />, children: [
        { type: 'item', label: 'Bullet list', action: () => editor?.chain().focus().toggleBulletList().run() },
        { type: 'item', label: 'Numbered list', action: () => editor?.chain().focus().toggleOrderedList().run() },
        { type: 'item', label: 'Checklist', action: () => editor?.chain().focus().toggleTaskList().run() },
      ],
    },
    { type: 'separator' },
    { type: 'item', label: 'Inline code', icon: <Code size={14} />, shortcut: '⌘E', action: () => editor?.chain().focus().toggleCode().run() },
    { type: 'item', label: 'Block quote', action: () => editor?.chain().focus().toggleBlockquote().run() },
    { type: 'item', label: 'Code block', action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { type: 'separator' },
    { type: 'item', label: 'Clear formatting', action: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
  ],
  Tools: [
    { type: 'item', label: 'Spelling and grammar', icon: <SpellCheck size={14} />, shortcut: '⌘⌥X', action: () => {
      const el = document.querySelector('.tiptap-editor') as HTMLElement
      if (el) { el.spellcheck = !el.spellcheck }
    }},
    { type: 'separator' },
    { type: 'item', label: 'Word count', icon: <Type size={14} />, action: () => {
      const words = editor?.storage?.characterCount?.words() ?? 0
      const chars = editor?.storage?.characterCount?.characters() ?? 0
      alert(`Words: ${words}\nCharacters: ${chars}`)
    }},
    { type: 'separator' },
    { type: 'item', label: 'Preferences', icon: <PanelLeft size={14} />, action: () => alert('Preferences coming soon') },
  ],
})

// ─── Dropdown component ───────────────────────────────────────────────────────

function MenuDropdown({ label, items, isOpen, onOpen, onClose }: {
  label: string
  items: MenuItem[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  return (
    <div className="relative">
      <button
        onMouseDown={e => { e.preventDefault(); isOpen ? onClose() : onOpen() }}
        onMouseEnter={onOpen}
        className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer select-none
          ${isOpen ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
      >
        {label}
      </button>

      {isOpen && (
        <MenuPanel items={items} onClose={onClose} />
      )}
    </div>
  )
}

function MenuPanel({ items, onClose, offset = false }: { items: MenuItem[]; onClose: () => void; offset?: boolean }) {
  return (
    <div className={`absolute ${offset ? 'left-full top-0 -mt-1 ml-0.5' : 'left-0 top-full mt-0.5'} bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-52`}>
      {items.map((item, i) => {
        if (item.type === 'separator') return <div key={i} className="my-1 border-t border-gray-100" />

        if (item.type === 'submenu') return (
          <SubMenuItem key={i} item={item} onClose={onClose} />
        )

        return (
          <button
            key={i}
            disabled={item.disabled}
            onMouseDown={e => {
              e.preventDefault()
              if (!item.disabled) {
                item.action?.()
                onClose()
              }
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:bg-gray-50 active:bg-gray-100"
          >
            <span className="w-4 flex-shrink-0 text-gray-400">{item.icon}</span>
            <span className="flex-1 text-gray-700">{item.label}</span>
            {item.shortcut && <span className="text-xs text-gray-400 ml-4">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}

function SubMenuItem({ item, onClose }: { item: Extract<MenuItem, { type: 'submenu' }>; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 transition-colors">
        <span className="w-4 flex-shrink-0 text-gray-400">{item.icon}</span>
        <span className="flex-1 text-gray-700">{item.label}</span>
        <ChevronRight size={13} className="text-gray-400" />
      </button>
      {open && <MenuPanel items={item.children} onClose={onClose} offset />}
    </div>
  )
}

// ─── DocHeader ────────────────────────────────────────────────────────────────

export default function DocHeader({ doc, user, onTitleChange, onToggleComments, showComments, wordCount, editor }: DocHeaderProps) {
  const router = useRouter()
  const [title, setTitle] = useState(doc.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [isPublic, setIsPublic] = useState(doc.is_public)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const menuBarRef = useRef<HTMLDivElement>(null)
  const isOwner = doc.owner_id === user.id

  useEffect(() => { setTitle(doc.title) }, [doc.title])
  useEffect(() => { if (editingTitle) titleRef.current?.select() }, [editingTitle])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: MouseEvent) => {
      if (!menuBarRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  const handleTitleBlur = () => {
    setEditingTitle(false)
    if (title !== doc.title) onTitleChange(title)
  }

  const handleTitleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur() }
    if (e.key === 'Escape') { setTitle(doc.title); setEditingTitle(false) }
  }

  const togglePublic = async () => {
    if (!isOwner) return
    const next = !isPublic
    setIsPublic(next)
    try {
      await api.patch(`/documents/${doc.id}`, { is_public: next })
    } catch { setIsPublic(!next) }
  }

  const addCollaborator = async () => {
    if (!shareEmail.trim()) return
    setSharing(true)
    setShareStatus(null)
    try {
      await api.post(`/documents/${doc.id}/collaborators`, { email: shareEmail, permission: 'editor' })
      setShareStatus('success')
      setShareEmail('')
    } catch (err: any) {
      setShareStatus(err.message || 'Failed to add collaborator')
    } finally {
      setSharing(false)
    }
  }

  const menus = buildMenus(router, doc, editor, setShowShare, title)

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 sticky top-0 z-20">
      {/* Logo */}
      <button type="button" onClick={() => router.push('/dashboard')} title="Back to dashboard" className="text-blue-600 hover:text-blue-700 transition flex-shrink-0">
        <FileText size={28} />
      </button>

      <div className="flex flex-col min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center gap-1">
          {editingTitle ? (
            <input
              ref={titleRef}
              title="Document title"
              aria-label="Document title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKey}
              className="text-lg font-normal text-gray-800 border-b-2 border-blue-500 outline-none px-0 bg-transparent w-full max-w-sm"
            />
          ) : (
            <h1
              className="text-lg font-normal text-gray-800 truncate max-w-sm cursor-text hover:bg-gray-100 px-1 rounded transition"
              onClick={() => setEditingTitle(true)}
            >
              {title || 'Untitled document'}
            </h1>
          )}
          <button type="button" className="p-1 text-gray-400 hover:text-yellow-500 transition flex-shrink-0" title="Star document">
            <Star size={16} />
          </button>
        </div>

        {/* Menu bar */}
        <div ref={menuBarRef} className="flex items-center gap-0.5 px-0.5">
          {Object.entries(menus).map(([label, items]) => (
            <MenuDropdown
              key={label}
              label={label}
              items={items}
              isOpen={openMenu === label}
              onOpen={() => setOpenMenu(label)}
              onClose={() => setOpenMenu(null)}
            />
          ))}
        </div>
      </div>

      {/* Word count */}
      <span className="text-xs text-gray-400 hidden md:block flex-shrink-0">{wordCount} words</span>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <button
          type="button"
          onClick={onToggleComments}
          className={`p-2 rounded-full transition ${showComments ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Comments"
        >
          <MessageSquare size={18} />
        </button>
        <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition" title="Version history">
          <Clock size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowShare(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 transition"
        >
          <Share2 size={15} />
          Share
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium cursor-pointer flex-shrink-0 bg-indigo-600"
          data-color={user.avatar_color}
          style={user.avatar_color ? { background: user.avatar_color } : undefined}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowShare(false)} />
          <div className="fixed top-16 right-4 bg-white rounded-2xl shadow-2xl z-50 w-96 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-800">Share "{title}"</h2>
              <button type="button" title="Close" onClick={() => setShowShare(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {isOwner && (
              <div className="flex gap-2 mb-4">
                <input
                  type="email"
                  placeholder="Add people by email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCollaborator()}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={addCollaborator}
                  disabled={sharing || !shareEmail}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-1"
                >
                  {sharing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Add
                </button>
              </div>
            )}

            {shareStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 text-sm mb-3 bg-green-50 px-3 py-2 rounded-lg">
                <Check size={14} /> Collaborator added successfully
              </div>
            )}
            {shareStatus && shareStatus !== 'success' && (
              <p className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{shareStatus}</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-3 py-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: '#4f46e5' }}>
                  {doc.owner_name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.owner_name}</p>
                  <p className="text-xs text-gray-400">Owner</p>
                </div>
              </div>
              {doc.collaborators?.map(c => (
                <div key={c.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ background: c.avatar_color || '#4f46e5' }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.permission}</p>
                  </div>
                </div>
              ))}
            </div>

            {isOwner && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={togglePublic}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition ${isPublic ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {isPublic ? <Globe size={16} /> : <Lock size={16} />}
                  {isPublic ? 'Public – anyone with link can view' : 'Private – only collaborators'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  )
}

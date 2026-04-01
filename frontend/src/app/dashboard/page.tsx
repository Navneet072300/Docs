'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import {
  FileText, Plus, Search, Trash2, MoreVertical, LogOut,
  Clock, Users, Globe, Lock, Loader2
} from 'lucide-react'

interface Document {
  id: string
  title: string
  owner_id: string
  owner_name: string
  owner_color: string
  is_public: boolean
  updated_at: string
  created_at: string
}

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    try {
      const data = await api.get('/documents')
      setDocs(data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (authLoading) return          // wait for token verification
    if (!user) { router.replace('/'); return }
    fetchDocs()
  }, [user, router, fetchDocs, authLoading])

  const createDoc = async () => {
    setCreating(true)
    try {
      const doc = await api.post('/documents', { title: 'Untitled document' })
      router.push(`/doc/${doc.id}`)
    } catch {}
    finally { setCreating(false) }
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this document?')) return
    try {
      await api.delete(`/documents/${id}`)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch {}
    setMenuOpen(null)
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <FileText size={18} className="text-white" />
          </div>
          <span className="text-lg font-medium text-gray-700">Docs</span>
        </div>

        <div className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium cursor-pointer"
            style={{ background: user.avatar_color || '#4f46e5' }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <button onClick={logout} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Create new */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-600 mb-4">Start a new document</h2>
          <button
            onClick={createDoc}
            disabled={creating}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition group w-36 h-44"
          >
            {creating ? (
              <Loader2 size={32} className="text-blue-500 animate-spin mt-4" />
            ) : (
              <>
                <div className="w-24 h-32 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center group-hover:border-blue-300 transition mt-1">
                  <Plus size={28} className="text-gray-300 group-hover:text-blue-400 transition" />
                </div>
                <span className="text-xs text-gray-600 font-medium">Blank document</span>
              </>
            )}
          </button>
        </section>

        {/* Recent documents */}
        <section>
          <h2 className="text-sm font-medium text-gray-600 mb-4">
            {search ? `Results for "${search}"` : 'Recent documents'}
          </h2>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p>{search ? 'No documents match your search' : 'No documents yet. Create your first one!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => router.push(`/doc/${doc.id}`)}
                  className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition cursor-pointer group relative"
                >
                  {/* Document preview */}
                  <div className="h-36 bg-gradient-to-br from-gray-50 to-white rounded-t-xl border-b border-gray-100 flex items-start justify-start p-3 overflow-hidden">
                    <div className="w-full space-y-1.5">
                      <div className="h-2 bg-gray-200 rounded w-3/4" />
                      <div className="h-1.5 bg-gray-100 rounded w-full" />
                      <div className="h-1.5 bg-gray-100 rounded w-5/6" />
                      <div className="h-1.5 bg-gray-100 rounded w-4/6" />
                      <div className="h-1.5 bg-gray-100 rounded w-full" />
                      <div className="h-1.5 bg-gray-100 rounded w-3/4" />
                    </div>
                  </div>

                  {/* Doc info */}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.title || 'Untitled document'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{formatDate(doc.updated_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {doc.is_public ? <Globe size={11} className="text-gray-400" /> : <Lock size={11} className="text-gray-400" />}
                      <span className="text-xs text-gray-400 truncate">
                        {doc.owner_id === user.id ? 'You' : doc.owner_name}
                      </span>
                    </div>
                  </div>

                  {/* Menu */}
                  {doc.owner_id === user.id && (
                    <button
                      onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === doc.id ? null : doc.id) }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-white border border-gray-200 opacity-0 group-hover:opacity-100 transition hover:bg-gray-50"
                    >
                      <MoreVertical size={14} className="text-gray-500" />
                    </button>
                  )}
                  {menuOpen === doc.id && (
                    <div className="absolute top-8 right-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-32">
                      <button
                        onClick={e => deleteDoc(doc.id, e)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Close menu on outside click */}
      {menuOpen && <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />}
    </div>
  )
}

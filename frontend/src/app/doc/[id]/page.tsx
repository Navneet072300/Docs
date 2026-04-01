'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import DocHeader from '@/components/Header/DocHeader'
import Editor from '@/components/Editor/Editor'
import CommentsSidebar from '@/components/Sidebar/CommentsSidebar'
import { Loader2 } from 'lucide-react'

export interface DocData {
  id: string
  title: string
  owner_id: string
  owner_name: string
  is_public: boolean
  collaborators: Array<{ id: string; name: string; email: string; avatar_color: string; permission: string }>
}

export default function DocPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const docId = params.id as string

  const [doc, setDoc] = useState<DocData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showComments, setShowComments] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (authLoading) return          // wait for token verification
    if (!user) { router.replace('/'); return }
    api.get(`/documents/${docId}`)
      .then(data => { setDoc(data); setLoading(false) })
      .catch(() => { router.replace('/dashboard') })
  }, [docId, user, router, authLoading])

  const updateTitle = async (title: string) => {
    if (!doc) return
    setDoc(prev => prev ? { ...prev, title } : null)
    try {
      await api.patch(`/documents/${docId}`, { title })
    } catch {}
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Loading document...</p>
      </div>
    </div>
  )

  if (!doc) return null

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <DocHeader
        doc={doc}
        user={user}
        onTitleChange={updateTitle}
        onToggleComments={() => setShowComments(v => !v)}
        showComments={showComments}
        wordCount={wordCount}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto py-8 flex justify-center">
          <Editor
            docId={docId}
            user={user}
            onWordCountChange={setWordCount}
          />
        </div>

        {showComments && (
          <CommentsSidebar docId={docId} user={user} onClose={() => setShowComments(false)} />
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { X, Send, MessageSquare, Check, Trash2, Reply, ChevronDown } from 'lucide-react'

interface Comment {
  id: string
  content: string
  selection_text?: string
  user_name: string
  user_color: string
  user_id: string
  resolved: boolean
  created_at: string
  replies: Comment[]
}

interface CommentsSidebarProps {
  docId: string
  user: { id: string; name: string; avatar_color?: string }
  onClose: () => void
}

export default function CommentsSidebar({ docId, user, onClose }: CommentsSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.get(`/documents/${docId}/comments`)
      setComments(data)
    } catch {} finally { setLoading(false) }
  }, [docId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const addComment = async () => {
    if (!newComment.trim()) return
    try {
      const c = await api.post(`/documents/${docId}/comments`, { content: newComment })
      setComments(prev => [c, ...prev])
      setNewComment('')
    } catch {}
  }

  const addReply = async (parentId: string) => {
    if (!replyText.trim()) return
    try {
      const c = await api.post(`/documents/${docId}/comments`, { content: replyText, parent_id: parentId })
      setComments(prev => prev.map(com =>
        com.id === parentId ? { ...com, replies: [...com.replies, c] } : com
      ))
      setReplyText('')
      setReplyTo(null)
    } catch {}
  }

  const resolveComment = async (id: string, resolved: boolean) => {
    try {
      await api.patch(`/documents/${docId}/comments/${id}`, { resolved })
      setComments(prev => prev.map(c => c.id === id ? { ...c, resolved } : c))
    } catch {}
  }

  const deleteComment = async (id: string) => {
    try {
      await api.delete(`/documents/${docId}/comments/${id}`)
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {}
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const active = comments.filter(c => !c.resolved)
  const resolved = comments.filter(c => c.resolved)

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <MessageSquare size={16} className="text-blue-500" />
          Comments {active.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{active.length}</span>}
        </h2>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
          <X size={16} />
        </button>
      </div>

      {/* New comment */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: user.avatar_color || '#4f46e5' }}>
            {user.name.charAt(0)}
          </div>
          <div className="flex-1">
            <textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment() }}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
            {newComment.trim() && (
              <div className="flex justify-end mt-1">
                <button onClick={addComment} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-700 transition">
                  <Send size={12} />
                  Comment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Loading...</p>
        ) : active.length === 0 && resolved.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No comments yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {active.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                user={user}
                replyTo={replyTo}
                replyText={replyText}
                onReplyClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                onReplyChange={setReplyText}
                onReplySubmit={() => addReply(comment.id)}
                onResolve={() => resolveComment(comment.id, true)}
                onDelete={() => deleteComment(comment.id)}
                formatTime={formatTime}
              />
            ))}

            {resolved.length > 0 && (
              <>
                <button
                  onClick={() => setShowResolved(v => !v)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 transition"
                >
                  <ChevronDown size={14} className={`transition ${showResolved ? 'rotate-180' : ''}`} />
                  {resolved.length} resolved comment{resolved.length > 1 ? 's' : ''}
                </button>
                {showResolved && resolved.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    user={user}
                    replyTo={replyTo}
                    replyText={replyText}
                    onReplyClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    onReplyChange={setReplyText}
                    onReplySubmit={() => addReply(comment.id)}
                    onResolve={() => resolveComment(comment.id, false)}
                    onDelete={() => deleteComment(comment.id)}
                    formatTime={formatTime}
                    resolved
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment, user, replyTo, replyText, onReplyClick, onReplyChange, onReplySubmit, onResolve, onDelete, formatTime, resolved = false }: any) {
  return (
    <div className={`px-3 py-3 ${resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: comment.user_color || '#4f46e5' }}>
          {comment.user_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-gray-800">{comment.user_name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(comment.created_at)}</span>
          </div>
          {comment.selection_text && (
            <p className="text-xs text-gray-400 border-l-2 border-yellow-400 pl-2 mt-1 italic truncate">"{comment.selection_text}"</p>
          )}
          <p className="text-sm text-gray-700 mt-1">{comment.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1.5">
            <button onClick={onReplyClick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition">
              <Reply size={12} />
              Reply
            </button>
            <button onClick={onResolve} className={`flex items-center gap-1 text-xs transition ${resolved ? 'text-gray-400 hover:text-green-500' : 'text-gray-400 hover:text-green-500'}`}>
              <Check size={12} />
              {resolved ? 'Reopen' : 'Resolve'}
            </button>
            {comment.user_id === user.id && (
              <button onClick={onDelete} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies?.length > 0 && (
            <div className="mt-2 pl-2 border-l-2 border-gray-100 space-y-2">
              {comment.replies.map((reply: any) => (
                <div key={reply.id} className="flex gap-2 items-start">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: reply.user_color || '#4f46e5' }}>
                    {reply.user_name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-800">{reply.user_name} </span>
                    <span className="text-sm text-gray-700">{reply.content}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {replyTo === comment.id && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Reply..."
                value={replyText}
                onChange={e => onReplyChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onReplySubmit()}
                autoFocus
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <button onClick={onReplySubmit} className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition">
                <Send size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

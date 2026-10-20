import { useState, type FormEvent } from 'react'
import type { ReactionKind, ReactionState } from './reactionData'

const reactions: Array<{ kind: ReactionKind; emoji: string; label: string }> = [
  { kind: 'heart', emoji: '❤️', label: 'Thả tim' },
  { kind: 'laugh', emoji: '😂', label: 'Cười' },
  { kind: 'sad', emoji: '😢', label: 'Buồn' },
  { kind: 'angry', emoji: '😠', label: 'Giận' },
  { kind: 'wow', emoji: '😮', label: 'Bất ngờ' },
]

type ReactionPanelProps = {
  title: string
  state: ReactionState
  onReact: (kind: ReactionKind) => void
  onComment: (text: string) => void
}

function ReactionPanel({ title, state, onReact, onComment }: ReactionPanelProps) {
  const [comment, setComment] = useState('')
  const totalReactions = Object.values(state.counts).reduce((total, count) => total + count, 0)

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = comment.trim()
    if (!text) return
    onComment(text)
    setComment('')
  }

  return (
    <section className="mt-5 w-full rounded-2xl border border-rose-100 bg-white/90 p-4 text-left shadow-sm sm:p-5" aria-label={`Cảm xúc và bình luận: ${title}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-500">{totalReactions} lượt cảm xúc</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {reactions.map(({ kind, emoji, label }) => (
          <button
            key={kind}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => onReact(kind)}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-sm transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="font-medium text-gray-700">{state.counts[kind]}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">Bình luận ({state.comments.length})</h4>
        {state.comments.map((item, index) => (
          <p key={`${item.author}-${index}`} className="rounded-xl bg-rose-50/70 px-3 py-2 text-sm text-gray-700">
            <span className="mr-2 font-semibold text-rose-700">{item.author}</span>
            {item.text}
          </p>
        ))}
      </div>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submitComment}>
        <label className="sr-only" htmlFor={`comment-${title.replaceAll(' ', '-')}`}>Viết bình luận</label>
        <input
          id={`comment-${title.replaceAll(' ', '-')}`}
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Viết bình luận..."
          className="min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
        <button type="submit" disabled={!comment.trim()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          Gửi
        </button>
      </form>
    </section>
  )
}

export default ReactionPanel

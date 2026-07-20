/**
 * Render comment text with @mentions and #tags highlighted.
 */
export function CommentBody({ body }: { body: string }) {
  const parts = tokenize(body)
  return (
    <p className="comment-body mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <span key={i} className="comment-mention" title="Mention">
              @{part.value}
            </span>
          )
        }
        if (part.type === 'tag') {
          return (
            <span key={i} className="comment-tag" title="Tag">
              #{part.value}
            </span>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </p>
  )
}

type Part = { type: 'text' | 'mention' | 'tag'; value: string }

function tokenize(body: string): Part[] {
  const re =
    /(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@[A-Za-z][A-Za-z0-9._-]{0,40}|#[A-Za-z0-9_-]{1,40})/g
  const parts: Part[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    if (m.index > last) {
      parts.push({ type: 'text', value: body.slice(last, m.index) })
    }
    const raw = m[0]!
    if (raw.startsWith('@')) {
      parts.push({ type: 'mention', value: raw.slice(1) })
    } else {
      parts.push({ type: 'tag', value: raw.slice(1) })
    }
    last = m.index + raw.length
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) })
  if (!parts.length) parts.push({ type: 'text', value: body })
  return parts
}

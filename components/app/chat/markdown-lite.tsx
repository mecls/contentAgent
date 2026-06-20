import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight renderer for the agent's replies — a deliberately small Markdown
 * subset covering what the agent emits: headings, horizontal rules,
 * bold/italic/code inline, bullet lists, and numbered lists.
 */

// ── inline: **bold**, *italic*, `code` ───────────────────────────────────────
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      nodes.push(<em key={key++}>{m[2]}</em>)
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-neutral-200/70 px-1 py-0.5 font-mono text-[0.85em] break-words"
        >
          {m[3]}
        </code>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// ── block model ──────────────────────────────────────────────────────────────
type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'hr' }
  | { kind: 'ordered'; items: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'paragraph'; text: string }

const isBlank = (l: string) => /^\s*$/.test(l)
const isHeading = (l: string) => /^\s*#{1,6}\s+\S/.test(l)
const isHr = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l)
const isOrdered = (l: string) => /^\s*\d+\.\s+\S/.test(l)
const isBullet = (l: string) => /^\s*[-•*]\s+\S/.test(l)

function parse(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (isBlank(line)) {
      i++
      continue
    }

    if (isHeading(line)) {
      const m = line.match(/^\s*(#{1,6})\s+(.*)$/)!
      blocks.push({ kind: 'heading', level: m[1].length, text: m[2].trim() })
      i++
      continue
    }

    if (isHr(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    if (isOrdered(line)) {
      const items: string[] = []
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim())
        i++
      }
      blocks.push({ kind: 'ordered', items })
      continue
    }

    if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-•*]\s+/, '').trim())
        i++
      }
      blocks.push({ kind: 'bullets', items })
      continue
    }

    // paragraph: consecutive plain lines
    const para: string[] = []
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !isHeading(lines[i]) &&
      !isHr(lines[i]) &&
      !isOrdered(lines[i]) &&
      !isBullet(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ kind: 'paragraph', text: para.join('\n') })
  }

  return blocks
}

// ── render ───────────────────────────────────────────────────────────────────
export function MarkdownLite({
  text,
  streaming,
}: {
  text: string
  streaming?: boolean
}) {
  const blocks = parse(text)
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-800 [overflow-wrap:anywhere]">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <p
                key={i}
                className={cn(
                  'font-semibold text-neutral-900',
                  block.level <= 2 ? 'text-base' : 'text-sm',
                )}
              >
                {renderInline(block.text)}
              </p>
            )

          case 'hr':
            return <hr key={i} className="border-neutral-200" />

          case 'ordered':
            return (
              <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5">
                {block.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            )

          case 'bullets':
            return (
              <ul key={i} className="flex flex-col gap-1 pl-1">
                {block.items.map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-[var(--brand-accent)]">•</span>
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            )

          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {renderInline(block.text)}
              </p>
            )
        }
      })}
      {streaming ? (
        <span
          className={cn(
            'inline-block h-4 w-[2px] animate-pulse bg-[var(--brand-accent)]',
            text ? 'ml-0.5' : '',
          )}
          aria-hidden
        />
      ) : null}
    </div>
  )
}

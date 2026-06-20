'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarRange,
  FileText,
  Lightbulb,
  MessageSquarePlus,
  Newspaper,
  Plug,
  Trash2,
  Wrench,
} from 'lucide-react'
import { deleteConversationAction } from '@/app/actions/conversations'
import { cn } from '@/lib/utils'

interface ConversationLite {
  id: string
  title: string
}

export function Sidebar({
  email,
  conversations,
  pendingProposals,
  pendingIdeas,
  signOutAction,
}: {
  email: string
  conversations: ConversationLite[]
  pendingProposals: number
  pendingIdeas: number
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const activeConv = params.get('c')

  const navItems = [
    { href: '/app/ideas', label: 'Ideas', icon: Lightbulb, badge: pendingIdeas },
    { href: '/app/plan', label: 'Weekly plan', icon: CalendarRange },
    { href: '/app/posts', label: 'Posts', icon: FileText },
    { href: '/app/research', label: 'Research', icon: Newspaper },
    { href: '/app/integrations', label: 'Integrations', icon: Plug },
    {
      href: '/app/skills',
      label: 'Skills',
      icon: Wrench,
      badge: pendingProposals,
    },
  ]

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200/80 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Image
          src="/logo.png"
          alt="Miraside"
          width={32}
          height={32}
          priority
          className="h-8 w-8 rounded-lg"
        />
        <span className="text-sm font-semibold text-neutral-900">Miraside Content</span>
      </div>

      {/* New chat */}
      <div className="px-3">
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          New chat
        </Link>
      </div>

      {/* Conversation history */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2">
        <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
          Chats
        </p>
        {conversations.length === 0 ? (
          <p className="px-2 py-2 text-xs text-neutral-400">No chats yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((c) => {
              const active = pathname === '/app' && activeConv === c.id
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/app?c=${c.id}`}
                    className={cn(
                      'block truncate rounded-lg px-2 py-1.5 pr-8 text-sm transition-colors',
                      active
                        ? 'bg-[var(--brand-accent)]/10 font-medium text-[var(--brand-accent)]'
                        : 'text-neutral-600 hover:bg-neutral-100',
                    )}
                    title={c.title}
                  >
                    {c.title}
                  </Link>
                  <form
                    action={deleteConversationAction.bind(null, c.id)}
                    className="absolute top-1/2 right-1 -translate-y-1/2"
                  >
                    <button
                      type="submit"
                      aria-label="Delete chat"
                      className="rounded p-1 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Section nav */}
      <nav className="border-t border-neutral-200/70 px-2 py-2">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--brand-accent)]/10 font-medium text-[var(--brand-accent)]'
                  : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="rounded-full bg-[var(--brand-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-accent-foreground)]">
                  {badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Account footer */}
      <div className="flex items-center gap-2 border-t border-neutral-200/70 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-neutral-500" title={email}>
            {email}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

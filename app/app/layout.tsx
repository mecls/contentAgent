import { redirect } from 'next/navigation'
import { getUser, requireAccountId } from '@/lib/auth/session'
import { isOnboarded } from '@/lib/db/profile'
import { listConversations } from '@/lib/db/conversations'
import { Sidebar } from '@/components/app/sidebar'
import { signOut } from '@/app/actions/auth'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  const { accountId } = await requireAccountId()

  // New accounts must tune their skill first; existing ones (with a skill) pass.
  if (!(await isOnboarded(accountId))) redirect('/onboarding')

  const conversations = await listConversations(accountId)

  return (
    // Pin the app shell to the viewport height so the sidebar stays fixed and the
    // page region scrolls internally (otherwise long content grows the whole page).
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <Sidebar
        email={user.email ?? ''}
        conversations={conversations.map((c) => ({ id: c.id, title: c.title }))}
        signOutAction={signOut}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

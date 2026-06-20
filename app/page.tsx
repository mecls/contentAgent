import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth/session'

export default async function Home() {
  const user = await getUser()
  redirect(user ? '/app' : '/login')
}

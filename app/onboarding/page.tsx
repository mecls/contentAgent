import { redirect } from 'next/navigation'
import { getUser, requireAccountId } from '@/lib/auth/session'
import { isOnboarded } from '@/lib/db/profile'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ force?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/login')
  const { accountId } = await requireAccountId()

  const { force } = await searchParams
  // Already onboarded users skip the gate, unless they explicitly relaunch it
  // (?force=1) to add/personalize more skills.
  if (force !== '1' && (await isOnboarded(accountId))) {
    redirect('/app')
  }

  return <OnboardingWizard email={user.email ?? ''} />
}

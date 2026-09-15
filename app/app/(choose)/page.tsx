import { requireAccountId } from '@/lib/auth/session'
import { loadChooseState } from '@/lib/choose/inputs'
import { ChooseView } from '@/components/choose/choose-view'

/** Home: choose what to post next. Loading this page never calls a model. */
export default async function ChoosePage() {
  const { accountId } = await requireAccountId()
  const state = await loadChooseState(accountId)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Choose</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Pick what to write next. Nothing is generated until you ask.
          </p>
        </header>
        <ChooseView
          batch={state.batch}
          generating={state.generating}
          hasSkill={state.skillSlug !== null}
          researchCount={state.researchCount}
        />
      </div>
    </div>
  )
}

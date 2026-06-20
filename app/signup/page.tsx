import Image from 'next/image'
import Link from 'next/link'
import { signUp } from '@/app/actions/auth'
import { SITE_CONFIG } from '@/lib/site-config'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Miraside"
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-xl"
          />
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{SITE_CONFIG.brand}</h1>
            <p className="mt-1 text-sm text-neutral-500">Create your content studio account.</p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form action={signUp} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@miraside.co"
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-base outline-none focus:border-[var(--brand-accent)] sm:text-sm"
          />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Password (min 8 characters)"
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-base outline-none focus:border-[var(--brand-accent)] sm:text-sm"
          />
          <button
            type="submit"
            className="cta-shadow mt-1 h-11 rounded-xl bg-[var(--brand-accent)] text-sm font-medium text-[var(--brand-accent-foreground)]"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[var(--brand-accent)]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

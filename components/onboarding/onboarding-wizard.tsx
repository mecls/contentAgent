'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { PLATFORMS, GOALS } from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'

interface ProfileState {
  name: string
  role: string
  company: string
  oneLiner: string
  stage: string
  claims: string
  audience: string
  goal: string
  platforms: string[]
  pillars: string
  voiceFormality: 'casual' | 'balanced' | 'formal'
  voiceEmoji: boolean
  voiceEdge: 'measured' | 'balanced' | 'contrarian'
  constraints: string
  bannedTactics: string
  cadence: string
  timezone: string
  conversion: string
  inspiration: string
  pastWins: string
}

const STEPS = ['You', 'Audience', 'Platforms', 'Voice', 'Guardrails'] as const

export function OnboardingWizard({ email }: { email: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const startedRef = useRef(false)

  const [p, setP] = useState<ProfileState>(() => ({
    name: '',
    role: '',
    company: '',
    oneLiner: '',
    stage: '',
    claims: '',
    audience: '',
    goal: '',
    platforms: [],
    pillars: '',
    voiceFormality: 'balanced',
    voiceEmoji: false,
    voiceEdge: 'balanced',
    constraints: '',
    bannedTactics: '',
    cadence: '',
    timezone:
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : '',
    conversion: '',
    inspiration: '',
    pastWins: '',
  }))

  const set = <K extends keyof ProfileState>(k: K, v: ProfileState[K]) =>
    setP((prev) => ({ ...prev, [k]: v }))

  const togglePlatform = (id: string) =>
    setP((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(id)
        ? prev.platforms.filter((x) => x !== id)
        : [...prev.platforms, id],
    }))

  const validateStep = (): string | null => {
    if (step === 0 && !p.name.trim()) return 'Please add your name.'
    if (step === 1 && !p.audience.trim()) return 'Describe who you want to reach.'
    if (step === 1 && !p.goal) return 'Pick a primary goal.'
    if (step === 2 && p.platforms.length === 0) return 'Select at least one platform.'
    return null
  }

  const next = () => {
    const v = validateStep()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else void submit()
  }

  const back = () => {
    setError(null)
    if (step > 0) setStep((s) => s - 1)
  }

  const submit = async () => {
    if (startedRef.current) return
    startedRef.current = true
    setGenerating(true)
    setProgress(['Setting up…'])
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || `onboarding ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const line = evt.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          let payload: { step?: string; done?: boolean; error?: string }
          try {
            payload = JSON.parse(line.slice(6))
          } catch {
            continue
          }
          if (payload.step) setProgress((m) => [...m, payload.step!])
          else if (payload.done) {
            setProgress((m) => [...m, 'Done — taking you to your studio…'])
            router.push('/app')
            router.refresh()
            return
          } else if (payload.error) {
            throw new Error(payload.error)
          }
        }
      }
    } catch (e) {
      setGenerating(false)
      startedRef.current = false
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    }
  }

  if (generating) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[var(--brand-accent)]" aria-hidden />
          <h1 className="text-lg font-semibold text-neutral-900">
            Crafting your skill{p.platforms.length > 1 ? 's' : ''}…
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tailoring everything to you and your platform{p.platforms.length > 1 ? 's' : ''}. This takes a moment.
          </p>
          <ul className="mt-6 flex flex-col gap-1.5 text-left">
            {progress.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-neutral-600">
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                {m}
              </li>
            ))}
          </ul>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Miraside" width={40} height={40} priority className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Let&rsquo;s tune your content skill</h1>
            <p className="mt-1 text-sm text-neutral-500">
              A few questions so the agent writes exactly like you, for your audience.
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  i < step
                    ? 'bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]'
                    : i === step
                      ? 'border-2 border-[var(--brand-accent)] text-[var(--brand-accent)]'
                      : 'border border-neutral-200 text-neutral-400',
                )}
              >
                {i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              {i < STEPS.length - 1 ? <span className="h-px w-5 bg-neutral-200" /> : null}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          {step === 0 ? (
            <Section title="About you" hint="Who's posting, and what you can honestly claim.">
              <TextInput label="Your name" value={p.name} onChange={(v) => set('name', v)} placeholder="Miguel Carvalhal" />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Role / title" value={p.role} onChange={(v) => set('role', v)} placeholder="Founder" />
                <TextInput label="Company" value={p.company} onChange={(v) => set('company', v)} placeholder="Miraside" />
              </div>
              <TextInput label="What you do (one line)" value={p.oneLiner} onChange={(v) => set('oneLiner', v)} placeholder="I build AI agents for operators." />
              <SelectInput
                label="Stage"
                value={p.stage}
                onChange={(v) => set('stage', v)}
                options={[
                  ['', 'Select…'],
                  ['pre-launch', 'Pre-launch / building'],
                  ['early-traction', 'Early traction'],
                  ['established', 'Established / revenue'],
                ]}
              />
              <TextArea
                label="What can you honestly claim?"
                value={p.claims}
                onChange={(v) => set('claims', v)}
                placeholder="e.g. No shipped customers yet — keep claims forward-looking. Or: 3 paying clients, $X MRR."
              />
            </Section>
          ) : null}

          {step === 1 ? (
            <Section title="Audience & goal" hint="Who you're writing for, and why.">
              <TextArea
                label="Who do you want to reach? (ICP)"
                value={p.audience}
                onChange={(v) => set('audience', v)}
                placeholder="Roles, industries, company size, geography. e.g. Founders & ops leaders at $1–50M real-estate companies in the US & UAE."
              />
              <SelectInput
                label="Primary goal"
                value={p.goal}
                onChange={(v) => set('goal', v)}
                options={[['', 'Select…'], ...GOALS.map((g) => [g.id, g.label] as [string, string])]}
              />
            </Section>
          ) : null}

          {step === 2 ? (
            <Section title="Where do you post?" hint="Select all that apply — you'll get a tailored skill for each.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PLATFORMS.map((pl) => {
                  const on = p.platforms.includes(pl.id)
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => togglePlatform(pl.id)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                        on
                          ? 'border-[var(--brand-accent)] bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300',
                      )}
                    >
                      {on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      {pl.label}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Cadence" value={p.cadence} onChange={(v) => set('cadence', v)} placeholder="e.g. 3 posts / week" />
                <TextInput label="Timezone" value={p.timezone} onChange={(v) => set('timezone', v)} placeholder="Europe/Lisbon" />
              </div>
            </Section>
          ) : null}

          {step === 3 ? (
            <Section title="Voice & topics" hint="How you sound, and what you talk about.">
              <SelectInput
                label="Formality"
                value={p.voiceFormality}
                onChange={(v) => set('voiceFormality', v as ProfileState['voiceFormality'])}
                options={[
                  ['casual', 'Casual'],
                  ['balanced', 'Balanced'],
                  ['formal', 'Formal'],
                ]}
              />
              <SelectInput
                label="Edge"
                value={p.voiceEdge}
                onChange={(v) => set('voiceEdge', v as ProfileState['voiceEdge'])}
                options={[
                  ['measured', 'Measured'],
                  ['balanced', 'Balanced'],
                  ['contrarian', 'Contrarian'],
                ]}
              />
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={p.voiceEmoji}
                  onChange={(e) => set('voiceEmoji', e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Use emoji in posts
              </label>
              <TextArea
                label="Content pillars (3–5 themes)"
                value={p.pillars}
                onChange={(v) => set('pillars', v)}
                placeholder="e.g. AI for operators, lessons from building, the future of work, contrarian takes on hype."
              />
              <TextInput label="Accounts you admire (optional)" value={p.inspiration} onChange={(v) => set('inspiration', v)} placeholder="@names or styles you like" />
            </Section>
          ) : null}

          {step === 4 ? (
            <Section title="Guardrails & conversion" hint="What to avoid, and how readers become leads.">
              <TextArea
                label="Hard constraints / no-gos"
                value={p.constraints}
                onChange={(v) => set('constraints', v)}
                placeholder="Competitors not to attack, topics to avoid, compliance limits, employment conflicts…"
              />
              <TextArea
                label="Tactics to ban"
                value={p.bannedTactics}
                onChange={(v) => set('bannedTactics', v)}
                placeholder="e.g. no engagement-baiting CTAs ('comment X to get the PDF'), no fake urgency."
              />
              <TextArea
                label="How do readers convert?"
                value={p.conversion}
                onChange={(v) => set('conversion', v)}
                placeholder="e.g. DMs to book a call; newsletter signups; profile → Featured links."
              />
              <TextArea
                label="Past posts that worked (optional)"
                value={p.pastWins}
                onChange={(v) => set('pastWins', v)}
                placeholder="Paste 1–3 winners + their numbers, so the skill starts from what already lands."
              />
            </Section>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {/* Nav */}
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 disabled:opacity-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <button
              onClick={next}
              className="cta-shadow inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-medium text-[var(--brand-accent-foreground)]"
            >
              {step < STEPS.length - 1 ? 'Continue' : 'Craft my skill'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">{email}</p>
      </div>
    </main>
  )
}

// ── small field helpers ─────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
      />
    </label>
  )
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

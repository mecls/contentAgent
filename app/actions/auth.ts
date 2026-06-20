'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { provisionAccount } from '@/lib/auth/provision'

/** Email/password sign-in. Provisions the account (idempotent) on success. */
export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }
  if (data.user) {
    try {
      await provisionAccount(data.user)
    } catch (e) {
      console.error('[auth] provision on sign-in failed', e)
    }
  }
  redirect('/app')
}

/** Email/password sign-up. Provisions + seeds the skill, then routes the user. */
export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Email and password are required.'))
  }
  if (password.length < 8) {
    redirect('/signup?error=' + encodeURIComponent('Password must be at least 8 characters.'))
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }
  if (data.user) {
    try {
      await provisionAccount(data.user)
    } catch (e) {
      console.error('[auth] provision on sign-up failed', e)
    }
  }
  // If email confirmation is enabled in Supabase, no session is returned yet.
  if (data.session) {
    redirect('/app')
  }
  redirect('/login?message=' + encodeURIComponent('Check your email to confirm, then sign in.'))
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

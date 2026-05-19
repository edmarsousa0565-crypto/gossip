'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signUp(email: string, password: string, fullName: string) {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/feed')
  }

  async function signIn(email: string, password: string) {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/feed')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { signUp, signIn, signOut, loading, error }
}

'use client'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function LoginPage() {
  const { signIn, loading, error } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await signIn(fd.get('email') as string, fd.get('password') as string)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input name="email" type="email" placeholder="Email" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      <input name="password" type="password" placeholder="Password" required
        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors" />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-center text-muted text-sm">
        No account? <Link href="/register" className="text-white underline">Create one</Link>
      </p>
    </form>
  )
}

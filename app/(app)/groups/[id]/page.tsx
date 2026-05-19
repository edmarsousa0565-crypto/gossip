import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Image from 'next/image'

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: group } = await supabase.from('groups').select('*').eq('id', id).single()
  if (!group) notFound()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="relative h-48 bg-surface2">
          {group.cover_url && <Image src={group.cover_url} alt="" fill className="object-cover" />}
        </div>
        <div className="p-6">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && <p className="text-muted mt-2">{group.description}</p>}
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupCard from '@/components/groups/GroupCard'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Groups</h1>
        <button className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-colors">
          + Create Group
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(groups ?? []).map(group => (
          <GroupCard key={group.id} group={group as any} />
        ))}
      </div>
    </div>
  )
}

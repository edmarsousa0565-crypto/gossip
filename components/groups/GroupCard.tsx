import Image from 'next/image'
import Link from 'next/link'
import type { Group } from '@/lib/supabase/types'

export default function GroupCard({ group }: { group: Group }) {
  return (
    <Link href={`/groups/${group.id}`}
      className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-white/20 transition-colors block">
      <div className="relative h-32 bg-surface2">
        {group.cover_url && <Image src={group.cover_url} alt="" fill className="object-cover" />}
      </div>
      <div className="p-4">
        <h3 className="font-semibold">{group.name}</h3>
        {group.description && <p className="text-muted text-sm mt-1 line-clamp-2">{group.description}</p>}
      </div>
    </Link>
  )
}

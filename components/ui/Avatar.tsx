import Image from 'next/image'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  if (src) {
    return <Image src={src} alt={name} width={size} height={size}
      className={`rounded-full object-cover flex-shrink-0 ${className}`} />
  }
  return (
    <div style={{ width: size, height: size }}
      className={`rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold flex-shrink-0 ${className}`}>
      {initials}
    </div>
  )
}

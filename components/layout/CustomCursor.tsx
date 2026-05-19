'use client'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const xTo = gsap.quickTo(cursorRef.current, 'x', { duration: 0.4, ease: 'power3' })
    const yTo = gsap.quickTo(cursorRef.current, 'y', { duration: 0.4, ease: 'power3' })
    const onMove = (e: MouseEvent) => { xTo(e.clientX); yTo(e.clientY) }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  })

  return (
    <div ref={cursorRef}
      className="pointer-events-none fixed top-0 left-0 w-5 h-5 rounded-full bg-white mix-blend-difference z-[9999] -translate-x-1/2 -translate-y-1/2"
      style={{ willChange: 'transform' }} />
  )
}

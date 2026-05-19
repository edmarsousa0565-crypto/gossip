export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8 tracking-tight">GOSSIP</h1>
        {children}
      </div>
    </main>
  )
}

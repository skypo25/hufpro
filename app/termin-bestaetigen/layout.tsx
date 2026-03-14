export default function TerminBestaetigenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen py-10 px-4"
      style={{
        backgroundColor: '#F7F6F3',
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'rgba(247, 246, 243, 0.82)' }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-[560px]">{children}</div>
    </div>
  )
}

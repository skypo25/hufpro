import LogoutButton from './LogoutButton'

export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 h-16 border-b border-slate-200 bg-white/90 backdrop-blur flex items-center justify-end px-4 md:px-6 xl:px-8">
      <LogoutButton />
    </header>
  )
}
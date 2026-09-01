import AuthBootDismiss from '@/components/auth/AuthBootDismiss'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthBootDismiss />
      {children}
    </>
  )
}

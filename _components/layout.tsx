import Header from '@/components/header'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center">
      <Header />
      {children}
    </div>
  )
}

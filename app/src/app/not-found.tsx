import Link from 'next/link'
import { Ghost } from '@/components/ghost/Ghost'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <Ghost size="lg" className="mb-8" />

      <h1 className="text-2xl font-medium mb-2">Report Not Found</h1>

      <p className="text-[var(--text-mid)] text-center mb-8 max-w-md">
        This report doesn&apos;t exist or may have expired. Reports are
        available for 30 days after generation.
      </p>

      <Link href="/" className="form-button inline-block">
        Generate New Report →
      </Link>
    </main>
  )
}

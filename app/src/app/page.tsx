import { cookies } from 'next/headers'
import { experiments } from '@/lib/experiments/config'
import { HomePageControl } from '@/components/landing/HomePageControl'
import { HomePageB } from '@/components/landing/HomePageB'
import { HomePageC } from '@/components/landing/HomePageC'

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams
  const cookieStore = await cookies()

  // Allow URL param override for testing: ?variant=control or ?variant=variant-b
  const variantOverride = params.variant as string | undefined

  // Get variant from cookie (set by middleware)
  const experiment = experiments.homepage
  const cookieVariant = cookieStore.get(experiment.cookieName)?.value

  // Use override if provided, otherwise use cookie, default to control
  const variant = variantOverride || cookieVariant || 'control'

  // Render the appropriate homepage variant
  if (variant === 'variant-c') {
    return <HomePageC />
  }

  if (variant === 'variant-b') {
    return <HomePageB />
  }

  return <HomePageControl />
}

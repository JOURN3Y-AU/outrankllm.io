import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HiringBrand.io | Your Employer Brand in AI',
  description:
    'See how AI platforms describe your company to job seekers. Monitor and improve your employer brand visibility across ChatGPT, Claude, Gemini and more.',
  icons: {
    icon: [{ url: '/hiringbrand/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/hiringbrand/apple-icon.svg', type: 'image/svg+xml' }],
  },
}

export default function HiringBrandLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

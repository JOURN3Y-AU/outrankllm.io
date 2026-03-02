import { redirect } from 'next/navigation'

/**
 * Signup is disabled — HiringBrand is invite-only.
 * Redirect to the landing page where users can book a demo.
 */
export default function HiringBrandSignupPage() {
  redirect('/hiringbrand')
}

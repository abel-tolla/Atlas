import Link from 'next/link'

export function Placeholder({ view }: { view: string }) {
  return (
    <section className="placeholder card">
      <h2>{view} is coming soon</h2>
      <p>This demo shows the Today and Calendar views.</p>
      <Link href="/" className="btn btn--primary">
        Back to Today
      </Link>
    </section>
  )
}

interface PlaceholderProps {
  view: string
  onBack: () => void
}

export function Placeholder({ view, onBack }: PlaceholderProps) {
  return (
    <section className="placeholder card">
      <h2>{view} is coming soon</h2>
      <p>This demo shows the Today view.</p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        Back to Today
      </button>
    </section>
  )
}

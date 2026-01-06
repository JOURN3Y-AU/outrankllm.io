export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-status">
        <div className="status-dot amber" />
        Building in public
      </div>
      <div>© {new Date().getFullYear()}</div>
    </footer>
  )
}

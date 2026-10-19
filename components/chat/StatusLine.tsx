export function StatusLine({ text }: { text: string }) {
  return (
    <div className="status-line" role="status">
      <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      {text}
    </div>
  );
}

export function ReachBanner({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <div className="reach-banner" role="alert">
      <p>{detail ? <><strong>{title}</strong> {detail}</> : title}</p>
      <button className="text-btn" type="button" onClick={onRetry}>Retry</button>
    </div>
  );
}

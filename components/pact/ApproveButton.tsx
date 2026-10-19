export function ApproveButton({ disabled, onClick, retry }: { disabled: boolean; onClick: () => void; retry?: boolean }) {
  return (
    <button className="approve" type="button" disabled={disabled} onClick={onClick}>
      {disabled ? "Sent to Fo" : retry ? "Retry" : "Approve"}
    </button>
  );
}

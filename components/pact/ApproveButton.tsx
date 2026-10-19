export function ApproveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button className="primary-btn" type="button" disabled={disabled} onClick={onClick}>
      {disabled ? "Sent to Fo" : "Approve"}
    </button>
  );
}

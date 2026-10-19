import type { Action } from "../../lib/model";

export function Journal({ actions }: { actions: Action[] }) {
  if (!actions.length) return null;
  return (
    <details className="journal">
      <summary>{actions.length} {actions.length === 1 ? "run" : "runs"} in this Pact</summary>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>{action.title} · {action.status}</li>
        ))}
      </ul>
    </details>
  );
}

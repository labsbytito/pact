/** Status verbs shown under the companion. Never a generic "Working…". */

export function pactStep(input: {
  reading?: boolean;
  streaming?: boolean;
  status?: string;
}): string {
  if (input.reading) return "Reading the page…";
  if (input.streaming) return "Writing a reply…";
  if (input.status === "proposed") return "Waiting for your approval";
  if (input.status === "approved" || input.status === "running") return "Asking Fo…";
  if (input.status === "needs_answer") return "Fo has a question";
  return "";
}

/** The one status line, shown in the pill above the composer. */
export function liveLine(input: {
  reading?: boolean;
  streaming?: boolean;
  status?: string;
  hasPage?: boolean;
}): string {
  const step = pactStep(input);
  if (step) return step;
  if (input.status === "returned") return "Fo replied";
  if (input.status === "failed") return "Fo couldn't finish that";
  if (input.status === "cancelled" || input.status === "superseded") return "That step was cancelled";
  return input.hasPage ? "Here with this page" : "Here when you are";
}

export function companionThinking(input: {
  reading?: boolean;
  streaming?: boolean;
  status?: string;
}): boolean {
  return Boolean(
    input.reading ||
      input.streaming ||
      input.status === "approved" ||
      input.status === "running",
  );
}

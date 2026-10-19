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

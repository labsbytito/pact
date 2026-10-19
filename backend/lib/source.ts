import { z } from "zod";

// Keep the user's visible/selected context through request validation. Browser
// tab and window identifiers stay local; they are not useful model context.
export const sourceSchema = z.object({
  title: z.string().max(1000),
  url: z.string().max(12000),
  description: z.string().max(4000),
  text: z.string().max(50000),
  selection: z.string().max(6000),
  capturedAt: z.string().optional(),
  captureMode: z.enum(["page", "selection", "picked"]).optional(),
  viewportText: z.string().max(12000).optional(),
  selectionContext: z.string().max(6000).optional(),
  selectionLabel: z.string().max(200).optional(),
  pageTextPartial: z.boolean().optional(),
  videoTime: z.number().finite().nonnegative().optional(),
  transcript: z.array(
    z.object({ start: z.number().finite().nonnegative(), text: z.string() }),
  ),
  transcriptPartial: z.boolean().optional(),
  transcriptStatus: z.enum(["available", "unavailable", "not-video"]),
});

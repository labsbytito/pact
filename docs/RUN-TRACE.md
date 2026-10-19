# Stage two verification — 18 October 2026

This is a human-readable trace of actual local tests, not a recording or an assertion that bookings/payments work. Credentials, account details and internal conversation handles are omitted.

## Real conversation → action → follow-up

1. In Pact's interface, requested public research on the British Museum's official general opening hours and visit-planning URL. Explicitly excluded contact, reservations, accounts and spending.
2. Sonnet 5.5 prepared a concrete `ask_fo` request. Opened the review sheet and approved that exact request.
3. The durable journal recorded one accepted run. Pact displayed working status. Reloaded the interface and reopened the saved Pact without submitting again.
4. Fo returned researched visit information and `https://www.britishmuseum.org/visit`. Fo disclosed that direct page fetches were blocked and it used indexed official page text. This records Fo's returned research, not an independent certification of every fact.
5. Asked for the official accessibility-planning URL. The first interpretation unnecessarily repeated the original research: inspection showed the model did not receive prior Fo results. Fixed interpretation to include bounded real journal activity and give the latest user message priority.
6. Retested the focused follow-up, reviewed it and submitted. Fo returned `https://www.britishmuseum.org/visit/accessibility-museum` and a related accessibility-statement link. The private per-Pact thread mapping retained continuity. Both runs remained in history.

## Installed Chrome capture

- Long-page fixture: visible lower section contained CEDAR-482, away from unrelated content at the top. Source inspection showed the actual visible section.
- Picked the intended item, including its button. The page still reported “No page action fired.” The selected source contained that item's text, not the adjacent LANTERN-913 item.
- Escape cancellation was tested. A Chrome injected-function exception lost its useful cancellation message; fixed by returning a small serialized error envelope and treating cancellation as a normal exit.
- Earlier live checks covered Wikipedia and Reddit text capture, and YouTube metadata/playback position with explicit unavailable-transcript disclosure.

## Additional checks

- 61 automated tests cover durable approvals, duplicate/lost-response protection, restart uncertainty, malformed replies, Fo follow-up state, thread isolation on disconnect, AI errors/budgets, source metadata, character persistence/variation, context budgets, stale tab/navigation rejection and cancellation envelopes.
- TypeScript check and production build passed. UI was inspected at compact and desktop widths.
- Claude Code's own Fo MCP authenticated through supported OAuth; `list_fo_conversations` was actually called once successfully. No private records are reproduced here.

## Remaining limits

YouTube captions depend on available captions and changing site structure. Embedded-frame selections may require opening their source page separately. The context-menu handoff has automated coverage; a reliable manual native-menu test was limited by intermittent Computer Use window/capture failures. Actual Fo “needs answer” variants have stress-test coverage; no real booking/contact flow was attempted. The local companion and Claude CLI testing adapter must remain running. This is a single-user local build.

# Pact

**The action layer for the internet**  
**Too many tabs. Too little action.**

> Living product overview. This document describes the vision and current thinking, not a commitment to build every idea. Update it whenever the product changes.

## 1. What is Pact?

Pact is a Chrome extension that turns things people discover on the internet into meaningful, real-world action.

People find places they want to visit, things they want to learn, experiences they want to try, and opportunities they want to pursue. They save a video, bookmark an article, or keep another tab open because it matters to them—but the next step often never happens.

Pact sits beside the page, understands what caught the person's attention, helps them express their intention, and makes the next step easier. Where an external action is needed, it can use Fo, with appropriate authorization, to act in the real world.

**See something. Want something. Make a Pact.**

## 2. What Pact is—and isn't

Pact is the **action layer for the internet**. It is not primarily a bookmark manager, task tracker, group-chat bot, or generic AI chatbot. A Pact is an intention that can progress, not just a link that is saved.

The experience should require less effort than opening a separate AI chat and explaining the entire webpage from scratch.

## 3. Example: a video about Japan

1. Someone watches a YouTube video showing places to visit in Japan.
2. They open Pact in Chrome's side panel without leaving the video.
3. Pact captures the page's title, URL, relevant description, available captions/transcript, and current playback position.
4. They type or dictate: *“I want to visit the town they were just talking about next year.”*
5. Pact uses the page context and relevant transcript timestamps to interpret which town they mean. The user can check or correct the interpretation.
6. Pact creates a card titled something like **Visit that town in Japan**, linked to the source.
7. Pact suggests a concrete next step, such as researching realistic travel costs or requesting information.
8. After the user approves an external action, Fo carries out a supported task. Pact displays the real status and result.

The exact suggested action depends on the user's intention, accessible information, and the capabilities the connected Fo account actually supports.

## 4. The Pact card

The Pact card is the core product element: a welcoming, readable record of something someone wants to do.

A card may hold:

- **Intention:** what the person hopes to do, in their own words.
- **Source:** the original page and, where useful, a particular video timestamp or selected passage.
- **Context:** the important details Pact understood from the page.
- **Next step:** one clear, actionable suggestion.
- **Status:** ready, awaiting approval, in progress, completed, or needs attention.
- **History and outcome:** what was attempted, what actually happened, and any returned results.

A card should evolve as progress is made. The user should always be able to return to an unfinished Pact and understand what to do next.

## 5. Browser context

On explicit user invocation, Pact should read relevant context from the active tab where permitted:

- Page title, URL, and description.
- Relevant article or discussion text.
- Selected or highlighted text, if present.
- YouTube video information, available transcript, and playback timestamp.

Pact should show enough source information for users to understand—and correct—what it captured. It should not silently collect browsing history or read unrelated tabs.

## 6. YouTube transcripts are foundational

The video's title is not enough. Frequently, the important detail was **said during the video**, sometimes at a particular moment.

Pact should attempt to:

- Retrieve available manually authored or auto-generated captions/transcripts.
- Preserve timestamps and connect the user's current playback position to nearby transcript content.
- Use full-video context when needed, while prioritizing the relevant moment for phrases like *“that place.”*
- Let the user inspect source transcript passages and jump back to the corresponding video timestamp.
- Disclose clearly when a transcript cannot be retrieved or when only metadata is available.

Caption availability varies, and extraction approaches can be fragile. The first version should handle missing transcripts honestly rather than pretending to have understood speech it could not access.

## 7. AI interpretation

Claude is the current preferred language model. Its job is to combine the user's intent with the page context, identify the relevant subject, and suggest a practical next step.

Pact should not demand complicated prompts. It should help the user articulate an idea, ask for clarification only when necessary, and preserve user control of meaningful decisions.

LLM-generated suggestions are not proof that an external action occurred.

## 8. Fo integration and action

Fo, from Wajo, is the intended execution layer. Depending on supported tools, permissions, and connected services, it may handle emails, calls, follow-ups, browser workflows, booking inquiries, and other real-world tasks.

The intended flow:

**Page + transcript → user intention → Claude interpretation → Pact card → user approval → Fo action → verified result → updated Pact card.**

Pact should show whether an action is proposed, approved, underway, succeeded, failed, or requires user attention. It must never fabricate a successful call, sent email, booking, or payment.

**To verify:** precise Fo MCP/API tools available to the application, how a user's own Fo account can be linked, permission scopes, and which actions Fo can carry out in that account.

## 9. Accounts and connected services

The long-term goal is for users to connect their own Fo accounts. If Fo provides a supported delegated authorization flow, Pact can rely on Fo's existing integrations for services such as email, calendar, and other approved accounts rather than recreating each integration itself.

Google account and calendar connections should use supported authorization flows. Payments, if added, should use a trusted payment provider or Fo-supported authorization—not raw card collection in Pact. Sending messages, confirming reservations, and spending money require explicit user approval.

User-facing Fo account linking is a desired feature; its implementation is **not yet verified**.

## 10. Voice input

Voice dictation would make Pact easier and more natural to use. An initial free option to test is Chrome's Web Speech API, where available. Support, network requirements, and reliability vary.

Transcribed words must be editable before submission. Typing must always work. Voice is an enhancement, not a requirement for creating a Pact.

## 11. Interface and design

**Direction: warm Apple-inspired minimalism with subtle glassmorphism.**

Pact should feel friendly, clear, refined, calm, and effortless—not cold or overly editorial. Think clean Apple-like interface principles and exceptionally legible sans-serif typography, paired with a personal warmth that belongs to Pact.

### Visual language

- Warm off-white or gentle neutral backgrounds, deep charcoal text, and a restrained accent color.
- Softly rounded surfaces; frosted-glass effects used **selectively** for secondary chrome or layered panels.
- Opaque or nearly opaque backgrounds behind important text; readability always wins over transparency.
- Comfortable spacing, excellent hierarchy, consistent components, and one obvious primary action at a time.
- Soft shadows and borders rather than glowing gradients or visual noise.
- Subtle, purposeful motion that explains transitions and progress; respect reduced-motion preferences.

### Typography and accessibility

Use a clean, highly legible sans-serif such as **Inter** or **Atkinson Hyperlegible**; SF Pro may be considered only where licensing and platform use permit. Avoid hard-to-read editorial or decorative fonts. Apple-style visual clarity is the reference, not a literal Apple or Braille font.

Aim for comfortable body text (roughly 17–18 px in the compact panel), strong contrast, generous line spacing, clear labels, visible keyboard focus, large tap/click targets, and meaningful loading, error, and success states. Test the extension at narrow side-panel widths and with zoomed text.

### Avoid the generic AI/SaaS look

Do not default to:

- Purple-to-blue gradients and glows.
- Dashboard-style analytics, metrics, or filler cards.
- Cards nested inside multiple other cards.
- Tiny gray labels or vague icon-only controls.
- An empty chatbot as the primary home screen.
- Too many badges, competing buttons, or decorative icons.
- Maximalist ornamentation, excessive blur, or continuous animation.
- Generic marketing copy and overcomplicated onboarding.

Pact's distinctiveness should come from the **source-to-intention-to-action** experience, not cosmetic effects.

For the design source of truth, see [`docs/DESIGN-SOURCE.md`](./docs/DESIGN-SOURCE.md).

## 12. Main Chrome experience

The intended form factor is the **Chrome side panel**, so Pact appears beside the content that sparked an idea.

Proposed simple navigation:

1. **Current page:** see captured context and make a Pact.
2. **My Pacts:** revisit saved intentions.
3. **Pact details:** review source, next action, activity, and outcomes.

The design must be easy to understand at a glance, including for older adults and users with limited technical confidence.

## 13. Potential use cases

Pact may help with travel, restaurant visits, classes, events, activities, volunteering, purchases, and other discoveries. Its core should stay general-purpose without trying to build a full specialized workflow for every category.

## 14. Initial MVP priorities

**Must work:**

- Chrome extension with an accessible, polished side panel.
- Read active-page context with user permission.
- Retrieve and use available YouTube transcripts and playback position; handle failure transparently.
- Enter or edit an intention and create a saved Pact card.
- Use Claude to interpret context and propose one relevant next step.
- Require approval before external action.
- Execute **at least one genuine Fo-backed action** and show its actual result.
- Reopen a Pact and see its state and history.

**Optional if time allows:** basic voice dictation, additional content-source refinements, and supported user account linking.

**Later:** Chrome Web Store release polish, rich reminders, shared Pacts, WhatsApp or other messaging entry points, cross-device sync, complex multi-step automations, and payments.

## 15. Current technical direction (changeable)

- Chrome extension: **WXT, React, TypeScript**.
- Styling: **Tailwind CSS**.
- Motion: restrained CSS transitions or Motion where justified.
- AI: **Claude** for interpretation.
- Real-world actions: **Fo MCP/API**, subject to verified capabilities.
- Early storage: **chrome.storage.local**.
- Backend: small secure service for secrets, authentication, and Fo/Claude calls.
- Development: primarily **Codex** in a shared repository; **Cursor** as editor; **Claude Code** reserved for integration work and difficult problems.

Avoid exposing API keys or Fo credentials in extension code.

## 16. Design references and workflows

These are **resources to consider**, not dependencies that must all be installed:

- [Google Stitch](https://stitch.withgoogle.com/) — explore layouts and visual direction; maintain a separate design brief/specification.
- [Impeccable](https://github.com/tool-source/base-impeccable) — critique and polish generated UI; useful for spotting generic AI interface patterns.
- [Anthropic frontend-design skill](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design) — optional design guidance.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — optional reference for UI patterns and usability.
- [Banani references](https://www.banani.co/references) and [Screenrove](https://screenrove.com/) — reference libraries for specific composition and interaction ideas.

**Workflow:** choose a visual direction in Stitch or through references → record it in `DESIGN.md` → implement one real side-panel flow → use Impeccable for a focused critique → manually test readability and interactions. Avoid installing several competing design skills that rewrite the product's style.

## 17. Product principles

- **Action over accumulation:** help users progress, not collect more saved links.
- **Context over prompting:** use what is already visible rather than forcing users to restate it.
- **One clear next step:** make the product easy to act on.
- **Human control:** ask before consequential external action.
- **Honest status:** distinguish ideas, requests, progress, and verified outcomes.
- **Accessibility by default:** style must never come before legibility.
- **Purposeful motion:** every effect should clarify, not distract.

## 18. Open questions

- What authentication flow does Fo permit for individual Pact users?
- Which Fo tools are actually exposed for the hackathon implementation?
- How reliable will YouTube caption extraction be across video types and languages?
- Should a Pact have a lightweight conversation thread, or only structured actions?
- Which next steps should be recommended versus executed?
- How much history or content should be stored, and for how long?
- What is the simplest path for handling remote execution state and returning to an unfinished Pact?

## 19. Vision

The internet is full of things people want to experience, learn, explore, and do. Discovering those things should be the start, not the end.


Pact should not require users to connect Fo
before they can start using the extension.

During onboarding, users have two options:

1. Connect Fo
2. I'll do this later

Connecting Fo enables supported real-world actions
through the user's own Wajo account.

Users who skip this step can still:

- Explore Pact
- Read supported webpages
- Access available YouTube transcripts
- Create and save Pact cards
- Receive AI-generated suggestions

When a user attempts an action that requires Fo,
Pact should invite them to connect their account.

Users can connect, disconnect, or reconnect Fo
through Settings → Connections.

Connecting Fo should never delete or change
existing Pact cards.

Authentication should use Wajo's supported
OAuth flow with PKCE.

Pact should never ask users to enter their
Wajo passwords directly into the extension.

The experience should remain simple,
optional, and easy to understand.

**Pact helps turn inspiration into action.**
## 20 Onboarding and Fo connection

Pact should not require users to connect Fo
before they can start using the extension.

During onboarding, users have two options:

1. Connect Fo
2. I'll do this later

Connecting Fo enables supported real-world actions
through the user's own Wajo account.

Users who skip this step can still:

- Explore Pact
- Read supported webpages
- Access available YouTube transcripts
- Create and save Pact cards
- Receive AI-generated suggestions

When a user attempts an action that requires Fo,
Pact should invite them to connect their account.

Users can connect, disconnect, or reconnect Fo
through Settings → Connections.

Connecting Fo should never delete or change
existing Pact cards.

Authentication should use Wajo's supported
OAuth flow with PKCE.

Pact should never ask users to enter their
Wajo passwords directly into the extension.

The experience should remain simple,
optional, and easy to understand.
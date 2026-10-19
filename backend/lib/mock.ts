import { qualifiesForBypass } from "./intent";
import { PACT_STREAM_DELIM } from "./stream-parse";

const RESEARCH =
  "Research the official visiting information for this page. Reply with a short answer, up to three useful findings, source links, and any essential caveats. Do not contact anyone, book anything, or spend money.";

const ACCESS =
  "Find the official accessibility planning page for this place. Reply with the URL and one sentence on what it covers. Do not contact anyone, book anything, or spend money.";

export type MockOptions = {
  responseStyle?: "short" | "detailed";
  askBefore?: "suggested" | "always";
};

function subjectFor(latest: string) {
  if (/accessib/i.test(latest)) return "the official accessibility page";
  return "visiting information";
}

function mockReply(latest: string, waiting: boolean, style?: "short" | "detailed") {
  const subject = subjectFor(latest);
  if (!waiting) {
    if (style === "short") return "I’ll ask Fo for that now.";
    if (style === "detailed")
      return "I’ll ask Fo for that now. I’ll pass along exactly what you asked, then show Fo’s reply here. I won’t book, contact anyone, or pay.";
    return "I’ll ask Fo for that now. I’ll show you the reply here when it comes back.";
  }
  if (style === "short") return `I can ask Fo for ${subject}. Approve below when you’re ready.`;
  if (style === "detailed")
    return `I can ask Fo for ${subject}.\n\n- Official hours\n- The page to plan a visit\n- Any caveat worth knowing\n\nNothing is sent until you approve. Approve below when you’re ready.`;
  return `I can ask Fo for ${subject}. The request stays here until you approve it. Approve below when you’re ready.`;
}

export function mockProposal(latest: string, options?: MockOptions) {
  const message = latest.trim();
  const explicit = qualifiesForBypass({
    latest,
    toolName: "ask_fo",
    message,
    askBefore: options?.askBefore,
  });
  if (explicit) {
    return {
      reply: mockReply(latest, false, options?.responseStyle),
      title: "Ask Fo",
      action: {
        title: "Ask Fo",
        instruction: message,
        toolName: "ask_fo",
        arguments: { message },
      },
    };
  }
  const access = /accessib/i.test(latest);
  const instruction = access ? ACCESS : RESEARCH;
  return {
    reply: mockReply(latest, true, options?.responseStyle),
    title: access ? "Accessibility page" : "Visit research",
    action: {
      title: access ? "Ask Fo for the accessibility page" : "Ask Fo for visiting information",
      instruction,
      toolName: "ask_fo",
      arguments: { message: instruction },
    },
  };
}

export function mockRaw(latest: string, options?: MockOptions) {
  const proposal = mockProposal(latest, options);
  return `${proposal.reply}\n${PACT_STREAM_DELIM}\n${JSON.stringify({
    title: proposal.title,
    action: proposal.action,
  })}`;
}

export function mockResult(latest: string) {
  if (/accessib/i.test(latest))
    return "Fo replied with the official accessibility page: https://www.example.org/visit/accessibility. It lists step-free entry, quiet hours, and how to plan a visit. This is a demo result, not a live Fo reply.";
  return "Fo replied with official visiting information: open 10:00–17:00, plan your visit at https://www.example.org/visit, and book nothing from this request. This is a demo result, not a live Fo reply.";
}

export const MOCK_TOOLS = [
  {
    name: "ask_fo",
    description: "Ask Fo to do something",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        conversationId: { type: "string" },
        newConversation: { type: "boolean" },
      },
      required: ["message"],
    },
  },
  {
    name: "get_fo_reply",
    description: "Read Fo's reply",
    inputSchema: {
      type: "object",
      properties: { conversationId: { type: "string" } },
      required: ["conversationId"],
    },
  },
  {
    name: "list_fo_conversations",
    description: "List Fo conversations",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_fo_conversation",
    description: "Read one Fo conversation",
    inputSchema: {
      type: "object",
      properties: { conversationId: { type: "string" } },
    },
  },
];

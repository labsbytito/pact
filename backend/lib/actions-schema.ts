import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation";
import { ActionError } from "./actions";

// Compile the live discovered schema. Validation errors never include the arguments.
export function validateToolArguments(
  schema: JsonSchemaType,
  args: Record<string, unknown>,
) {
  try {
    if (new AjvJsonSchemaValidator().getValidator(schema)(args).valid) return;
  } catch {
    /* A broken schema is a refusal, not a pass. */
  }
  throw new ActionError(
    "The proposed arguments do not match this Fo tool. Ask Pact for a fresh proposal.",
  );
}

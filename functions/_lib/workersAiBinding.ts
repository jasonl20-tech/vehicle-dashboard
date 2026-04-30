/**
 * Workers AI-Binding aus Pages/Worker `env`.
 * Im Dashboard z. B. Variable `workersai`; in der Doku oft `AI`.
 */
export type WorkersAiBinding = {
  run(
    model: string,
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
};

export function getWorkersAiBinding(env: {
  workersai?: unknown;
  AI?: unknown;
}): WorkersAiBinding | null {
  const b = env.workersai ?? env.AI;
  if (
    b &&
    typeof b === "object" &&
    "run" in b &&
    typeof (b as WorkersAiBinding).run === "function"
  ) {
    return b as WorkersAiBinding;
  }
  return null;
}

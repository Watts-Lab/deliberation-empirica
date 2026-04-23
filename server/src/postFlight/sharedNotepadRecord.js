/**
 * Build the `prompt_${padName}` record written when a shared notepad stage
 * unmounts. The shape matches what stagebook's Prompt.tsx writes for normal
 * (non-shared) openResponse prompts, so post-flight exports are uniform
 * regardless of whether the text came from the React TextArea or Etherpad.
 *
 * Stagebook decorates every save with `{step, stageTimeElapsed}` in
 * Element.tsx's wrappedSave. Since our server side writes directly to game
 * state (bypassing stagebook), we stamp those fields ourselves using the
 * progressLabel + elapsed time the client sends through `etherpadDataReady`.
 *
 * Pure helper — takes injected `fetchPromptFile(cdn, path) => promptString`
 * and `parsePromptFile(promptString) => { metadata, body, responseItems }`.
 * The orchestrator in callbacks.js wires these to the real CDN getter and
 * stagebook's promptFileSchema.
 */

// Walk the resolved treatment to find the prompt element whose `name`
// matches `padName`. Treatments have `gameStages: [{elements: [...]}]`.
export function findPromptElement({ treatment, padName }) {
  const stages = treatment?.gameStages || [];
  return stages
    .flatMap((stage) => stage?.elements || [])
    .find((el) => el?.type === "prompt" && el?.name === padName);
}

export async function buildSharedNotepadRecord({
  game,
  padName,
  progressLabel,
  stageTimeElapsed,
  text,
  cdn,
  fetchPromptFile,
  parsePromptFile,
}) {
  const treatment = game?.get("treatment");
  const element = findPromptElement({ treatment, padName });
  if (!element) {
    throw new Error(
      `No prompt element named "${padName}" in the current treatment`
    );
  }

  const promptString = await fetchPromptFile({ cdn, path: element.file });
  const { metadata, body, responseItems } = parsePromptFile(promptString);

  return {
    ...metadata,
    name: padName,
    file: element.file,
    shared: true,
    prompt: body,
    responses: responseItems,
    debugMessages: [],
    value: text,
    step: progressLabel,
    stageTimeElapsed,
  };
}

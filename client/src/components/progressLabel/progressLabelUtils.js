/**
 * Computes a progressLabel from the given parameters.
 * This is a pure function that can be used in both providers and tests.
 *
 * Progress labels uniquely identify each step in a study and are formatted as:
 * - Intro steps: "intro_0_consent", "intro_1_instructions"
 * - Game stages: "game_0_discussion", "game_1_survey"
 * - Exit steps: "exit_0_debrief", "exit_1_payment"
 *
 * @param {Object} params
 * @param {string} params.phase - The phase ("intro", "game", or "exit")
 * @param {number} params.index - The step/stage index within the phase
 * @param {string} params.name - The step/stage name from treatment config
 * @returns {string} The computed progress label
 *
 * @example
 * computeProgressLabel({ phase: "game", index: 0, name: "discussion" })
 * // => "game_0_discussion"
 *
 * computeProgressLabel({ phase: "intro", index: 1, name: "welcome screen" })
 * // => "intro_1_welcome_screen"
 */
export function computeProgressLabel({ phase, index, name }) {
  const sanitizedName = name.trim().replace(/ /g, "_");
  return `${phase}_${index}_${sanitizedName}`;
}

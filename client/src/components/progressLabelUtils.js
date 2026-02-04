/**
 * Computes a progressLabel from the given parameters.
 * This is a pure function that can be used in both providers and tests.
 *
 * @param {Object} params
 * @param {string} params.phase - The phase (e.g., "game", "intro", "exit")
 * @param {number} params.index - The step/stage index
 * @param {string} params.name - The step/stage name
 * @returns {string} The computed progress label
 */
export function computeProgressLabel({ phase, index, name }) {
  const sanitizedName = name.trim().replace(/ /g, "_");
  return `${phase}_${index}_${sanitizedName}`;
}

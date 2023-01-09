import * as fs from "fs";
import { load as loadYaml } from "js-yaml";

export function getTreatments(path, useTreatments) {
  const treatmentsAvailable = loadYaml(
    fs.readFileSync(path, "utf8")
  )?.treatments;

  // todo: validate treatment formats, etc.

  if (!useTreatments) {
    return treatmentsAvailable;
  }

  const treatments = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const treatmentName of useTreatments) {
    const matches = treatmentsAvailable.filter((t) => t.name === treatmentName);
    if (matches.length === 0) {
      console.log();
      throw new Error(
        `useTreatment ${treatmentName} not found in ${path}`,
        `treatments available: ${treatmentsAvailable.map((t) => t.name)}`
      );
    } else {
      treatments.push(matches[0]);
    }
  }
  return treatments;
}

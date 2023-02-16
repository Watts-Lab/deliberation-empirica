import * as fs from "fs";
import { load as loadYaml } from "js-yaml";

import { get } from "axios";

const TOPIC_REPO_URL =
  "https://api.github.com/repos/Watts-Lab/deliberation-topics/git/trees/main?recursive=1";

export async function getResourceLookup() {
  const res = await get(TOPIC_REPO_URL);
  if (res.status !== 200) {
    console.log("Failed to fetch topic repo tree");
    return undefined;
  }
  const { tree } = res.data;

  const lookup = {};
  tree.forEach((element) => {
    lookup[element.path] = element.url;
  });

  return lookup;
}

export async function getTreatments(path, useTreatments, useIntroSequence) {
  const yamlContents = loadYaml(fs.readFileSync(path, "utf8"));
  const treatmentsAvailable = yamlContents?.treatments;
  const introSequencesAvailable = yamlContents?.introSequences;
  let [introSequence] = introSequencesAvailable;
  // todo: validate treatment formats, etc.

  if (useIntroSequence) {
    [introSequence] = introSequencesAvailable.filter(
      (s) => s.name === useIntroSequence
    );
  }

  if (!useTreatments) {
    return { introSequence, treatmentsAvailable };
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

  return { introSequence, treatments };
}

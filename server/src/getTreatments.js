import { load as loadYaml } from "js-yaml";
import { get } from "axios";
import { getText } from "./utils";

const TOPIC_REPO_URL =
  "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/trees/main?recursive=1";

export async function getResourceLookup() {
  console.log("Getting topic repo tree");
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

function validatePromptString({ filename, promptString }) {
  // given the text of a promptstring, check that it is formatted correctly
  const [, metaDataString, prompt, responseString] = promptString.split("---");
  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const validPromptTypes = ["openResponse", "multipleChoice", "noResponse"];
  if (!validPromptTypes.includes(promptType)) {
    throw new Error(
      `Invalid prompt type "${promptType}" in ${filename}. 
      Valid types include: ${validPromptTypes.join(", ")}`
    );
  }
  const promptName = metaData?.name;
  if (promptName !== filename) {
    throw new Error(
      `Prompt name "${promptName}" does not match filename "${filename}"`
    );
  }
  if (!prompt || prompt.length === 0) {
    throw new Error(`Could not identify prompt body in ${filename}`);
  }

  const responseLines = responseString.split(/\r?\n|\r|\n/g).filter((i) => i);

  // eslint-disable-next-line no-restricted-syntax
  for (const line of responseLines) {
    if (!(line.startsWith("- ") || line.startsWith("> "))) {
      throw new Error(
        `Response ${line} should start with "- " (for multiple choice) or "> " (for open response) to parse properly`
      );
    }
  }
}

async function validateTreatment(treatment) {
  if ("playerCount" in treatment === false) {
    throw new Error(
      `No "playerCount" specified in treatment ${treatment.name}`
    );
  }
  if ("gameStages" in treatment === false) {
    throw new Error(`No "gameStages" specified in treatment ${treatment.name}`);
  }

  if ("exitSurveys" in treatment === false) {
    throw new Error(
      `No "exitSurveys" specified in treatment ${treatment.name}`
    );
  }

  // Check that all files in the treatment can be loaded
  // eslint-disable-next-line no-restricted-syntax
  for (const stage of treatment.gameStages) {
    // eslint-disable-next-line no-restricted-syntax
    for (const element of stage.elements) {
      if (typeof element === "string" || element instanceof String) {
        const filename = element;
        // eslint-disable-next-line no-await-in-loop
        const promptString = await getText(filename);
        validatePromptString({ filename, promptString });
      } else if (element?.type === "prompt") {
        const filename = element.file;
        // eslint-disable-next-line no-await-in-loop
        const promptString = await getText(filename);
        validatePromptString({ filename, promptString });
      }
    }
  }
}

export async function getTreatments(path, useTreatments, useIntroSequence) {
  const text = await getText(path).catch((e) => {
    throw new Error(`Failed to fetch treatment file from path ${path}, ${e}`);
  });

  const yamlContents = loadYaml(text);

  const treatmentsAvailable = yamlContents?.treatments;
  const introSequencesAvailable = yamlContents?.introSequences;

  let [introSequence] = introSequencesAvailable; // take first if not defined?
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
      const matchingTreatment = matches[0];
      // Todo: compute minimum and maximum payout for all treatments

      // eslint-disable-next-line no-await-in-loop
      await validateTreatment(matchingTreatment);
      treatments.push(matchingTreatment);
    }
  }

  return { introSequence, treatments };
}

/* eslint-disable no-restricted-syntax */
import { load as loadYaml } from "js-yaml";
import { get } from "axios";
import { getText } from "./utils";

const TOPIC_REPO_URL =
  "https://api.github.com/repos/Watts-Lab/deliberation-assets/git/trees/main?recursive=1";

let cdnSelection = "prod";

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

async function validateElement({ element, duration }) {
  let newElement;
  if (typeof element === "string" || element instanceof String) {
    // hydrate shorthand prompts
    newElement = {
      file: element,
      name: element,
      type: "prompt",
    };
  } else {
    newElement = { ...element };
  }

  if (newElement.type === "prompt") {
    const promptString = await getText({
      cdn: cdnSelection,
      path: newElement.file,
    });
    validatePromptString({ filename: newElement.file, promptString });
  }
  if (element.hideTime > duration) {
    throw new Error(
      `hideTime ${element.hideTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`
    );
  }
  // Todo: validate survey elements

  // Todo: validate other types of elements

  return newElement;
}

async function validateElements({ elements, duration }) {
  const newElements = await Promise.all(
    elements.map((element) => validateElement({ element, duration }))
  );
  return newElements;
}

async function validateStage(stage) {
  if (!stage.name) {
    throw new Error(
      `Stage missing a name with contents ${JSON.stringify(stage)}`
    );
  }

  if (!stage.duration) {
    throw new Error(`Stage with name ${stage.name} missing "duration"`);
  }

  const supportedChatTypes = ["none", "video"];
  if (stage.chatType && !supportedChatTypes.includes(stage.chatType)) {
    throw new Error(
      `Unsupported chat type ${stage.chatType} in stage ${stage.name}`
    );
  }

  const newStage = { ...stage };
  if (stage.elements) {
    // it is possible to have a chat-only stage...
    newStage.elements = await validateElements({
      elements: stage.elements,
      duration: stage.duration,
    });
  }
  newStage.chatType = stage.chatType || "none";

  return newStage;
}

async function validateTreatment(treatment) {
  if (!treatment.playerCount) {
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

  const newTreatment = { ...treatment };
  newTreatment.gameStages = await Promise.all(
    treatment.gameStages.map(validateStage)
  );
  // todo: validate exit steps
  return newTreatment;
}

// async function validateIntroSequence(introSequence) {}

export async function getTreatments({
  cdn,
  path,
  useTreatments,
  useIntroSequence,
}) {
  cdnSelection = cdn;
  const text = await getText({ cdn, path }).catch((e) => {
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
  for (const treatmentName of useTreatments) {
    const matches = treatmentsAvailable.filter((t) => t.name === treatmentName);
    if (matches.length === 0) {
      console.log();
      throw new Error(
        `useTreatment ${treatmentName} not found in ${path}`,
        `treatments available: ${treatmentsAvailable.map((t) => t.name)}`
      );
    } else {
      // eslint-disable-next-line no-await-in-loop
      const newTreatment = await validateTreatment(matches[0]);
      treatments.push(newTreatment);
    }
  }

  return { introSequence, treatments };
}

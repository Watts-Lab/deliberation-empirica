/* eslint-disable no-restricted-syntax */
import { load as loadYaml } from "js-yaml";
import { get } from "axios";
import { warn, info } from "@empirica/core/console";
import { getText } from "./providers/cdn";
import { getRepoTree } from "./providers/github";
import { fillTemplates } from "./preFlight/fillTemplates";
import { treatmentSchema } from "./preFlight/validateTreatmentFile";

let cdnSelection = "prod";

export async function getResourceLookup() {
  info("Getting topic repo tree");
  const tree = await getRepoTree({
    owner: "Watts-Lab",
    repo: "deliberation-assets",
    branch: "main",
  });

  const lookup = {};
  tree.forEach((element) => {
    lookup[element.path] = element.url;
  });

  return lookup;
}

function validatePromptString({ filename, promptString }) {
  // given the text of a promptstring, check that it is formatted correctly
  // Parse the prompt string into its sections

  // TODO: this replicates client-side code - is there a way to refactor that makes sense?
  const sectionRegex = /---\n/g;
  const [, metaDataString, prompt, responseString] =
    promptString.split(sectionRegex);
  const metaData = loadYaml(metaDataString);
  const promptType = metaData?.type;
  const validPromptTypes = [
    "openResponse",
    "multipleChoice",
    "noResponse",
    "listSorter",
  ];
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

  if (promptType !== "noResponse") {
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
    try {
      const promptString = await getText({
        cdn: cdnSelection,
        path: newElement.file,
      });
      validatePromptString({ filename: newElement.file, promptString });
    } catch (e) {
      throw new Error(
        `Failed to fetch prompt file from cdn: ${cdnSelection} path: ${newElement.file} for element`,
        JSON.stringify(newElement),
        e
      );
    }
  }

  if (newElement.type === "qualtrics") {
    const surveyId = newElement.url.split("/").pop();
    const qualtricsApiToken = process.env.QUALTRICS_API_TOKEN;
    const qualtricsDatacenter = process.env.QUALTRICS_DATACENTER;
    if (!qualtricsApiToken) {
      throw new Error(
        `No QUALTRICS_API_TOKEN specified in environment variables`
      );
    }
    if (!qualtricsDatacenter) {
      throw new Error(
        `No QUALTRICS_DATACENTER specified in environment variables`
      );
    }
    const url = `https://${qualtricsDatacenter}.qualtrics.com/API/v3/survey-definitions/${surveyId}/metadata`;
    const config = {
      headers: {
        "X-API-TOKEN": qualtricsApiToken.trim(),
        "Content-Type": "application/json",
      },
    };
    const response = await get(url, config);
    const {
      data: { result },
    } = response;
    info(`Fetched metadata for survey "${result.SurveyName}".`);
  }

  if (element.hideTime > duration) {
    throw new Error(
      `hideTime ${element.hideTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`
    );
  }
  if (element.displayTime > duration) {
    throw new Error(
      `displayTime ${element.displayTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`
    );
  }
  if (element.startTime > duration) {
    throw new Error(
      `startTime ${element.startTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`
    );
  }
  if (element.endTime > duration) {
    throw new Error(
      `endTime ${element.endTime} for ${newElement.type} 
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

  // const supportedChatTypes = ["none", "video", "text"];
  // if (stage.chatType && !supportedChatTypes.includes(stage.chatType)) {
  //   throw new Error(
  //     `Unsupported chat type ${stage.chatType} in stage ${stage.name}`
  //   );
  // }

  const newStage = { ...stage };
  if (stage.elements) {
    // it is possible to have a chat-only stage...
    newStage.elements = await validateElements({
      elements: stage.elements,
      duration: stage.duration,
    });
  }

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

  if (
    "exitSurveys" in treatment === false &&
    "exitSequence" in treatment === false
  ) {
    warn(
      `No "exitSurveys" or "exitSequence" specified in treatment ${treatment.name}`
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
  treatmentNames,
  introSequenceName,
}) {
  cdnSelection = cdn;
  const text = await getText({ cdn, path }).catch((e) => {
    throw new Error(
      `Failed to fetch treatment file from cdn: ${cdn} path: ${path}`,
      e
    );
  });

  const yamlContents = loadYaml(text);

  const templates = yamlContents?.templates || {};

  const rawIntroSequencesAvailable = yamlContents?.introSequences;
  const introSequencesAvailable = fillTemplates({
    obj: rawIntroSequencesAvailable,
    templates,
  });

  const rawTreatmentsAvailable = yamlContents?.treatments;
  const treatmentsAvailable = fillTemplates({
    obj: rawTreatmentsAvailable,
    templates,
  });

  for (const treatment of treatmentsAvailable) {
    const result = treatmentSchema.safeParse(treatment);
    if (!result.success) {
      throw new Error(
        `Invalid treatment ${treatment.name} in ${path}: ${result.error.message}`
      );
    }
  }

  let introSequence;
  if (introSequenceName !== "none") {
    [introSequence] = introSequencesAvailable.filter(
      (s) => s.name === introSequenceName
    );
    console.log("Intro sequence: ", JSON.stringify(introSequence, null, 2));
    if (!introSequence) {
      throw new Error(
        `introSequence ${introSequenceName} not found in ${path}`,
        `introSequences available: ${introSequencesAvailable.map(
          (s) => s.name
        )}`
      );
    }
  }

  if (!treatmentNames || treatmentNames.length === 0) {
    return { introSequence, treatmentsAvailable };
  }

  const treatments = [];
  for (const treatmentName of treatmentNames) {
    const matches = treatmentsAvailable.filter((t) => t.name === treatmentName);
    if (matches.length === 0) {
      throw new Error(
        `useTreatment ${treatmentName} not found in ${path}
         treatments available: ${treatmentsAvailable.map((t) => t.name)}`
      );
    } else {
      // eslint-disable-next-line no-await-in-loop
      try {
        const newTreatment = await validateTreatment(matches[0]);
        console.log(`Validated treatment: ${treatmentName}`);
        treatments.push(newTreatment);
      } catch (e) {
        console.log("Failed validating: ", JSON.stringify(matches[0], null, 2));
        throw new Error(`Failed to validate treatment ${treatmentName}`, e);
      }
    }
  }

  return { introSequence, treatments };
}

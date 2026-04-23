/* eslint-disable no-restricted-syntax */
import { get } from "axios";
import { warn, info, error } from "@empirica/core/console";
import { load as loadYaml } from "js-yaml";
import {
  fillTemplates,
  promptFileSchema,
  treatmentSchema,
} from "stagebook";
import { getText } from "./providers/cdn";
import { getRepoTree } from "./providers/github";

let cdnSelection = "prod";
let treatmentFileDir = "";

// Pure helper: resolve `filePath` relative to `dir`, collapsing `.`/`..` and
// empty segments. Exported for unit tests; `resolveRelativeToTreatment` below
// is the module-scoped convenience wrapper used by the pipeline.
export function joinRelativeToDir(dir, filePath) {
  if (filePath == null) return "";
  const combined = dir ? `${dir}/${filePath}` : filePath;
  const segments = combined.split("/").reduce((acc, seg) => {
    if (seg === "" || seg === ".") return acc;
    if (seg === "..") {
      acc.pop();
      return acc;
    }
    acc.push(seg);
    return acc;
  }, []);
  return segments.join("/");
}

// Resolve a path referenced in a treatment file relative to the treatment
// file's directory (per stagebook's contract).
function resolveRelativeToTreatment(filePath) {
  return joinRelativeToDir(treatmentFileDir, filePath);
}

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

// Exported for unit tests. Delegates prompt-file validation (metadata,
// body, responses) to stagebook's promptFileSchema so the platform and
// package stay in sync. Throws on failure; returns nothing on success.
export function validatePromptString({ filename, promptString }) {
  const result = promptFileSchema.safeParse(promptString);
  if (!result.success) {
    error(
      `Invalid prompt file ${filename}: ${result.error.message}`
    );
    throw new Error(
      `Invalid prompt file ${filename}: ${result.error.message}`
    );
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
    // Paths in treatment files are relative to the treatment file's
    // location (per stagebook's contract). Resolve before fetching.
    const resolvedPath = resolveRelativeToTreatment(newElement.file);
    try {
      const promptString = await getText({
        cdn: cdnSelection,
        path: resolvedPath,
      });
      validatePromptString({ filename: resolvedPath, promptString });
    } catch (e) {
      error(
        `Failed to fetch prompt file from cdn: ${cdnSelection} path: ${resolvedPath} for element`,
        JSON.stringify(newElement),
        `Error: ${e.message}\n`
      );
      throw new Error(
        `Failed to fetch prompt file from cdn: ${cdnSelection} path: ${resolvedPath} for element`,
        JSON.stringify(newElement),
        `Error: ${e.message}`,
        `Error stack: ${e.stack}`,
        `Error name: ${e.name}`,
        `Error code: ${e.code}`
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
  // console.log("trying to validate stage", JSON.stringify(stage, null, 2));
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

  // console.log("Validated stage", JSON.stringify(newStage, null, 2));
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
  // Paths in treatment files are relative to the treatment file's location.
  const lastSlash = path.lastIndexOf("/");
  treatmentFileDir = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
  const text = await getText({ cdn, path }).catch((e) => {
    throw new Error(
      `Failed to fetch treatment file from cdn: ${cdn} path: ${path}`,
      e
    );
  });

  const yamlContents = loadYaml(text);

  // Stagebook's fillTemplates expects an array of template definitions and
  // calls `.find()` on it — default to an empty array when the treatment
  // file has no templates section.
  const templates = yamlContents?.templates || [];

  // fillTemplates returns `{ result, unresolvedFields }` — we only need the
  // hydrated object here; unresolvedFields is used by callers that care
  // about partial hydration (VS Code extension, etc.) but we expect full
  // resolution for server-side treatment loading.
  const rawIntroSequencesAvailable = yamlContents?.introSequences;
  let introSequencesAvailable = [];
  if (rawIntroSequencesAvailable) {
    ({ result: introSequencesAvailable } = fillTemplates({
      obj: rawIntroSequencesAvailable,
      templates,
    }));
  }

  const rawTreatmentsAvailable = yamlContents?.treatments;
  const { result: treatmentsAvailable } = fillTemplates({
    obj: rawTreatmentsAvailable,
    templates,
  });

  for (const treatment of treatmentsAvailable) {
    const result = treatmentSchema.safeParse(treatment);
    if (!result.success) {
      console.log(
        "Failed to validate treatment: ",
        JSON.stringify(treatment, null, 2)
      );
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
    // console.log("Intro sequence: ", JSON.stringify(introSequence, null, 2));
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
        // console.log("validate", treatmentName);
        const newTreatment = await validateTreatment(matches[0]);
        // console.log(`Validated treatment: ${treatmentName}`);
        treatments.push(newTreatment);
      } catch (e) {
        error(`Failed to validate treatment ${treatmentName}`, e);
        // error("Failed validating: ", JSON.stringify(matches[0], null, 2));
        throw new Error(`Failed to validate treatment ${treatmentName}`, e);
      }
    }
  }

  return { introSequence, treatments };
}

/* eslint-disable no-restricted-syntax */
import axios, { get } from "axios";
import { warn, info, error, debug } from "@empirica/core/console";
import { load as loadYaml } from "js-yaml";
import { fillTemplates, promptFileSchema, treatmentSchema } from "stagebook";
import { getText } from "./providers/cdn";
import { getRepoHeadSha } from "./providers/github";

// Module-scoped state captured at the top of getTreatments() so the
// recursive validators below don't have to thread these through every
// helper. One of cdnSelection / assetBaseUrl is set per batch — the
// schema's superRefine in validateBatchConfig.ts enforces exactly one.
let cdnSelection = "prod";
let assetBaseUrl = null;
let treatmentFileDir = "";

// Pure helper: resolve `filePath` relative to `dir`, collapsing `.`/`..` and
// empty segments. Exported for unit tests.
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

// Three-form resolver mirroring client/.../resolveAssetURL — same
// ADR 0009 contract on the server side so an `asset://` or full-URL
// reference in a treatment file behaves the same way at validation
// time as it will at participant runtime. Stagebook's spec accepts
// only http(s):// and asset:// (per the urlSchema in the stagebook
// bundle: "URL must use http://, https://, or asset://"). Mirror
// that here — see also client/src/components/stagebookAdapter/
// helpers.js resolveAssetURL for the participant-side equivalent.
const ASSET_SCHEME_RE = /^asset:\/\//i;
const HTTP_URL_RE = /^(?:https?:)?\/\//i;
const ANY_URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// Resolve a treatment-file reference to a fetch target.
//   - `asset://X` → prefix-relative path `X` (no treatment-dir join).
//     Reject malformed `asset:` (without `//`) here so a typo doesn't
//     fall through and try to fetch a non-existent absolute URL.
//   - `http(s)://...` (and protocol-relative `//host/...`) → fetch
//     directly, no prefix.
//   - Other URL schemes (`data:`, `file:`, `mailto:`, ...) → reject.
//     Stagebook's own validation rejects these upstream; rejecting
//     here too is defense-in-depth against programmatic insertion or
//     cross-version drift, and matches the client-side resolver.
//   - Naked relative path → join with treatment-dir when called from
//     within an element (the stagebook contract: "paths are relative
//     to the treatment file"); skip the join when called for the
//     treatment file itself, since the treatment file IS the root
//     and joining `proj/study.yaml` against treatmentFileDir=`proj`
//     produces `proj/proj/study.yaml`.
function resolveAssetReference(rawPath, { treatmentRelative = true } = {}) {
  if (ASSET_SCHEME_RE.test(rawPath)) {
    return {
      type: "relative",
      path: rawPath.replace(ASSET_SCHEME_RE, ""),
    };
  }
  if (/^asset:/i.test(rawPath)) {
    throw new Error(
      `Malformed asset reference "${rawPath}" — the asset: scheme requires "//" (use "asset://${rawPath.replace(/^asset:/i, "")}")`,
    );
  }
  if (HTTP_URL_RE.test(rawPath)) {
    return { type: "absolute", url: rawPath };
  }
  if (ANY_URL_SCHEME_RE.test(rawPath)) {
    throw new Error(
      `Unsupported URL scheme in "${rawPath}" — stagebook accepts only http(s):// and asset:// references (per stagebook urlSchema spec).`,
    );
  }
  return {
    type: "relative",
    path: treatmentRelative
      ? joinRelativeToDir(treatmentFileDir, rawPath)
      : rawPath,
  };
}

// Fetch text content from whichever asset-resolution path the batch is
// configured to use. The cdn-enum path keeps the bundled `getText`
// fixture-aware fetch (with provider-level CDN URL resolution); the
// assetBaseUrl path is a flat join + axios GET — no provider needed
// because the manager has pre-mirrored everything to the prefix.
async function fetchAssetText(rawPath, { treatmentRelative = true } = {}) {
  const ref = resolveAssetReference(rawPath, { treatmentRelative });

  if (ref.type === "absolute") {
    const fileURL = encodeURI(ref.url);
    debug(`Getting file from absolute URL: ${fileURL}`);
    const { data, status } = await axios.get(fileURL, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
    if (status !== 200) {
      throw new Error(`Could not fetch file from ${fileURL}`);
    }
    return data;
  }

  if (assetBaseUrl) {
    const fileURL = encodeURI(`${assetBaseUrl}/${ref.path}`);
    debug(`Getting file from manager-mirrored asset URL: ${fileURL}`);
    const { data, status } = await axios.get(fileURL, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
    if (status !== 200) {
      throw new Error(
        `Could not fetch file from ${assetBaseUrl} corresponding to file path ${ref.path}`,
      );
    }
    return data;
  }
  return getText({ cdn: cdnSelection, path: ref.path });
}

// Returns the current head sha of the deliberation-assets repo. Clients
// compose permalinks as `{repoUrl}/blob/{sha}/{path}` without needing a
// pre-computed lookup table (see issue #10).
export async function getAssetsRepoSha() {
  return getRepoHeadSha({
    owner: "Watts-Lab",
    repo: "deliberation-assets",
    branch: "main",
  });
}

// Exported for unit tests. Delegates prompt-file validation (metadata,
// body, responses) to stagebook's promptFileSchema so the platform and
// package stay in sync. Throws on failure; returns nothing on success.
export function validatePromptString({ filename, promptString }) {
  const result = promptFileSchema.safeParse(promptString);
  if (!result.success) {
    error(`Invalid prompt file ${filename}: ${result.error.message}`);
    throw new Error(`Invalid prompt file ${filename}: ${result.error.message}`);
  }
}

async function validateElement({ element, duration }) {
  const newElement = { ...element };

  if (newElement.type === "prompt") {
    // Paths in treatment files are relative to the treatment file's
    // location (per stagebook's contract). Resolve before fetching.
    // Pass the raw element.file to fetchAssetText so the three-form
    // resolver inside it can branch correctly (treatment-relative vs
    // asset:// vs absolute URL). Pre-resolving via
    // resolveRelativeToTreatment would corrupt asset:// and
    // https://... references by joining them with the treatment dir.
    const sourceLabel = assetBaseUrl
      ? `assetBaseUrl: ${assetBaseUrl}`
      : `cdn: ${cdnSelection}`;
    try {
      const promptString = await fetchAssetText(newElement.file);
      validatePromptString({
        filename: newElement.file,
        promptString,
      });
    } catch (e) {
      error(
        `Failed to fetch prompt file from ${sourceLabel} reference: ${newElement.file} for element`,
        JSON.stringify(newElement),
        `Error: ${e.message}\n`,
      );
      // `new Error(message, options)` — the second arg is the options
      // bag; `cause` is what attaches the underlying error so
      // diagnostics survive. Earlier shape passed extra strings as
      // additional arguments, which JS silently dropped.
      throw new Error(
        `Failed to fetch prompt file from ${sourceLabel} reference: ${newElement.file} for element ${JSON.stringify(newElement)}`,
        { cause: e },
      );
    }
  }

  if (newElement.type === "qualtrics") {
    const surveyId = newElement.url.split("/").pop();
    const qualtricsApiToken = process.env.QUALTRICS_API_TOKEN;
    const qualtricsApiBaseURL = process.env.QUALTRICS_API_BASE_URL;
    const qualtricsDatacenter = process.env.QUALTRICS_DATACENTER;
    if (!qualtricsApiToken) {
      throw new Error(
        `No QUALTRICS_API_TOKEN specified in environment variables`,
      );
    }
    // Datacenter is only used to build the default host. When the override
    // is set (mock harness, custom proxy), the datacenter is irrelevant —
    // don't require it. Mirrors how providers/qualtrics.js relies on it
    // only via the same fallback template.
    if (!qualtricsApiBaseURL && !qualtricsDatacenter) {
      throw new Error(
        `No QUALTRICS_DATACENTER specified in environment variables`,
      );
    }
    // Match QUALTRICS_API_BASE_URL pattern from providers/qualtrics.js so the
    // L3 mock harness can intercept this validation call too. Strip a
    // trailing slash on the override so the joined URL doesn't double-slash.
    const qualtricsBaseURL = qualtricsApiBaseURL
      ? qualtricsApiBaseURL.replace(/\/$/, "")
      : `https://${qualtricsDatacenter}.qualtrics.com`;
    const url = `${qualtricsBaseURL}/API/v3/survey-definitions/${surveyId}/metadata`;
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
       element ${newElement.name} exceeds duration ${duration}`,
    );
  }
  if (element.displayTime > duration) {
    throw new Error(
      `displayTime ${element.displayTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`,
    );
  }
  if (element.startTime > duration) {
    throw new Error(
      `startTime ${element.startTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`,
    );
  }
  if (element.endTime > duration) {
    throw new Error(
      `endTime ${element.endTime} for ${newElement.type} 
       element ${newElement.name} exceeds duration ${duration}`,
    );
  }

  // Todo: validate survey elements

  // Todo: validate other types of elements

  return newElement;
}

async function validateElements({ elements, duration }) {
  const newElements = await Promise.all(
    elements.map((element) => validateElement({ element, duration })),
  );
  return newElements;
}

async function validateStage(stage) {
  // console.log("trying to validate stage", JSON.stringify(stage, null, 2));
  if (!stage.name) {
    throw new Error(
      `Stage missing a name with contents ${JSON.stringify(stage)}`,
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
      `No "playerCount" specified in treatment ${treatment.name}`,
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
      `No "exitSurveys" or "exitSequence" specified in treatment ${treatment.name}`,
    );
  }

  const newTreatment = { ...treatment };
  newTreatment.gameStages = await Promise.all(
    treatment.gameStages.map(validateStage),
  );
  // todo: validate exit steps
  return newTreatment;
}

// async function validateIntroSequence(introSequence) {}

export async function getTreatments({
  cdn,
  assetBaseUrl: assetBaseUrlArg,
  path,
  treatmentNames,
  introSequenceName,
}) {
  cdnSelection = cdn;
  assetBaseUrl = assetBaseUrlArg ?? null;
  // Paths in treatment files are relative to the treatment file's location.
  const lastSlash = path.lastIndexOf("/");
  treatmentFileDir = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
  const sourceLabel = assetBaseUrl
    ? `assetBaseUrl: ${assetBaseUrl}`
    : `cdn: ${cdn}`;
  // The treatment file is THE root — its path is relative to the
  // CDN/prefix, not relative to the treatment-dir (which is computed
  // FROM this path). `treatmentRelative: false` short-circuits the
  // join so we don't accidentally double the leading directory.
  const text = await fetchAssetText(path, { treatmentRelative: false }).catch(
    (e) => {
      // `new Error(message, options)` — second arg is the options
      // bag; `cause` is what carries the underlying error through.
      throw new Error(
        `Failed to fetch treatment file from ${sourceLabel} path: ${path}`,
        { cause: e },
      );
    },
  );

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
        JSON.stringify(treatment, null, 2),
      );
      throw new Error(
        `Invalid treatment ${treatment.name} in ${path}: ${result.error.message}`,
      );
    }
  }

  let introSequence;
  if (introSequenceName !== "none") {
    [introSequence] = introSequencesAvailable.filter(
      (s) => s.name === introSequenceName,
    );
    // console.log("Intro sequence: ", JSON.stringify(introSequence, null, 2));
    if (!introSequence) {
      throw new Error(
        `introSequence ${introSequenceName} not found in ${path}; introSequences available: ${introSequencesAvailable.map(
          (s) => s.name,
        )}`,
      );
    }
  }

  if (!treatmentNames || treatmentNames.length === 0) {
    return { introSequence, treatmentsAvailable };
  }

  const treatments = [];
  // eslint-disable-next-line no-restricted-syntax -- awaits serialized inside
  for (const treatmentName of treatmentNames) {
    const matches = treatmentsAvailable.filter((t) => t.name === treatmentName);
    if (matches.length === 0) {
      throw new Error(
        `useTreatment ${treatmentName} not found in ${path}
         treatments available: ${treatmentsAvailable.map((t) => t.name)}`,
      );
    } else {
      try {
        // console.log("validate", treatmentName);
        // eslint-disable-next-line no-await-in-loop -- treatments validated serially so a failure surfaces with clear provenance
        const newTreatment = await validateTreatment(matches[0]);
        // console.log(`Validated treatment: ${treatmentName}`);
        treatments.push(newTreatment);
      } catch (e) {
        error(`Failed to validate treatment ${treatmentName}`, e);
        // error("Failed validating: ", JSON.stringify(matches[0], null, 2));
        throw new Error(`Failed to validate treatment ${treatmentName}`, {
          cause: e,
        });
      }
    }
  }

  return { introSequence, treatments };
}

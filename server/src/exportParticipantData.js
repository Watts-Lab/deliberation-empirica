import * as fs from "fs";
import { randomUUID } from "crypto";
import { error, warn, info, log } from "@empirica/core/console";

function getFileName({ platformId }) {
  // Assume that there aren't namespace conflicts between IDs on different platforms
  const participantDataDir = `${process.env.DATA_DIR}/participantData`;
  return `${participantDataDir}/${platformId}.jsonl`;
}

export function createNewParticipant({ platformId }) {
  const ts = new Date().toISOString();
  const deliberationId = randomUUID();
  const participantDataDir = `${process.env.DATA_DIR}/participantData`;

  const writeLines = [
    JSON.stringify({ type: "meta", key: "platformId", val: platformId, ts }),
    JSON.stringify({
      type: "meta",
      key: "deliberationId",
      val: deliberationId,
      ts,
    }),
  ];

  if (!fs.existsSync(participantDataDir))
    fs.mkdirSync(participantDataDir, { recursive: true });

  if (!platformId || platformId.trim().length === 0) {
    error("Cannot save data without a platformId, received:", platformId);
  } else {
    const fileName = getFileName({ platformId });
    fs.appendFile(fileName, writeLines.join("\n"), "utf8", (err) => {
      if (err) {
        // dont throw the error, its ok if we don't save this data at the moment...
        error(`Error creating new participant with id ${platformId}`, err);
      }
      info(`Creating datafile ${fileName}`);
    });
  }

  const participantData = { platformId, deliberationId };
  return participantData;
}

export async function getParticipantData({ platformId }) {
  // Tries to read existing participant data file.
  // If none exists, creates one, and returns a basic participant object
  const fileName = getFileName({ platformId });

  try {
    const data = fs.readFileSync(fileName, "utf8");
    const participantData = {};
    const lines = data.split(/\n/);
    lines.forEach((line) => {
      const obj = JSON.parse(line);
      if (obj.type === "meta") {
        // TODO: get other types of data (not just meta)
        participantData[obj.key] = obj.val;
      }
    });
    info("Fetching data for returning participant:", participantData);
    return participantData;
  } catch (e) {
    if (e.code === "ENOENT") {
      info(`No record exists for ${platformId}, creating a new record`);
      return createNewParticipant({ platformId });
    }

    error("Error in getParticipantData", e);
    return createNewParticipant({ platformId });
  }
}

// export function updateParticipant({ platform, platformId, player }) {
//   const fileName = getFileName({ platform, platformId });
//   // get the existing data from the file
//   // remove from participantData what is already in the file
//   // add new lines to the file from the new data?
// }

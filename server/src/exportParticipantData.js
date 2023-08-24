import * as fs from "fs";
import { randomUUID } from "crypto";

function getFileName({ platformId }) {
  // Assume that there aren't namespace conflicts between IDs on different platforms
  const participantDataDir = `${process.env.DATA_DIR}/participantData`;
  return `${participantDataDir}/${platformId}.jsonl`;
}

export function createNewParticipant({ platformId }) {
  const fileName = getFileName({ platformId });
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

  fs.appendFile(fileName, writeLines.join("\n"), "utf8", (err) => {
    if (err) {
      // dont throw the error, its ok if we don't save this data at the moment...
      console.log(`Error creating new participant with id ${platformId}`, err);
    }
    console.log(`Creating datafile ${fileName}`);
  });

  const participantData = { platformId, deliberationId };
  // console.log("created Participant data", participantData);
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
    console.log("Fetching data for returning participant:", participantData);
    return participantData;
  } catch (error) {
    // console.log("error", error);
    if (error.code === "ENOENT") {
      console.log(`No record exists for ${platformId}, creating a new record`);
      return createNewParticipant({ platformId });
    }

    console.log("Error in getParticipantData", error);
    return createNewParticipant({ platformId });
  }
}

// export function updateParticipant({ platform, platformId, player }) {
//   const fileName = getFileName({ platform, platformId });
//   // get the existing data from the file
//   // remove from participantData what is already in the file
//   // add new lines to the file from the new data?
// }

import { readFile, appendFile } from "fs";
import { randomUUID } from "crypto";

const participantDataDir = process.env.PARTICIPANT_DATA_DIR;

function getFileName({ platform, platformId }) {
  if (platform === "mturk") {
    return `${participantDataDir}/m_${platformId}.jsonl`;
  }

  if (platform === "prolific") {
    return `${participantDataDir}/p_${platformId}.jsonl`;
  }

  return `${participantDataDir}/o_${platformId}.jsonl`; // other
}

export function createNewParticipant({ platform, platformId }) {
  const fileName = getFileName({ platform, platformId });
  const ts = new Date().toISOString();
  const deliberationId = randomUUID();

  const writeLines = [
    JSON.stringify({ type: "meta", key: "platform", val: platform, ts }),
    JSON.stringify({ type: "meta", key: "platformId", val: platformId, ts }),
    JSON.stringify({
      type: "meta",
      key: "deliberationId",
      val: deliberationId,
      ts,
    }),
  ];

  appendFile(fileName, writeLines.join("\n"), "utf8", (err) => {
    if (err) throw err;
    console.log(`Creating datafile ${fileName}`);
  });

  const participantData = { platform, platformId, deliberationId };
  return participantData;
}

export async function getParticipantData({ platform, platformId }) {
  // Tries to read existing participant data file.
  // If none exists, creates one, and returns a basic participant object
  const fileName = getFileName({ platform, platformId });
  readFile(fileName, (err, data) => {
    if (err) {
      console.log(`No record exists for ${platformId}`);
      return createNewParticipant({ platform, platformId });
    }

    const lines = data.split(/\n/);
    const participantData = {};
    lines.forEach((line) => {
      const obj = JSON.parse(line);
      if (obj.kind === "meta") {
        participantData[obj.key] = obj.val;
      }
    });
    return participantData;
  });
}

export function updateParticipant({ platform, platformId, player }) {
  const fileName = getFileName({ platform, platformId });
  // get the existing data from the file
  // remove from participantData what is already in the file
  // add new lines to the file from the new data?
}

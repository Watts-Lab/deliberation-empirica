import * as fs from "fs";
import { randomUUID } from "crypto";

const participantDataDir = process.env.PARTICIPANT_DATA_DIR;

function getFileName({ platformId }) {
  // For now, assume that there aren't namespace conflicts between various
  return `${participantDataDir}/${platformId}.jsonl`;
}

export function createNewParticipant({ platformId }) {
  const fileName = getFileName({ platformId });
  const ts = new Date().toISOString();
  const deliberationId = randomUUID();

  const writeLines = [
    JSON.stringify({ type: "meta", key: "platformId", val: platformId, ts }),
    JSON.stringify({
      type: "meta",
      key: "deliberationId",
      val: deliberationId,
      ts,
    }),
  ];

  fs.appendFile(fileName, writeLines.join("\n"), "utf8", (err) => {
    if (err) {
      console.log(`Error creating new participant with id ${platformId}`);
      throw err;
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
    const data = fs.readFileSync(fileName);
    //const data = await fs.readFile(fileName); // Don't know why you can't async await this fella
    const participantData = {};
    const lines = data.split(/\n/);
    lines.forEach((line) => {
      const obj = JSON.parse(line);
      if (obj.kind === "meta") {
        // TODO: get other types of data (not just meta)
        participantData[obj.key] = obj.val;
      }
    });
    console.log(participantData);
    return participantData;
  } catch (error) {
    // console.log("error", error);
    if (error.code === "ENOENT") {
      // console.log(`No record exists for ${platformId}`);
      return createNewParticipant({ platformId });
    }
  }

  // let participantData;
  // return fs.readFile(fileName, (err, data) => {
  //   if (err) {
  //     console.log("readfile error:", err);
  //     participantData = createNewParticipant({ platformId });
  //     console.log("Justnow", participantData);
  //     return participantData;
  //   }

  //   console.log("readfile data", data);
  //   const lines = data.split(/\n/);
  //   lines.forEach((line) => {
  //     const obj = JSON.parse(line);
  //     if (obj.kind === "meta") {
  //       participantData[obj.key] = obj.val;
  //     }
  //     // TODO: get other types of data (not just meta)
  //   });
  //   return participantData;
  // });
  //console.log("Here", participantData);
}

export function updateParticipant({ platform, platformId, player }) {
  const fileName = getFileName({ platform, platformId });
  // get the existing data from the file
  // remove from participantData what is already in the file
  // add new lines to the file from the new data?
}

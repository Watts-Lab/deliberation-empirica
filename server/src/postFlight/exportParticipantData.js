/**
 * Participant-data file orchestrator.
 *
 * Pure line-format builders/parsers live in ./participantDataHelpers.
 * This module handles fs I/O: reading existing files, creating new ones
 * with mkdir -p, and writing meta lines.
 */
import * as fs from "fs";
import { randomUUID } from "crypto";
import { error, info } from "@empirica/core/console";
import {
  buildParticipantMetaLines,
  parseParticipantData,
} from "./participantDataHelpers";

// Assume that there aren't namespace conflicts between IDs on different platforms
const participantDataDir = () => `${process.env.DATA_DIR}/participantData`;

function getFileName({ platformId }) {
  return `${participantDataDir()}/${platformId}.jsonl`;
}

export function createNewParticipant({ platformId }) {
  const ts = new Date().toISOString();
  const deliberationId = randomUUID();
  const dir = participantDataDir();

  const writeLines = buildParticipantMetaLines({
    platformId,
    deliberationId,
    ts,
  });

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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

  return { platformId, deliberationId };
}

export async function getParticipantData({ platformId }) {
  // Tries to read existing participant data file.
  // If none exists, creates one, and returns a basic participant object
  const fileName = getFileName({ platformId });

  try {
    const data = fs.readFileSync(fileName, "utf8");
    const participantData = parseParticipantData(data);
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

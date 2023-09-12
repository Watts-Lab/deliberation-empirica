import * as fs from "fs";
import { randomUUID, createHash } from "crypto";
import { pushPreregToGithub } from "./github";

export function preregisterSample({ player, batch, game }) {
  try {
    const sampleId = randomUUID();
    const batchId = batch?.id;
    const gameId = game?.id;
    const exportErrors = [];

    if (batchId !== player?.get("batchId")) {
      const errString = `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId"
      )}`;
      console.error(errString);
      exportErrors.push(errString);
    }

    if (gameId !== player?.get("gameId")) {
      const errString = `Game ID ${gameId} does not match player assigned game ${player?.get(
        "gameId"
      )}`;
      console.error(errString);
      exportErrors.push(errString);
    }

    const participantData = player?.get("participantData");
    const treatment = player?.get("treatment");
    const treatmentMetadata = {
      name: treatment?.name,
      desc: treatment?.desc,
      playerCount: treatment?.playerCount,
      treatmentHash: createHash("sha1")
        .update(JSON.stringify(treatment))
        .digest("hex"),
    };

    const data = {
      sampleId,
      deliberationId: participantData.deliberationId,
      batchId,
      timeBatchInitialized: batch?.get("timeInitialized"),
      gameId,
      config: batch?.get("config")?.config,
      timeStarted: game?.get("timeStarted"),
      position: player?.get("position"),
      treatmentMetadata,
      exportErrors,
    };

    player.set("sampleId", sampleId);

    const outFileName = batch.get("preregistrationDataFilename");
    fs.appendFileSync(outFileName, `${JSON.stringify(data)}\n`, (err) => {
      if (err) {
        console.log(
          `Failed to write preregistration data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        console.log(
          `Writing preregistration data for player ${player.id} to ${outFileName}`
        );
      }
    });

    pushPreregToGithub({ batch });
  } catch (err) {
    console.log("Uncaught exception in preregister.js :", err);
  }
}
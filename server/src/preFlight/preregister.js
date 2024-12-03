import * as fs from "fs";
import { randomUUID, createHash } from "crypto";
import { error, info } from "@empirica/core/console";
import { pushPreregToGithub } from "../providers/github";

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
      error(errString);
      exportErrors.push(errString);
    }

    if (gameId !== player?.get("gameId")) {
      const errString = `Game ID ${gameId} does not match player assigned game ${player?.get(
        "gameId"
      )}`;
      error(errString);
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

    // Take the excess out of the batch config
    const batchConfig = batch?.get("validatedConfig");
    const condensedBatchConfig = batchConfig
      ? JSON.parse(JSON.stringify(batchConfig))
      : "missing";

    if (
      condensedBatchConfig !== "missing" &&
      condensedBatchConfig.knockdowns !== "none"
    ) {
      const input = condensedBatchConfig.knockdowns;
      console.log("type of knockdown", typeof input, input);
      let shape;
      if (typeof input === "number") {
        shape = [1]; // Single number has "shape" of [1]
      } else if (Array.isArray(input) && Array.isArray(input[0])) {
        shape = [input.length, input[0].length]; // 2D array shape
      } else {
        shape = [input.length]; // 1D array shape
      }

      let flatArray;
      if (typeof input === "number") {
        // Convert a single number to a single-element array
        flatArray = [input];
      } else if (Array.isArray(input)) {
        // Flatten the input if it's a nested array
        flatArray = input.flat(Infinity); // Flatten to a 1D array
      } else {
        const errString = `Knockdowns must be a number or an array, but got ${typeof input}`;
        error(errString);
      }
      const sum = flatArray.reduce((acc, val) => acc + val, 0);
      const std = Math.sqrt(
        flatArray.reduce((acc, val) => acc + (val - sum) ** 2, 0) /
          flatArray.length
      );
      const max = Math.max(...flatArray);
      const min = Math.min(...flatArray);

      condensedBatchConfig.knockdownDetails = {
        shape,
        sum,
        std,
        max,
        min,
      };
      condensedBatchConfig.knockdowns = undefined;
    }

    const data = {
      sampleId,
      deliberationId: participantData.deliberationId,
      batchId,
      timeBatchInitialized: batch?.get("timeInitialized"),
      gameId,
      config: condensedBatchConfig,
      timeGameStarted: game?.get("timeGameStarted"),
      position: player?.get("position"),
      treatmentMetadata,
      exportErrors,
    };

    player.set("sampleId", sampleId);

    const outFileName = batch.get("preregistrationDataFilename");
    fs.appendFileSync(outFileName, `${JSON.stringify(data)}\n`, (err) => {
      if (err) {
        error(
          `Failed to write preregistration data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        info(
          `Writing preregistration data for player ${player.id} to ${outFileName}`
        );
      }
    });

    pushPreregToGithub({ batch });
  } catch (err) {
    error("Uncaught exception in preregister.js :", err);
  }
}

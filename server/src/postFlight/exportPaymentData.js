import * as fs from "fs";
import { error, info } from "@empirica/core/console";

export function exportPaymentData({ player, batch }) {
  try {
    const batchId = batch?.id;
    const exportErrors = [];

    if (batchId !== player?.get("batchId")) {
      const errString = `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId"
      )}`;
      error(errString);
      exportErrors.push(errString);
    }

    const outFileName = batch.get("paymentDataFilename");
    const participantData = player.get("participantData");
    const batchConfig = batch?.get("validatedConfig");

    /*
  To add:
  - turk workerId
  - turk assignmentId
  - referrer URL
  */

    const paymentData = {
      batchId,
      batchName: batchConfig.batchName,
      platformId: participantData.platformId,
      introDone: player.get("introDone"),
      timeIntroDone: player.get("timeIntroDone"),
      exitStatus: player.get("exitStatus"),
      connectionInfo: player.get("connectionInfo"),
      exportErrors,
      ...player.get("urlParams"),
    };

    fs.appendFile(outFileName, `${JSON.stringify(paymentData)}\n`, (err) => {
      if (err) {
        error(
          `Failed to write payment data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        info(`Writing payment data for player ${player.id} to ${outFileName}`);
      }
    });
    return outFileName;
  } catch (err) {
    error("Uncaught exception while exporting participantData:", err);
  }
  return null;
}

export function printPaymentData({ batch }) {
  try {
    const outFileName = batch.get("paymentDataFilename");
    fs.readFile(outFileName, "utf8", (err, data) => {
      if (err) {
        error(`Failed to read payment data from ${outFileName}`, err);
      } else {
        info(`Payment data from ${outFileName}:`);
        info(data);
      }
    });
  } catch (err) {
    error("Uncaught exception while printing payment data:", err);
  }
}

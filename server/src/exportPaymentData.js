import * as fs from "fs";

export function exportPaymentData({ player, batch }) {
  try {
    const batchName = batch?.get("config")?.config?.batchName || "unnamedBatch";
    const batchId = batch?.id;
    const exportErrors = [];

    if (batchId !== player?.get("batchId")) {
      const errString = `Batch ID: ${batchId} does not match player assigned batch: ${player?.get(
        "batchId"
      )}`;
      console.error(errString);
      exportErrors.push(errString);
    }

    const outFileName = batch.get("paymentDataFilename");
    const participantData = player.get("participantData");
    const batchConfig = batch?.get("config");

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
      exitStatus: player.get("exitStatus"),
      exportErrors,
      ...player.get("urlParams"),
    };

    fs.appendFile(outFileName, `${JSON.stringify(paymentData)}\n`, (err) => {
      if (err) {
        console.log(
          `Failed to write payment data for player ${player.id} to ${outFileName}`,
          err
        );
      } else {
        console.log(
          `Writing payment data for player ${player.id} to ${outFileName}`
        );
      }
    });
    return outFileName;
  } catch (err) {
    console.log("Uncaught exception while exporting participantData:", err);
  }
  return null;
}

import * as fs from "fs";

// const paymentDataDir = "./testData/paymentData";
const paymentDataDir = `${process.env.DATA_DIR}/paymentData`;

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

    const outFileName = `${paymentDataDir}/batch_${batchName}_${batchId}.payment.jsonl`;
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

    if (!fs.existsSync(paymentDataDir)) {
      fs.mkdirSync(paymentDataDir);
    }

    fs.appendFile(outFileName, `${JSON.stringify(paymentData)}\n`, (err) => {
      if (err) {
        console.log(
          `Failed to write payment data for player ${player.id} to ${outFileName}`
        );
        console.log(err);
      } else {
        console.log(
          `Writing payment data for player ${player.id} to ${outFileName}`
        );
      }
    });
  } catch (err) {
    console.log("Uncaught exception while exporting participantData:", err);
  }
}

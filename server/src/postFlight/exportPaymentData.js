/**
 * Payment-data export orchestrator.
 *
 * Pure row-building logic lives in ./paymentDataHelpers. This module
 * handles the I/O side: writing the JSONL line and (for printPaymentData)
 * reading it back for log output.
 */
import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import {
  buildPaymentData,
  collectPaymentExportErrors,
} from "./paymentDataHelpers";

export function exportPaymentData({ player, batch }) {
  try {
    const exportErrors = collectPaymentExportErrors({ player, batch });
    for (const err of exportErrors) error(err);

    const outFileName = batch.get("paymentDataFilename");
    const paymentData = buildPaymentData({ player, batch, exportErrors });

    try {
      fs.appendFileSync(outFileName, `${JSON.stringify(paymentData)}\n`);
      info(`Writing payment data for player ${player.id} to ${outFileName}`);
    } catch (err) {
      error(
        `Failed to write payment data for player ${player.id} to ${outFileName}`,
        err
      );
    }
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

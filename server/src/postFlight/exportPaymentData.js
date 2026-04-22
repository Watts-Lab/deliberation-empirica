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
import { appendJsonlLine } from "../utils/appendJsonlLine";

export function exportPaymentData({ player, batch }) {
  try {
    const exportErrors = collectPaymentExportErrors({ player, batch });
    for (const err of exportErrors) error(err);

    const outFileName = batch.get("paymentDataFilename");
    const paymentData = buildPaymentData({ player, batch, exportErrors });

    appendJsonlLine({
      filename: outFileName,
      data: paymentData,
      label: "payment data",
      playerId: player.id,
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

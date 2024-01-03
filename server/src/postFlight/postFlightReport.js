import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import { pushDataToGithub } from "../providers/github";

function valueCounts(arr) {
  return arr.reduce((acc, cur) => {
    if (acc[cur] === undefined) {
      acc[cur] = 1;
    } else {
      acc[cur] += 1;
    }
    return acc;
  }, {});
}

function valuePercentages(arr) {
  const counts = valueCounts(arr);
  const total = arr.length;
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, value / total])
  );
}

export function postFlightReport({ ctx, batch }) {
  const report = {};

  // load data
  const preregistrations = fs
    .readFileSync(batch.get("preregistrationDataFilename"))
    .toString()
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        error("Failed to parse line:", line);
        return undefined;
      }
    })
    .filter((line) => line !== undefined);

  const scienceData = fs
    .readFileSync(batch.get("scienceDataFilename"))
    .toString()
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        error("Failed to parse line:", line);
        return undefined;
      }
    })
    .filter((line) => line !== undefined);

  // preregistration rates
  report.preregistrations.total = preregistrations.length;
  report.preregistrations.treatmentBreakdown = valueCounts(
    preregistrations.map((line) => line.treatmentMetadata.name)
  );

  // participant completion rates
  report.participants.total = scienceData.length;
  report.participants.completeIntroSteps = scienceData.filter(
    (line) =>
      line.timeEnteredCountdown !== "missing" ||
      line.timeIntroDone !== "missing"
  ).length;
  report.participants.enterLobby = scienceData.filter(
    (line) => line.timeIntroDone !== "missing"
  ).length;
  report.participants.beginGame = scienceData.filter(
    (line) => line.timeStarted !== "missing"
  ).length;
  report.participants.complete = scienceData.filter(
    (line) => line.exitStatus === "complete"
  ).length;

  // section timings
  const introTimings = scienceData
    .filter(
      (line) =>
        line.timeEnteredCountdown !== "missing" ||
        line.timeIntroDone !== "missing"
    )
    .map(
      (line) =>
        ((Date.parse(line.timeEnteredCountdown) ||
          Date.parse(line.timeIntroDone)) -
          Date.parse(line.timeEnteredCountdown)) /
        1000
    );
  report.timings.intro.max = Math.max(...introTimings);
  report.timings.intro.min = Math.min(...introTimings);
  report.timings.intro.mean =
    introTimings.reduce((acc, cur) => acc + cur, 0) / introTimings.length;
  report.timings.intro.median =
    introTimings.sort()[Math.floor(introTimings.length / 2)];

  const countdownTimings = scienceData
    .filter(
      (line) =>
        line.timeIntroDone !== "missing" &&
        line.timeEnteredCountdown !== "missing"
    )
    .map(
      (line) =>
        (Date.parse(line.timeIntroDone) -
          Date.parse(line.timeEnteredCountdown)) /
        1000
    );
  report.timings.countdown.max = Math.max(...countdownTimings);
  report.timings.countdown.min = Math.min(...countdownTimings);
  report.timings.countdown.mean =
    countdownTimings.reduce((acc, cur) => acc + cur, 0) /
    countdownTimings.length;
  report.timings.countdown.median =
    countdownTimings.sort()[Math.floor(countdownTimings.length / 2)];

  const lobbyTimings = scienceData
    .filter(
      (line) =>
        line.timeIntroDone !== "missing" && line.timeStarted !== "missing"
    )
    .map(
      (line) =>
        (Date.parse(line.timeStarted) - Date.parse(line.timeIntroDone)) / 1000
    );
  report.timings.lobby.max = Math.max(...lobbyTimings);
  report.timings.lobby.min = Math.min(...lobbyTimings);
  report.timings.lobby.mean =
    lobbyTimings.reduce((acc, cur) => acc + cur, 0) / lobbyTimings.length;
  report.timings.lobby.median =
    lobbyTimings.sort()[Math.floor(lobbyTimings.length / 2)];

  // QC stats
  const QCSurveyResponses = scienceData
    .map((line) => line.QCSurvey?.responses)
    .filter((responses) => responses !== undefined);

  report.QC.participateAgain = valuePercentages(
    QCSurveyResponses.map((response) => response.participateAgain)
  );
  report.QC.adequateCompensation = valuePercentages(
    QCSurveyResponses.map((response) => response.adequateCompensation)
  );
  report.QC.adequateTime = valuePercentages(
    QCSurveyResponses.map((response) => response.adequateTime)
  );
  report.QC.clearInstructions = valuePercentages(
    QCSurveyResponses.map((response) => response.clearInstructions)
  );
  report.QC.videoQuality = valuePercentages(
    QCSurveyResponses.map((response) => response.videoQuality)
  );
  report.QC.joiningProblems = valuePercentages(
    QCSurveyResponses.map((response) => response.joiningProblems)
  );
  report.QC.technicalProblems = valuePercentages(
    QCSurveyResponses.map((response) => response.technicalProblems)
  );
  report.QC.textExpansion = QCSurveyResponses.map(
    (response) => response.textExpansion
  ).filter(
    (text) => !["no", "nan", "none"].includes(text.toLowerCase().trim())
  );
  report.QC.technicalDetail = QCSurveyResponses.map(
    (response) => response.technicalDetail
  ).filter(
    (text) => !["no", "nan", "none"].includes(text.toLowerCase().trim())
  );
  report.QC.joiningDetail = QCSurveyResponses.map(
    (response) => response.joiningDetail
  ).filter(
    (text) => !["no", "nan", "none"].includes(text.toLowerCase().trim())
  );

  // write report to file
  fs.writeFileSync(
    batch.get("postFlightReportFilename"),
    JSON.stringify(report, null, 2)
  );
}

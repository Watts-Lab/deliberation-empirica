import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import { pushPostFlightReportToGithub } from "../providers/github";
import {
  valueCounts,
  valuePercentages,
  summarizeNumericArray,
  sumFieldAcross,
  filterFreeTextResponses,
} from "./postFlightReportHelpers";

export async function postFlightReport({ batch }) {
  const report = {};

  // load data
  const preregistrationsFound = fs.existsSync(
    batch.get("preregistrationDataFilename"),
  );

  const preregistrations = preregistrationsFound
    ? fs // if the file exists, load it
        .readFileSync(batch.get("preregistrationDataFilename"))
        .toString()
        .split("\n")
        .filter((line) => line !== "")
        .map((line, index) => {
          try {
            return JSON.parse(line);
          } catch (err) {
            error(`Failed to parse preregistration line ${index} :`, line);
            return undefined;
          }
        })
        .filter((line) => line !== undefined)
    : []; // otherwise, just use an empty array

  const scienceDataFilename = batch.get("scienceDataFilename");
  let scienceData = [];
  if (scienceDataFilename && fs.existsSync(scienceDataFilename)) {
    scienceData = fs
      .readFileSync(scienceDataFilename)
      .toString()
      .split("\n")
      .filter((line) => line !== "")
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          error(`Failed to parse science data line ${index}:`, line);
          return undefined;
        }
      })
      .filter((line) => line !== undefined);
  } else {
    error("No science data file found with filename:", scienceDataFilename);
  }

  // const serverLogs = fs
  //   .readFileSync(`${process.env.DATA_DIR}/empirica.log`)
  //   .toString()
  //   .split("\n");

  // one error is the test error, so if the error count is minus one, then we know that there was an error read issue
  // only listing the error count here, rather than the error lines themselves
  // because we won't get the full error message anyways, and can't guarantee
  // that the full error message won't contain sensitive information
  // report.errorCount =
  //   serverLogs.filter((line) => line.includes("[1mERR")).length - 1;

  // preregistration rates
  report.preregistrations = {};
  report.preregistrations.total = preregistrations.length;
  report.preregistrations.treatmentBreakdown = valueCounts(
    preregistrations.map((line) => line.treatmentMetadata.name),
  );
  const preregisteredSampleIds = new Set(
    preregistrations.map((line) => line.sampleId),
  );
  const completedSampleIds = new Set(
    scienceData
      .filter((line) => line.exitStatus === "complete")
      .map((line) => line.sampleId),
  );

  report.preregistrations.percentComplete =
    (completedSampleIds.size / preregisteredSampleIds.size) * 100;

  // participant completion rates
  report.participants = {};
  report.participants.total = scienceData.length;
  report.participants.completeIntroSteps = scienceData.filter(
    (line) =>
      line.timeEnteredCountdown !== "missing" ||
      line.timeIntroDone !== "missing",
  ).length;
  report.participants.enterLobby = scienceData.filter(
    (line) => line.timeIntroDone !== "missing",
  ).length;
  report.participants.beginGame = scienceData.filter(
    (line) => line.timeGameStarted !== "missing",
  ).length;
  report.participants.finishGame = scienceData.filter(
    (line) => line.timeGameEnded !== "missing",
  ).length;
  report.participants.complete = scienceData.filter(
    (line) => line.exitStatus === "complete",
  ).length;

  // list completed sample ids
  report.completedSampleIds = scienceData
    .filter((line) => line.exitStatus === "complete")
    .map((line) => line.sampleId);

  // timezone and country breakdown
  report.participants.ipTimezoneBreakdown = valueCounts(
    scienceData.map((line) => line.connectionInfo.timezone),
  );
  report.participants.ipCountryBreakdown = valueCounts(
    scienceData.map((line) => line.connectionInfo.country),
  );
  report.participants.possibleVPN = valueCounts(
    scienceData.map(
      (line) => line.connectionInfo.timezone !== line.browserInfo.timezone,
    ),
  );
  report.participants.browserLanguageBreakdown = valueCounts(
    scienceData.map((line) => line.browserInfo.language),
  );
  report.participants.browserTimezoneBreakdown = valueCounts(
    scienceData.map((line) => line.browserInfo.timezone),
  );
  report.participants.knownVPN = valueCounts(
    scienceData.map((line) => line.connectionInfo.isKnownVpn),
  );

  // section timings — all computed from science data timestamps, in seconds
  const introTimings = scienceData
    .filter(
      (line) =>
        line.times.playerEnteredCountdown !== "missing" ||
        line.times.playerIntroDone !== "missing",
    )
    .map(
      (line) =>
        ((line.times.playerEnteredCountdown !== "missing"
          ? Date.parse(line.times.playerEnteredCountdown)
          : Date.parse(line.times.playerIntroDone)) -
          Date.parse(line.times.playerArrived)) /
        1000,
    );

  const countdownTimings = scienceData
    .filter(
      (line) =>
        line.times.playerIntroDone !== "missing" &&
        line.times.playerEnteredCountdown !== "missing",
    )
    .map(
      (line) =>
        (Date.parse(line.times.playerIntroDone) -
          Date.parse(line.times.playerEnteredCountdown)) /
        1000,
    );

  const lobbyTimings = scienceData
    .filter(
      (line) =>
        line.times.playerIntroDone !== "missing" &&
        line.times.gameStarted !== "missing",
    )
    .map(
      (line) =>
        (Date.parse(line.times.gameStarted) -
          Date.parse(line.times.playerIntroDone)) /
        1000,
    );

  const gameTimings = scienceData
    .filter(
      (line) =>
        line.times.gameEnded !== "missing" &&
        line.times.gameStarted !== "missing",
    )
    .map(
      (line) =>
        (Date.parse(line.times.gameEnded) -
          Date.parse(line.times.gameStarted)) /
        1000,
    );

  const exitTimings = scienceData
    .filter(
      (line) =>
        line.times.gameEnded !== "missing" &&
        line.times.playerComplete !== "missing",
    )
    .map(
      (line) =>
        (Date.parse(line.times.playerComplete) -
          Date.parse(line.times.gameEnded)) /
        1000,
    );

  report.timings = {
    intro: summarizeNumericArray(introTimings),
    countdown: summarizeNumericArray(countdownTimings),
    lobby: summarizeNumericArray(lobbyTimings),
    game: summarizeNumericArray(gameTimings),
    exit: summarizeNumericArray(exitTimings),
    totalTime: {},
    totalActiveTime: {},
  };

  const fields = ["max", "min", "mean", "median"];
  const allPhases = [
    report.timings.intro,
    report.timings.countdown,
    report.timings.lobby,
    report.timings.game,
    report.timings.exit,
  ];
  // "Active" time excludes the countdown between intro and lobby.
  const activePhases = [
    report.timings.intro,
    report.timings.lobby,
    report.timings.game,
    report.timings.exit,
  ];
  fields.forEach((field) => {
    report.timings.totalTime[field] = sumFieldAcross(allPhases, field);
    report.timings.totalActiveTime[field] = sumFieldAcross(activePhases, field);
  });

  // disconnection/reconnection rates
  const connectionEvents = scienceData
    .filter((line) => line.connectionHistory !== "missing")
    .map(
      (line) =>
        line.connectionHistory.filter((event) => event.connected === true)
          .length,
    );

  report.connections = summarizeNumericArray(connectionEvents);

  // QC stats
  report.QC = {};
  const QCSurveyResponses = scienceData
    .map((line) => line.QCSurvey?.responses)
    .filter((responses) => responses !== undefined);

  report.QC.participateAgain = valuePercentages(
    QCSurveyResponses.map((response) => response.participateAgain),
  );
  report.QC.adequateCompensation = valuePercentages(
    QCSurveyResponses.map((response) => response.adequateCompensation),
  );
  report.QC.adequateTime = valuePercentages(
    QCSurveyResponses.map((response) => response.adequateTime),
  );
  report.QC.clearInstructions = valuePercentages(
    QCSurveyResponses.map((response) => response.clearInstructions),
  );
  report.QC.videoQuality = valuePercentages(
    QCSurveyResponses.map((response) => response.videoQuality),
  );
  report.QC.joiningProblems = valuePercentages(
    QCSurveyResponses.map((response) => response.joiningProblems),
  );
  report.QC.technicalProblems = valuePercentages(
    QCSurveyResponses.map((response) => response.technicalProblems),
  );
  report.QC.textExpansion = filterFreeTextResponses(
    QCSurveyResponses.map((response) => response.textExpansion),
  );
  report.QC.technicalDetail = filterFreeTextResponses(
    QCSurveyResponses.map((response) => response.technicalDetail),
  );
  report.QC.joiningDetail = filterFreeTextResponses(
    QCSurveyResponses.map((response) => response.joiningDetail),
  );

  // count of players reporting discussion problems at least once
  report.participants.reportingDiscussionProblems = scienceData.filter(
    (line) => line.reports.length > 0,
  ).length;

  // count of players checking in at least once
  report.participants.checkingIn = scienceData.filter(
    (line) => line.checkIns.length > 0,
  ).length;

  // report the final payoffs for the dispatcher
  report.finalPayoffs = batch.get("finalPayoffs");

  // Pin the state of deliberation-assets at batch init; `git show <sha>:<path>`
  // recovers what participants saw (issue #10).
  report.assetsRepoSha = batch.get("assetsRepoSha");

  // todo: check that the expected video files are saved in S3

  info("Post-flight report:", report);

  try {
    const reportFilename = batch.get("postFlightReportFilename");

    // write report to file
    fs.writeFileSync(reportFilename, JSON.stringify(report, null, 2));

    // push report to github
    await pushPostFlightReportToGithub({ batch });
  } catch (err) {
    error("Failed to write post-flight report:", err);
  }
}

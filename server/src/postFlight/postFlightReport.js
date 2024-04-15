import * as fs from "fs";
import { error, info } from "@empirica/core/console";
import { pushPostFlightReportToGithub } from "../providers/github";

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

export async function postFlightReport({ batch }) {
  const report = {};

  // load data
  const preregistrationsFound = fs.existsSync(
    batch.get("preregistrationDataFilename")
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

  const scienceData = fs
    .readFileSync(batch.get("scienceDataFilename"))
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
    preregistrations.map((line) => line.treatmentMetadata.name)
  );
  const preregisteredSampleIds = new Set(
    preregistrations.map((line) => line.sampleId)
  );
  const completedSampleIds = new Set(
    scienceData
      .filter((line) => line.exitStatus === "complete")
      .map((line) => line.sampleId)
  );

  report.preregistrations.percentComplete =
    (completedSampleIds.size / preregisteredSampleIds.size) * 100;

  // participant completion rates
  report.participants = {};
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
    (line) => line.timeGameStarted !== "missing"
  ).length;
  report.participants.finishGame = scienceData.filter(
    (line) => line.timeGameEnded !== "missing"
  ).length;
  report.participants.complete = scienceData.filter(
    (line) => line.exitStatus === "complete"
  ).length;

  // timezone and country breakdown
  report.participants.ipTimezoneBreakdown = valueCounts(
    scienceData.map((line) => line.connectionInfo.timezone)
  );
  report.participants.ipCountryBreakdown = valueCounts(
    scienceData.map((line) => line.connectionInfo.country)
  );
  report.participants.possibleVPN = valueCounts(
    scienceData.map(
      (line) => line.connectionInfo.timezone !== line.browserInfo.timezone
    )
  );
  report.participants.browserLanguageBreakdown = valueCounts(
    scienceData.map((line) => line.browserInfo.language)
  );
  report.participants.browserTimezoneBreakdown = valueCounts(
    scienceData.map((line) => line.browserInfo.timezone)
  );
  report.participants.knownVPN = valueCounts(
    scienceData.map((line) => line.connectionInfo.isKnownVpn)
  );

  // section timings
  report.timings = { intro: {}, countdown: {}, lobby: {}, game: {}, exit: {} };
  const introTimings = scienceData
    .filter(
      (line) =>
        line.timeEnteredCountdown !== "missing" ||
        line.timeIntroDone !== "missing"
    )
    .map(
      (line) =>
        ((line.timeEnteredCountdown !== "missing"
          ? Date.parse(line.timeEnteredCountdown)
          : Date.parse(line.timeIntroDone)) -
          Date.parse(line.timeArrived)) /
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
        line.timeIntroDone !== "missing" && line.timeGameStarted !== "missing"
    )
    .map(
      (line) =>
        (Date.parse(line.timeGameStarted) - Date.parse(line.timeIntroDone)) /
        1000
    );
  report.timings.lobby.max = Math.max(...lobbyTimings);
  report.timings.lobby.min = Math.min(...lobbyTimings);
  report.timings.lobby.mean =
    lobbyTimings.reduce((acc, cur) => acc + cur, 0) / lobbyTimings.length;
  report.timings.lobby.median =
    lobbyTimings.sort()[Math.floor(lobbyTimings.length / 2)];

  const gameTimings = scienceData
    .filter(
      (line) =>
        line.timeGameEnded !== "missing" && line.timeGameStarted !== "missing"
    )
    .map(
      (line) =>
        (Date.parse(line.timeGameEnded) - Date.parse(line.timeGameStarted)) /
        1000
    );
  report.timings.game.max = Math.max(...gameTimings);
  report.timings.game.min = Math.min(...gameTimings);
  report.timings.game.mean =
    gameTimings.reduce((acc, cur) => acc + cur, 0) / gameTimings.length;
  report.timings.game.median =
    gameTimings.sort()[Math.floor(gameTimings.length / 2)];

  const exitTimings = scienceData
    .filter(
      (line) =>
        line.timeGameEnded !== "missing" && line.timeComplete !== "missing"
    )
    .map(
      (line) =>
        (Date.parse(line.timeComplete) - Date.parse(line.timeGameEnded)) / 1000
    );
  report.timings.exit.max = Math.max(...exitTimings);
  report.timings.exit.min = Math.min(...exitTimings);
  report.timings.exit.mean =
    exitTimings.reduce((acc, cur) => acc + cur, 0) / exitTimings.length;
  report.timings.exit.median =
    exitTimings.sort()[Math.floor(exitTimings.length / 2)];

  // disconnection/reconnection rates
  const connectionEvents = scienceData
    .filter((line) => line.connectionHistory !== "missing")
    .map(
      (line) =>
        line.connectionHistory.filter((event) => event.connected === true)
          .length
    );

  report.connections = {};
  report.connections.min = Math.min(...connectionEvents);
  report.connections.max = Math.max(...connectionEvents);
  report.connections.mean =
    connectionEvents.reduce((acc, cur) => acc + cur, 0) /
    connectionEvents.length;
  report.connections.median =
    connectionEvents.sort()[Math.floor(connectionEvents.length / 2)];

  // QC stats
  report.QC = {};
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
    (text) =>
      !["no", "nan", "none", "nothing", "undefined"].includes(
        text?.toLowerCase().trim()
      )
  );
  report.QC.technicalDetail = QCSurveyResponses.map(
    (response) => response.technicalDetail
  ).filter(
    (text) =>
      !["no", "nan", "none", "nothing", "undefined"].includes(
        text?.toLowerCase().trim()
      )
  );
  report.QC.joiningDetail = QCSurveyResponses.map(
    (response) => response.joiningDetail
  ).filter(
    (text) =>
      !["no", "nan", "none", "nothing", "undefined"].includes(
        text?.toLowerCase().trim()
      )
  );

  // count of players reporting discussion problems at least once
  report.participants.reportingDiscussionProblems = scienceData.filter(
    (line) => line.reports.length > 0
  ).length;

  // count of players checking in at least once
  report.participants.checkingIn = scienceData.filter(
    (line) => line.checkIns.length > 0
  ).length;

  // todo: check that the expected video files are saved in S3

  info("Post-flight report:", report);

  // write report to file
  fs.writeFileSync(
    batch.get("postFlightReportFilename"),
    JSON.stringify(report, null, 2)
  );

  // push report to github
  await pushPostFlightReportToGithub({ batch });
}

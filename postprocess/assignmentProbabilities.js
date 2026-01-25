import { getTreatments } from "../server/src/getTreatments";
import { makeDispatcher } from "../server/src/preFlight/dispatch";

export function loadPlayersFromFiles({ filePaths }) {
  console.log("Loading players from files:", filePaths);
  const fs = require("fs");

  const players = [];

  filePaths.forEach((path) => {
    const lines = fs.readFileSync(path, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      const data = JSON.parse(line);
      players.push({
        id: data.deliberationId,
        // data,
        get: (key) => {
          if (key.startsWith("prompt")) {
            // console.log("value: ", data.prompts[key]);
            return data.prompts[key];
          } else if (key.startsWith("survey")) {
            return data.surveys[key];
          } else if (key.startsWith("connectionInfo")) {
            return data.connectionInfo;
          } else if (key.startsWith("sampleId")) {
            return data.sampleId;
          } else {
            console.log("key: ", key);
          }
        },
      });
    }
  });

  return players;
}

function deduplicatePlayers(players) {
  const seen = new Set();
  const unique = [];

  for (const player of players) {
    if (!seen.has(player.id)) {
      seen.add(player.id);
      unique.push(player);
    }
  }

  return unique;
}

export async function assignmentProbabilities({
  config,
  filePaths,
  outfilePath,
}) {
  const fs = require("fs");
  const {
    cdn,
    treatmentFile,
    treatments: treatmentNames,
    payoffs,
    knockdowns,
    introSequence,
  } = config;

  console.log("filePaths", filePaths);
  const players = deduplicatePlayers(
    loadPlayersFromFiles({ filePaths }).filter(
      (player) => player.get("sampleId") !== "missing"
    )
  );
  console.log("Found this many players", players.length);

  const { treatments } = await getTreatments({
    cdn,
    path: treatmentFile,
    treatmentNames,
    introSequenceName: introSequence,
  });

  console.log("Found this many treatments", treatments.length);

  for (let i = 0; i < 50000; i++) {
    const dispatcher = makeDispatcher({
      treatments,
      payoffs,
      knockdowns,
      requiredFractionOfMaximumPayoff: 0.9,
      maxIter: 5000,
      minIter: 100,
    });

    const { assignments, finalPayoffs } = dispatcher(players);
    const playerAssignments = {};
    assignments.forEach(({ treatment, positionAssignments }) => {
      positionAssignments.forEach(({ playerId }) => {
        playerAssignments[playerId] = treatment.name;
      });
    });
    fs.appendFileSync(outfilePath, JSON.stringify(playerAssignments) + "\n");
  }
}

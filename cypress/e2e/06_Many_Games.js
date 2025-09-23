const configJson = `{
  "batchName": "cytest_06",
  "cdn": "test",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "customIdInstructions": "none",
  "platformConsent": "UK",
  "consentAddendum": "none",
  "checkAudio": true,
  "checkVideo": true,
  "introSequence": "none",
  "treatments": [
    "cypress2_simple"
  ],
  "payoffs": "equal",
  "knockdowns": "none",
  "dispatchWait": 4,
  "launchDate": "immediate",
  "centralPrereg": false,
  "preregRepos": [],
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "cypress_test_exports"
    }
  ],
  "videoStorage": "none",
  "exitCodes": "none"
}`;

describe("Many Games", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();
    cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);
  });

  it("handles game creation properly", () => {
    const playerKeys = Array(16)
      .fill()
      .map(
        (a, index) => `testplayer_${index}_${Math.floor(Math.random() * 1e13)}`
      );

    // Onboard first 8 players
    // Should start 4 games
    cy.empiricaSetupWindow({ playerKeys: playerKeys.slice(0, 8) });
    cy.interceptIpApis();

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepPreIdChecks(playerKey, {
        checks: ["webcam", "mic", "headphones"],
      });
      cy.stepIntro(playerKey);
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    cy.window().then((win) => {
      cy.wrap(win.batchLabel).as("batchLabel");
    });

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepAttentionCheck(playerKey);
      cy.stepVideoCheck(playerKey, {});
    });

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepNickname(playerKey);
    });

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });

    // Onboard next 4 players
    cy.empiricaSetupWindow({ playerKeys: playerKeys.slice(4, 12) });
    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.stepPreIdChecks(playerKey, {
        checks: ["webcam", "mic", "headphones"],
      });
      cy.stepIntro(playerKey);
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.stepAttentionCheck(playerKey);
      cy.stepVideoCheck(playerKey, {});
      cy.stepNickname(playerKey);
    });

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });

    // Onboard next 4 players
    cy.empiricaSetupWindow({ playerKeys: playerKeys.slice(8, 16) });
    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepPreIdChecks(playerKey, {
        checks: ["webcam", "mic", "headphones"],
      });
      cy.stepIntro(playerKey);
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepAttentionCheck(playerKey);
      cy.stepVideoCheck(playerKey, {});
      cy.stepNickname(playerKey);
    });

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });

    // end the batch
    cy.empiricaClearBatches();
    cy.wait(3000);

    // get science data
    cy.get("@batchLabel").then((batchLabel) => {
      cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
        .then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          const objs = lines.map((line) => JSON.parse(line));
          return objs;
        })
        .as("dataObjects");
    });

    const valueCounts = (a) =>
      new Map([...new Set(a)].map((x) => [x, a.filter((y) => y === x).length]));

    // check that each room has two players assigned to it, as expected
    cy.get("@dataObjects").then((dataObjects) => {
      const recordingsFolders = dataObjects.map((obj) => obj.recordingsFolder);
      const counts = valueCounts(recordingsFolders);
      expect(counts.size).to.equal(8);
      expect(Array.from(counts.values())).to.deep.equal([
        2, 2, 2, 2, 2, 2, 2, 2,
      ]);
    });

    // check for server-side errors
    cy.readFile(`../data/empirica.log`).as("empiricaLogs");
    cy.get("@empiricaLogs").then((txt) => {
      const errorLines = txt
        .split("\n")
        .filter((line) => line.includes("[1mERR"));
      console.log("errorLines", errorLines);
      expect(errorLines).to.have.length(1);
      expect(errorLines[0]).to.include("Error test message from batch");
    });
  });
});

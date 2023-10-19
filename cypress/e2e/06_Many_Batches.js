const configJson = `{
  "batchName": "cytest_06",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 4,
  "cdn": "test",
  "treatments": [
    "cypress2_simple"
  ],
  "videoStorageLocation": "deliberation-lab-recordings-test",
  "dataRepos": [
    {
      "owner": "Watts-Lab",
      "repo": "deliberation-data-test",
      "branch": "main",
      "directory": "cypress_test_exports"
    }
  ]
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

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepIntro(playerKey, { checks: ["webcam", "mic", "headphones"] });
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.slice(0, 8).forEach((playerKey) => {
      cy.stepVideoCheck(playerKey, { headphonesRequired: true });
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
      cy.stepIntro(playerKey, { checks: ["webcam", "mic", "headphones"] });
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.stepVideoCheck(playerKey, { headphonesRequired: true });
      cy.stepNickname(playerKey);
    });

    playerKeys.slice(8, 12).forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });

    // Onboard next 4 players
    cy.empiricaSetupWindow({ playerKeys: playerKeys.slice(8, 16) });
    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepIntro(playerKey, { checks: ["webcam", "mic", "headphones"] });
    });
    cy.wait(1000); // wait for player join callbacks to complete

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.stepVideoCheck(playerKey, { headphonesRequired: true });
      cy.stepNickname(playerKey);
    });

    playerKeys.slice(12, 16).forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
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

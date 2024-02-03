const configJson = `{
    "batchName": "cytest_12",
    "treatmentFile": "projects/example/cypress.treatments.yaml",
    "dispatchWait": 1,
    "cdn": "test",
    "exitCodeStem": "cypress",
    "treatments": [
      "cypress_textChat"
    ],
    "videoStorageLocation": "none",
    "checkAudio": false,
    "checkVideo": false,
    "dataRepos": [
      {
        "owner": "Watts-Lab",
        "repo": "deliberation-data-test",
        "branch": "main",
        "directory": "cypress_test_exports"
      }
    ]
  }`;

describe("Player Not Matched", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();
    cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);
  });

  it("handles player not matched", () => {
    const playerKeys = [`testplayer_${Math.floor(Math.random() * 1e13)}`];
    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();
    cy.stepIntro(playerKeys[0], {}); // no audio or video check

    cy.window().then((win) => {
      cy.spy(win.console, "log").as("consoleLog");
    });

    cy.stepConsent(playerKeys[0]);
    cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));

    cy.stepAttentionCheck(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[0], { headphonesRequired: false });
    cy.stepNickname(playerKeys[0]);

    cy.contains("waiting for other players to join");
    cy.contains("it's taking longer than we expected to match you").should(
      "not.exist"
    );

    cy.wait(8000);
    cy.contains("it's taking longer than we expected to match you");
    cy.contains("cypress408");
    // Wait in lobby
  });
});

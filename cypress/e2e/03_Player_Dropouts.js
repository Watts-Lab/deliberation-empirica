
const configJson = `{
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 1,
  "useTreatments": [
    "long_disc"
  ]
}`;

describe("Player dropout", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();

    cy.empiricaCreateCustomBatch(configJson);
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.empiricaStartBatch(1);
  });

  it("game set", () => {
    const playerKeys = [
    `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
    `testplayer_B_${Math.floor(Math.random() * 1e13)}`,
    ];

    const hitId = "cypressTestHIT";
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys, hitId });
    cy.wait(2000); // wait for player join callbacks to complete

    cy.window().then((win) => {
      cy.spy(win.console, "log").as("consoleLog");
    });

    cy.stepConsent(playerKeys[0]);
    cy.stepConsent(playerKeys[1]);

    // Video check
    cy.stepVideoCheck(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[1]);

    cy.stepNickname(playerKeys[0]);
    cy.stepNickname(playerKeys[1]);

    cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
    cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

    cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait
    cy.waitForGameLoad(playerKeys[0]);
    cy.waitForGameLoad(playerKeys[1]);

    // it seems like this makes palyer A and B disconnect, and then
    // player A connects
    const url = `/?playerKey=${playerKeys[0]}`;
    cy.visit(url, { log: false });

    // contains, asserts -- can see with 01 omnibus

    cy.wait(22000) // this is just a wait time since the discussion is 40 seconds.
    // all you need to do is to check that player 0 
    // successfully advances to the next stage

    cy.contains("I felt lonely")
    // cy.stepExampleSurvey(playerKeys[0]);
    // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");


    })
});
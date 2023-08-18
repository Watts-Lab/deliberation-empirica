import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_03_textChat",
        "treatmentFile": "projects/example/treatments.test.yaml",
        "dispatchWait": 1,
        "cdn": "test",
        "treatments": [
          "cypress_textChat"
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

      cy.empiricaCreateCustomBatch(configJson);
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
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

      // Consent
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "addendum to the standard consent"
      ); // lobby wait
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);

      cy.window().then((win) =>
        cy.wrap(win.batchTimeInitialized).as("batchTimeInitialized")
      );

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // Countdown and Lobby
      cy.stepCountdown(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait

      // Player 2 complete, trigger dispatch
      cy.stepCountdown(playerKeys[1]);

      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Qualtrics

      cy.get("@consoleLog").should("be.calledWith", "Playing Audio");

      // Exit steps
      cy.wait(5000);

      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Help us improve",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // TODO: check data is where we expect for P1
      // cy.window().then((win) => {
      //   const path = "../testData/scienceData";
      //   cy.readFile(
      //     `${path}/batch_cytest_01_${win.batchId}.jsonl`
      //   ).should("match", /Cypress_01_Normal_Paths_Omnibus/);
      // });
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/scienceData/batch_${batchTimeInitialized}_cytest_01.jsonl`
        ).should(
          "match",
          /testplayer_A/ // player writes this in some of the open response questions
        );

        cy.readFile(
          `../data/paymentData/batch_${batchTimeInitialized}_cytest_01.payment.jsonl`
        ).should(
          "match",
          /testplayer_A/ // player writes this in some of the open response questions
        );
      });

      // Player 2 exit steps

      cy.stepTeamViabilitySurvey(playerKeys[1]);
      cy.stepExampleSurvey(playerKeys[1]);

      // Player 2 doesn't finish the exit steps
      //
      // // QC Survey P2
      // cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
      //   "Thank you for participating",
      //   { timeout: 5000 }
      // );
      // cy.stepQCSurvey(playerKeys[1]);
      // cy.get(`[test-player-id="${playerKeys[1]}"]`).contains("Finished");

      // Player B data has not been saved yet
      // Todo: check that player B's data is not yet saved

      // cy.wait(3000); // ensure that p2 completion time will be different from p1
      // close the batch.
      // this should trigger unfinished player data write
      cy.empiricaClearBatches();

      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/scienceData/batch_${batchTimeInitialized}_cytest_01.jsonl`
        )
          .should(
            "match",
            /testplayer_B/ // player writes this in some of the open response questions
          )
          .should("match", /this is it!/);

        cy.readFile(
          `../data/paymentData/batch_${batchTimeInitialized}_cytest_01.payment.jsonl`
        ).should(
          "match",
          /testplayer_B/ // player writes this in some of the open response questions
        );
      });

      // Check that players still see "thanks for participating" message
      cy.visit(`/?playerKey=${playerKeys[0]}`);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "The experiment is now finished.",
        { timeout: 10000 }
      );
    });
  }
);

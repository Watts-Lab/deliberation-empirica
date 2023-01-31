import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "treatmentFile": "treatments.test.yaml",
        "launchDate": "${dayjs()
          .add(30, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "dispatchWait": 3,
        "useTreatments": [
          "cypress_omnibus"
        ]
      }`;

      cy.empiricaCreateCustomBatch(configJson);
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      const playerKeys = [
        `test_A_${Math.floor(Math.random() * 1e13)}`,
        `test_B_${Math.floor(Math.random() * 1e13)}`,
      ];

      const hitId = "cypressTestHIT";
      // Consent and Login
      cy.empiricaLoginPlayers({ playerKeys, hitId });
      cy.wait(2000); // wait for player join callbacks to complete

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
      });

      // Instructions and Understanding Check
      cy.stepInstructions(playerKeys[0]);
      cy.stepInstructions(playerKeys[1]);

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      // Countdown
      cy.stepCountdown(playerKeys[0]);
      cy.stepCountdown(playerKeys[1]);

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait
      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Pre-questions
      cy.get("@consoleLog").should("be.calledWith", "Stage 0: Topic Survey");
      cy.stepPreQuestion(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other player"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // Watch training video
      cy.get("@consoleLog").should("be.calledWith", "Stage 1: Training Video");
      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // Icebreaker
      cy.stepIcebreaker(playerKeys[0]);
      cy.stepIcebreaker(playerKeys[1]);

      // Discussion
      cy.get("@consoleLog").should("be.calledWith", "Stage 2: Discussion");
      cy.waitUntil(() =>
        cy
          .get("body", { log: false })
          .then(($body) => $body.find("you have in common").length < 1)
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "level of agreement",
        { timeout: 15000 }
      );
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Playing Audio: airplane_chime.mp3"
      );

      // Exit steps

      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      // QC Survey P1
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Thank you for participating",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // Player 2 exit steps
      cy.stepTeamViabilitySurvey(playerKeys[1]);
      cy.wait(3000); // ensure that p2 completion time will be different from p1
      cy.stepExampleSurvey(playerKeys[1]);

      // QC Survey P2
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Thank you for participating",
        { timeout: 5000 }
      );

      cy.stepQCSurvey(playerKeys[1]);

      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains("Finished");

      // check that the batch is done
      cy.empiricaLoginAdmin();
      cy.waitUntil(
        () =>
          cy
            .get("body", { log: false })
            .then(($body) => $body.find('button:contains("Stop")').length < 1),
        { log: false }
      );

      // Check that data was entered into tajriba.json
      cy.empiricaDataContains([
        `Check_${playerKeys[0]}_text_entry`,
        `Check_${playerKeys[1]}_text_entry`,
      ]);

      // cy.empiricaPaymentFileContains({
      //   paymentFilename: `payments_turk_${hitId}.csv`,
      //   contents: playerKeys,
      // });
    });
  }
);

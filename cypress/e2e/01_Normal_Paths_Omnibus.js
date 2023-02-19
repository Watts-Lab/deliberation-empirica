import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "Cypress_01_Normal_Paths_Omnibus",
        "treatmentFile": "treatments.test.yaml",
        "launchDate": "${dayjs()
          .add(30, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "dispatchWait": 1,
        "useIntroSequence": "cypress_standard",
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

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      // Political affilliation survey
      cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

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
        "Please wait for other participant"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // // example survey
      cy.get("@consoleLog").should("be.calledWith", "Stage 1: Survey Library");
      cy.stepExampleSurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[1]);

      // Watch training video
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please take a moment"
      );
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWithMatch",
        /Playing video from/
      );

      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // Icebreaker
      cy.stepIcebreaker(playerKeys[0]);
      cy.stepIcebreaker(playerKeys[1]);

      // Discussion
      // cy.get("@consoleLog").should("be.calledWith", "Stage 3: Discussion");
      cy.waitUntil(() =>
        cy
          .get("body", { log: false })
          .then(($body) => $body.find("you have in common").length < 1)
      );

      // TODO:
      // - this is commented out because it fails because of the timer error
      // reported here: https://github.com/empiricaly/empirica/issues/207
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "level of agreement",
        { timeout: 15000 }
      );
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Playing Audio: airplane_chime.mp3"
      );

      // Exit steps
      cy.wait(5000);

      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      // QC Survey P1
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Thank you for participating",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // TODO: check data is where we expect for P1
      cy.window().then((win) => {
        const path = "../testData/scienceData";
        cy.readFile(
          `${path}/batch_Cypress_01_Normal_Paths_Omnibus_${win.batchId}.jsonl`
        ).should("match", /Cypress_01_Normal_Paths_Omnibus/);
      });

      // TODO: close the batch

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

      // TODO: check data is where we expect for P2
    });
  }
);

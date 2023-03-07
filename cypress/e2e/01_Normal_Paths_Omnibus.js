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
        "treatmentFile": "projects/example/treatments.test.yaml",
        "launchDate": "${dayjs()
          .add(25, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "dispatchWait": 1,
        "useIntroSequence": "cypress_standard_complete",
        "consentAddendum": "projects/example/consentAddendum.md",
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

      // Consent
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "addendum to the standard consent"
      ); // lobby wait
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // Political affilliation survey
      cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

      // cy.stepPreQuestion(playerKeys[0]);
      // cy.stepPreQuestion(playerKeys[1]);

      // Countdown
      cy.stepCountdown(playerKeys[0]);
      cy.stepCountdown(playerKeys[1]);

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait
      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Qualtrics
      cy.get("@consoleLog").should("be.calledWith", "Stage 0: Qualtrics Test");
      cy.stepQualtrics(playerKeys[0]);
      // because both players share a window, submits both players
      // not sure of a workaround, means we can't have multiple qualtrics surveys on one page.
      // also, may need to clear the message if we do sequential qualtrics surveys?
      // cy.stepQualtrics(playerKeys[1]);

      // Pre-questions
      cy.get("@consoleLog").should("be.calledWith", "Stage 1: Topic Survey");
      cy.stepPreQuestion(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other participant"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // // example survey
      cy.get("@consoleLog").should("be.calledWith", "Stage 2: Survey Library");
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

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "strong magical field",
        { timeout: 7000 }
      );

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "the following wizards",
        { timeout: 10000 }
      );

      cy.get("@consoleLog").should(
        "be.calledWith",
        "Playing Audio: shared/airplane_chime.mp3"
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

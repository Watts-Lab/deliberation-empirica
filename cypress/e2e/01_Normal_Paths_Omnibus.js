import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_01",
        "treatmentFile": "projects/example/treatments.test.yaml",
        "launchDate": "${dayjs()
          .add(25, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "dispatchWait": 1,
        "introSequence": "cypress_intro",
        "consentAddendum": "projects/example/consentAddendum.md",
        "cdn": "test",
        "treatments": [
          "cypress_omnibus"
        ],
        "videoStorageLocation": "deliberation-lab-recordings-test",
        "preregister": true,
        "dataRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "cypress_test_exports"
          },
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "cypress_test_exports2"
          }
        ],
        "preregRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "preregistration"
          }
        ]
      }`;

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      Cypress.Cookies.debug(true);

      const playerKeys = [
        `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_B_${Math.floor(Math.random() * 1e13)}`,
      ];

      const hitId = "cypressTestHIT";
      // Consent and Login
      cy.empiricaSetupWindow({ playerKeys, hitId });
      cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[1], { checks: ["webcam", "mic", "headphones"] });

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

      // Political affilliation survey
      cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

      cy.stepPreQuestion(playerKeys[0]);
      cy.stepPreQuestion(playerKeys[1]);

      // Countdown and Lobby
      cy.stepCountdown(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait

      // Player 2 complete, trigger dispatch
      cy.stepCountdown(playerKeys[1]);

      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Qualtrics
      cy.get("@consoleLog").should("be.calledWith", "Stage 0: Qualtrics Test");
      cy.stepQualtrics(playerKeys[0]);
      // because both players share a window, submits both players
      // not sure of a workaround, means we can't have multiple qualtrics surveys on one page.
      // also, may need to clear the message if we do sequential qualtrics surveys?
      // cy.stepQualtrics(playerKeys[1]);

      // Test that markdown tables are displayed properly
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Stage 1: Test Markdown Table"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Markdown Table");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "th",
        "Header Left Column"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "td",
        "Body Row 3 Right"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("button")
        .contains("Next")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("button")
        .contains("Next")
        .click();

      // Pre-questions
      cy.get("@consoleLog").should("be.calledWith", "Stage 2: Topic Survey");
      cy.stepPreQuestion(playerKeys[0]); // walks through specific stage of pre-question/sruvey stage, see sharedSteps.js
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other participant"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // // example survey
      cy.get("@consoleLog").should("be.calledWith", "Stage 3: Survey Library");
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

      // Discussion
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "strong magical field",
        { timeout: 7000 }
      );

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "the following wizards",
        { timeout: 10000 }
      );

      cy.get("@consoleLog").should("be.calledWith", "Playing Audio");

      // Test Etherpad
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 6: Etherpad Test"
      );
      cy.contains("This notepad is shared");

      // TODO: properly test etherpad when we have an etherpad server up on the same domain
      // cy.iframe(`#position_1_etherpadTest`)
      //   .contains("enter your response here")
      //   .clear()
      //   .type(`Position 1's entry ${playerKeys[0]}`);
      // cy.wait(1000);
      // cy.iframe(`#1_etherpadTest`).contains(
      //   `Position 1's entry ${playerKeys[0]}`
      // );

      cy.get(
        `[test-player-id="${playerKeys[0]}"] button[data-test="submitButton"]`
      ).click();
      cy.get(
        `[test-player-id="${playerKeys[1]}"] button[data-test="submitButton"]`
      ).click();

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

      // Check that all samples preregistered were included in the exported data
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/preregistrationData/batch_${batchTimeInitialized}_cytest_01.preregistration.jsonl`
        ).then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          console.log("lines", lines);
          const objs = lines.map((line) => JSON.parse(line));
          const ids = objs.map((obj) => obj.sampleId);
          cy.wrap(ids).should("have.length", 2);
          ids.forEach((id) => {
            const regex = new RegExp(`"sampleId":"${id}"`);
            cy.readFile(
              `../data/preregistrationData/batch_${batchTimeInitialized}_cytest_01.preregistration.jsonl`
            ).should("match", regex);
          });
        });

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

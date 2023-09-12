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
      cy.stepVideoCheck(playerKeys[0], { headphonesRequired: true });
      // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
      cy.stepVideoCheck(playerKeys[1], { headphonesRequired: true });

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
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 4: Training Video"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please take a moment"
      );
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWithMatch",
        /Playing video from/
      );

      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // Test display component by position
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 5: Test Displays by Position"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="display_openResponseExample1"]`
      ).contains(playerKeys[1]); // test display from position
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="display_openResponseExample1"]`
      ).contains(playerKeys[0]); // test display from current player
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="submitButton"]`
      ).click();
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="submitButton"]`
      ).click();

      // Test display component for current player
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 6: Test Displays of current player"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="display_openResponseExample1"]`
      ).contains(playerKeys[0]); // test display from position
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="display_openResponseExample1"]`
      ).contains(playerKeys[1]); // test display from current player
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="submitButton"]`
      ).click();
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="submitButton"]`
      ).click();

      // Test list sorter
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 7: Test List Sorter"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please drag the following list"
      ); // stage advance wait
      cy.get(`[test-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`, {
        timeout: 6000,
      }).contains("Harry Potter");
      cy.get(`[test-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`)
        .focus()
        .type(" ") // space bar says "going to move this item"
        .type("{downArrow}") // move down one
        .type(" ") // stop moving the item
        .blur();
      cy.wait(1000);
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="submitButton"]`
      ).click();
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="submitButton"]`
      ).click();

      // Discussion
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 8: Discussion"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "strong magical field",
        { timeout: 7000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "the following wizards",
        { timeout: 10000 }
      );

      cy.get("@consoleLog").should("be.calledWith", "Playing Audio");

      // Test that the stage auto-advances on stage timeout
      cy.wait(5000);

      // Complete player 1
      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Help us improve",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // wait for data to be saved (should be fast)
      cy.wait(3000);

      // get preregistration data
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/preregistrationData/batch_${batchTimeInitialized}_cytest_01.preregistration.jsonl`
        )
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            console.log("preregistrationObjects", objs);
            return objs;
          })
          .as("preregistrationObjects");
      });

      // get science data
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/scienceData/batch_${batchTimeInitialized}_cytest_01.jsonl`
        )
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            return objs;
          })
          .as("dataObjects");
      });

      // check that player 1's data is exported even though player 2 is not finished
      cy.get("@dataObjects").then((dataObjects) => {
        expect(dataObjects).to.have.length(1);
      });

      // force close player 2
      cy.empiricaClearBatches();
      cy.wait(3000);

      // load the data again
      cy.get("@batchTimeInitialized").then((batchTimeInitialized) => {
        cy.readFile(
          `../data/scienceData/batch_${batchTimeInitialized}_cytest_01.jsonl`
        )
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            console.log("dataObjects", objs);
            return objs;
          })
          .as("dataObjects");
      });

      // check that each preregistration id is in the science data
      cy.get("@dataObjects").then((dataObjects) => {
        cy.get("@preregistrationObjects").then((preregistrationObjects) => {
          const dataSampleIds = dataObjects.map((dataObj) => dataObj.sampleId);
          const preregSampleIds = preregistrationObjects.map(
            (preregObj) => preregObj.sampleId
          );
          expect(dataSampleIds).to.have.members(preregSampleIds);
        });
      });

      cy.get("@dataObjects").then((objs) => {
        // check that prompt data is included for both individual and group prompts
        const promptKeys = Object.keys(objs[0].prompts);
        expect(promptKeys).to.include.members([
          "prompt_listSorterPrompt",
          "prompt_openResponseExample1",
        ]);

        // check that prompt correctly saves open response data
        expect(objs[0].prompts.prompt_openResponseExample1.value).to.contain(
          "testplayer_A"
        );
        expect(objs[1].prompts.prompt_openResponseExample1.value).to.contain(
          "testplayer_B"
        );

        // check that prompt correctly saves list sorter data
        expect(
          objs[0].prompts.prompt_listSorterPrompt.value
        ).to.have.ordered.members([
          "Hermione Granger",
          "Harry Potter",
          "Ron Weasley",
          "Albus Dumbledore",
          "Severus Snape",
          "Rubeus Hagrid",
          "Ginny Weasley",
          "Luna Lovegood",
          "Draco Malfoy",
          "Neville Longbottom",
        ]);

        // check that this order is shared between players
        expect(
          objs[1].prompts.prompt_listSorterPrompt.value
        ).to.have.ordered.members([
          "Hermione Granger",
          "Harry Potter",
          "Ron Weasley",
          "Albus Dumbledore",
          "Severus Snape",
          "Rubeus Hagrid",
          "Ginny Weasley",
          "Luna Lovegood",
          "Draco Malfoy",
          "Neville Longbottom",
        ]);
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

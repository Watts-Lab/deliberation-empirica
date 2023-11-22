// You can only open one etherpad document on a page, because etherpad sets a cookie.
// So, we test the etherpad data pipeline in a separate test file with only one user.

describe(
  "Etherpad and Qualtrics Test",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

      const configJson = `{
          "batchName": "cytest_10_Etherpad",
          "treatmentFile": "projects/example/treatments.test.yaml",
          "dispatchWait": 1,
          "cdn": "test",
          "treatments": [
            "cypress_etherpad"
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

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      const playerKeys = [`testplayer_${Math.floor(Math.random() * 1e13)}`];

      cy.empiricaSetupWindow({ playerKeys });
      // cy.stepIntro(playerKeys[0], {}); // no audio or video check

      // test login name validation

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please enter your"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="joinButton"]`
      ).should("be.disabled");

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="inputPaymentId"]`
      ).type(`2short`, { delay: 2 });
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "at least 8 characters"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="joinButton"]`
      ).should("be.disabled");

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="inputPaymentId"]`
      ).type(`{selectall}{backspace}InvalidChars_#!*&`, { delay: 2 });
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "invalid characters"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="joinButton"]`
      ).should("be.disabled");

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="inputPaymentId"]`
      ).type(
        `{selectall}{backspace}abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`,
        { delay: 2 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "no more than 64 characters"
      );
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="joinButton"]`
      ).should("be.disabled");

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="inputPaymentId"]`
      ).type(`{selectall}{backspace}${playerKeys[0]}`, { delay: 2 });
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="joinButton"]`
      ).click();

      cy.stepConsent(playerKeys[0]);
      cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));
      cy.stepAttentionCheck(playerKeys[0]);
      cy.stepVideoCheck(playerKeys[0], { headphonesRequired: false });
      cy.stepNickname(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[0]);

      // ----------------- Test Etherpad -------------------
      cy.contains("This notepad is shared", { timeout: 15000 });

      cy.wait(3000); // ensure etherpad has loaded...

      // Test that custom default text is loaded
      cy.get(`#position_0_etherpadTest`)
        .its("0.contentDocument")
        .its("body")
        .find("iframe")
        .its("0.contentDocument")
        .its("body")
        .find("iframe")
        .its("0.contentDocument")
        .its("body")
        .should("contain", "enter your response here");

      // Add new content to the etherpad
      cy.get(`#position_0_etherpadTest`)
        .its("0.contentDocument")
        .its("body")
        .find("iframe")
        .its("0.contentDocument")
        .its("body")
        .find("iframe")
        .its("0.contentDocument")
        .its("body")
        .find("#magicdomid2")
        .type(`{selectall}{backspace}New content by: ${playerKeys[0]}`);

      // give time before proceeding to allow etherpad content to finish syncing
      cy.wait(2000);

      cy.submitPlayers(playerKeys);

      // ----------------- Test Qualtrics -------------------
      // listen for events bubbling up to the top window: cypress specs
      // then re-emits those events down to the application under test (AUT)
      cy.window().then((win) => {
        win.top.addEventListener("message", (e) => {
          console.log("message", e);
          win.postMessage(e.data, "*");
        });
      });

      cy.iframe(`#${playerKeys[0]} iframe`).contains("this is it!");

      cy.iframe(`#${playerKeys[0]} iframe`)
        .find("#NextButton")
        .click({ force: true });
      cy.wait(2000);

      // ----------------- Exit step -------------------

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // ----------------- Test Data Export -------------------
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/scienceData/batch_${batchLabel}.jsonl`)
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            return objs;
          })
          .as("dataObjects");
      });

      // check that the etherpad content is saved in the data export
      cy.get("@dataObjects").then((dataObjects) => {
        expect(dataObjects[0].prompts.prompt_etherpadTest.value).to.include(
          `New content by: ${playerKeys[0]}`
        );
      });

      // check that the qualtrics data is saved in the export.
      cy.get("@dataObjects").then((dataObjects) => {
        expect(
          dataObjects[0].qualtrics.qualtrics_stage_1.data.values.progress
        ).to.equal(100);
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

      cy.wait(2000);
      // Check that the server is still live and ready to accept more players,
      // and that it didn't close because all games finished.
      // Todo: might be good to check that all existing games are finished, but this
      // will require some modifications to the admin console to add test hooks.
      const newPlayerKeys = [
        `testplayer_2_${Math.floor(Math.random() * 1e13)}`,
      ];
      cy.empiricaSetupWindow({ playerKeys: newPlayerKeys });
      cy.get(`[test-player-id="${newPlayerKeys[0]}"]`).contains(
        "Please enter your"
      );

      // Now we intentionally close, and check that the server is no longer accepting players.
      cy.empiricaClearBatches();
      cy.empiricaSetupWindow({ playerKeys: newPlayerKeys });
      cy.get(`[test-player-id="${newPlayerKeys[0]}"]`)
        .contains("Please enter your")
        .should("not.exist");
    });
  }
);

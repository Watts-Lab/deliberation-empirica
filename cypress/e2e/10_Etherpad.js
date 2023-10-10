// You can only open one etherpad document on a page, because etherpad sets a cookie.
// So, we test the etherpad data pipeline in a separate test file with only one user.

describe("Etherpad Test", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();

    const configJson = `{
          "batchName": "cytest_10_Etherpad",
          "treatmentFile": "projects/example/treatments.test.yaml",
          "dispatchWait": 1,
          "cdn": "test",
          "treatments": [
            "cypress_etherpad"
          ],
          "videoStorageLocation": false,
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
    cy.stepIntro(playerKeys[0], {}); // no audio or video check
    cy.stepConsent(playerKeys[0]);

    cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));

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

    cy.submitPlayers(playerKeys);

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
  });
});

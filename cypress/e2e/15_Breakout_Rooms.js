/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
// Merlin fans vs (Gandalf or Eskarina Smith) fans
const configJson = `{
    "batchName": "cytest_15_breakout_rooms",
    "cdn": "test",
    "treatmentFile": "tests/15_Breakout_Rooms/15_Breakout_Rooms.treatments.yaml",
    "customIdInstructions": "none",
    "platformConsent": "US",
    "consentAddendum": "none",
    "checkAudio": true,
    "checkVideo": true,
    "introSequence": "none",
    "treatments": [
      "breakout_2x2_video_swap" 
    ],
    "payoffs": "equal",
    "knockdowns": "none",
    "dispatchWait": 1,
    "launchDate": "immediate",
    "centralPrereg": false,
    "preregRepos": [],
    "dataRepos": [],
    "videoStorage": "none",
    "exitCodes": "none"
}`;

describe(
  "Swap 2x2 Breakout Rooms",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("handles video breakout rooms", () => {
      const playerKeys = [
        `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_B_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_C_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_D_${Math.floor(Math.random() * 1e13)}`,
      ];
      cy.empiricaSetupWindow({ playerKeys });
      cy.interceptIpApis();

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
      });

      // All 4 players join the lobby
      playerKeys.forEach((playerKey) => {
        cy.stepIntro(playerKey, {}); // no audio or video check
        cy.stepConsent(playerKey);
        cy.stepAttentionCheck(playerKey);
        cy.stepVideoCheck(playerKey, {
          setupCamera: true,
          setupMicrophone: true,
        });
        cy.stepNickname(playerKey);
      });

      cy.window().then((win) => cy.wrap(win.batchLabel).as("batchLabel"));

      cy.submitPlayers(playerKeys);
      cy.wait(1000);
    });
  }
);

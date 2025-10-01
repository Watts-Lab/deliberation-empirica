/* eslint-disable no-restricted-syntax */
import dayjs from "dayjs";

describe(
  "CAPTCHA Check Feature",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();

      const configJson = `{
        "batchName": "cytest_captcha",
        "cdn": "test",
        "treatmentFile": "projects/example/cypress.treatments.yaml",
        "customIdInstructions": {"default":"projects/example/defaultIdInstructions.md"},
        "platformConsent": "US",
        "consentAddendum": "none",
        "checkAudio": false,
        "checkVideo": false,
        "checkCaptcha": true,
        "introSequence": "none",
        "treatments": [
          "cypress_omnibus"
        ],
        "payoffs": "equal",
        "knockdowns": "none",
        "dispatchWait": 1,
        "launchDate": "immediate",
        "centralPrereg": false,
        "preregRepos": [],
        "dataRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "cypress_test_exports"
          }
        ],
        "videoStorage": "none",
        "exitCodes": "none"
      }`;

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("completes CAPTCHA check successfully", () => {
      const playerKey = `testplayer_captcha_${Math.floor(Math.random() * 1e13)}`;
      
      cy.empiricaSetupWindow({ playerKeys: [playerKey] });
      cy.interceptIpApis();

      // Intro and Login
      cy.stepIntro(playerKey, { skipAudioVideo: true });
      
      // Consent
      cy.stepConsent(playerKey);
      
      // CAPTCHA Check
      cy.stepCaptchaCheck(playerKey);
      
      // Attention Check (should come after CAPTCHA)
      cy.stepAttentionCheck(playerKey);
      
      // Nickname
      cy.stepNickname(playerKey);
      
      // Wait for game
      cy.waitForGameLoad(playerKey);
    });
  }
);

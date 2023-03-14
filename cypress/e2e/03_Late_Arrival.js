// /*
// Tests that:
// - when launchDate is not specified, no "countdown" intro step is used
// - when lastEntryDate is specified, late arrivals see "no experiments available" screen

// */

// import dayjs from "dayjs";

// describe(
//   "LastEntry and closeDate function",
//   { retries: { runMode: 2, openMode: 0 } },
//   () => {
//     beforeEach(() => {
//       // using beforeEach even though there is just one test, so that if we retry the test it will run again
//       cy.empiricaClearBatches();
//       cy.clearDataFiles();

//       const configJson = `{
//         "batchName": "Cypress_03_Late_Arrival",
//         "treatmentFile": "projects/example/treatments.test.yaml",
//         "lastEntryDate": "${dayjs()
//           .add(20, "second")
//           .format("DD MMM YYYY HH:mm:ss Z")}",
//         "dispatchWait": 1,
//         "useIntroSequence": "cypress_standard",
//         "consentAddendum": "projects/example/consentAddendum.md",
//         "useTreatments": [
//           "cypress_omnibus"
//         ]
//       }`;

//       cy.empiricaCreateCustomBatch(configJson);
//       cy.wait(3000); // wait for batch creation callbacks to complete
//       cy.empiricaStartBatch(1);
//     });

//     it("walks properly", () => {
//       const playerKeys = [`test_A_${Math.floor(Math.random() * 1e13)}`];

//       cy.wait(30000);
//       cy.visit(`http://localhost:3000/?playerKey=${playerKeys[0]}`);

//       cy.contains("There are no studies available");
//       cy.wait(1000);
//       cy.contains("There are no studies available"); // not just the flash-through
//       cy.contains("payment ID").should("not.exist");
//       cy.contains("Join the study").should("not.exist");
//     });
//   }
// );

// With other players
/*
Tests that:
- when launchDate is not specified, no "countdown" intro step is used
- when lastEntryDate is specified, late arrivals see "no experiments available" screen


*/

// import dayjs from "dayjs";

// describe(
//   "LastEntry and closeDate function",
//   { retries: { runMode: 2, openMode: 0 } },
//   () => {
//     beforeEach(() => {
//       // using beforeEach even though there is just one test, so that if we retry the test it will run again
//       cy.empiricaClearBatches();
//       cy.clearDataFiles();

//       const configJson = `{
//         "batchName": "Cypress_03_Late_Arrival_and_Incomplete",
//         "treatmentFile": "projects/example/treatments.test.yaml",
//         "lastEntryDate": "${dayjs()
//           .add(30, "second")
//           .format("DD MMM YYYY HH:mm:ss Z")}",
//         "closeDate": "${dayjs()
//           .add(90, "second")
//           .format("DD MMM YYYY HH:mm:ss Z")}",
//         "dispatchWait": 1,
//         "useIntroSequence": "cypress_standard",
//         "consentAddendum": "projects/example/consentAddendum.md",
//         "useTreatments": [
//           "cypress_omnibus"
//         ]
//       }`;

//       cy.empiricaCreateCustomBatch(configJson);
//       cy.wait(3000); // wait for batch creation callbacks to complete
//       cy.empiricaStartBatch(1);
//     });

//     it("walks properly", () => {
//       const playerKeys = [
//         `test_A_${Math.floor(Math.random() * 1e13)}`,
//         `test_B_${Math.floor(Math.random() * 1e13)}`,
//         `test_C_${Math.floor(Math.random() * 1e13)}`,
//       ];

//       const hitId = "cypressTestHIT";
//       // Consent and Login
//       cy.empiricaLoginPlayers({ playerKeys: playerKeys.slice(0, 2), hitId });
//       cy.wait(2000); // wait for player join callbacks to complete

//       cy.window().then((win) => {
//         cy.spy(win.console, "log").as("consoleLog");
//       });

//       cy.window().then((win) => cy.wrap(win.batchId).as("batchId"));

//       // Consent
//       cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
//         "addendum to the standard consent"
//       ); // lobby wait
//       cy.stepConsent(playerKeys[0]);
//       cy.stepConsent(playerKeys[1]);

//       // Video check
//       cy.stepVideoCheck(playerKeys[0]);
//       // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("The study"); // lobby wait
//       cy.stepVideoCheck(playerKeys[1]);

//       cy.stepNickname(playerKeys[0]);
//       cy.stepNickname(playerKeys[1]);

//       // Political affilliation survey
//       cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
//       cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

//       // cy.stepPreQuestion(playerKeys[0]);
//       // cy.stepPreQuestion(playerKeys[1]);

//       cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting"); // lobby wait
//       cy.waitForGameLoad(playerKeys[0]);
//       cy.waitForGameLoad(playerKeys[1]);

//       // Qualtrics
//       cy.get("@consoleLog").should("be.calledWith", "Stage 0: Qualtrics Test");
//       cy.stepQualtrics(playerKeys[0]);
//       // because both players share a window, submits both players
//       // not sure of a workaround, means we can't have multiple qualtrics surveys on one page.
//       // also, may need to clear the message if we do sequential qualtrics surveys?
//       // cy.stepQualtrics(playerKeys[1]);

//       // Pre-questions
//       cy.get("@consoleLog").should("be.calledWith", "Stage 1: Topic Survey");
//       cy.stepPreQuestion(playerKeys[0]);
//       cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
//         "Please wait for other participant"
//       ); // stage advance wait
//       cy.stepPreQuestion(playerKeys[1]);

//       cy.wait(60000);

//       cy.visit(`http://localhost:3000/?playerKey=${playerKeys[2]}`);

//       cy.contains("There are no studies available");
//       cy.wait(1000);
//       cy.contains("There are no studies available"); // not just the flash-through
//       cy.contains("payment ID").should("not.exist");
//       cy.contains("Join the study").should("not.exist");

//       cy.get("@batchId").then((batchId) => {
//         const fileName = `..testData/scienceData/batch_Cypress_03_Late_Arrival_and_Incomplete_${batchId}.jsonl`;
//         cy.fileContains(fileName, ["incomplete"]);
//       });
//     });
//   }
// );

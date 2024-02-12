// const configJson = `{
//     "batchName": "cytest_13",
//     "treatmentFile": "projects/example/cypress.treatments.yaml",
//     "dispatchWait": 4,
//     "cdn": "test",
//     "exitCodeStem": "none",
//     "treatments": [
//       "cypress_constrained_1",
//       "cypress_constrained_2",
//       "cypress_constrained_3",
//     ],
//     "videoStorageLocation": "none",
//     "checkAudio": false,
//     "checkVideo": false,
//     "dataRepos": [
//       {
//         "owner": "Watts-Lab",
//         "repo": "deliberation-data-test",
//         "branch": "main",
//         "directory": "cypress_test_exports"
//       }
//     ]
//   }`;

// describe(
//   "Constrained Assignment",
//   { retries: { runMode: 2, openMode: 0 } },
//   () => {
//     beforeEach(() => {
//       cy.empiricaClearBatches();
//       cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file
//       cy.empiricaCreateCustomBatch(configJson, {});
//       cy.wait(3000); // wait for batch creation callbacks to complete
//       cy.empiricaStartBatch(1);
//     });

//     it("assigns players to the correct games", () => {

// });

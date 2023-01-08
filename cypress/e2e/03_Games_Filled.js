// Game_Filled.js

// const configJson = `{
//   "treatmentFile": "treatments.test.yaml",
//   "dispatchWait": 3,
//   "useTreatments": [
//     "cypress1_simple"
//   ]
// }`;

// describe(
//   "All games fill up with extra player in intro steps",
//   { retries: { runMode: 2, openMode: 0 } },
//   () => {
//     beforeEach(() => {
//       cy.empiricaClearBatches();
//       cy.empiricaCreateCustomBatch(configJson);
//       cy.wait(3000); // wait for batch creation callbacks to complete
//       cy.empiricaStartBatch(1);
//     });

//     it("redirects to sorry on game full", () => {
//       const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
//       const playerKeys = [`${playerKey}_no_complete`, `${playerKey}_complete`];
//       cy.empiricaLoginPlayers({ playerKeys });

//       // Completing player
//       cy.stepInstructions(playerKeys[1]);
//       cy.stepVideoCheck(playerKeys[1]);
//       cy.get(`[test-player-id="${playerKeys[1]}"] [data-test="profile"]`, {
//         timeout: 20000,
//       }); // check that made it to the game

//       // Non-completing player
//       // Should boot to QC survey with sorry message
//       cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("We are sorry", {
//         timeout: 20000,
//       });
//     });
//   }
// );

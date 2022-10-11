// Game_Filled.js
import dayjs from "dayjs";

describe(
  "All games fill up with extra player in intro steps",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    let start;
    let end;
    let difference;
    let payment;

    const incompletePlayerTime = 10000;

    beforeEach(() => {
      cy.empiricaClearBatches();
      cy.empiricaCreateBatch("cypress1_control");
      cy.empiricaStartBatch("cypress1_control");
    });

    it("redirects to sorry on game full", () => {
      const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
      const playerKeys = [`${playerKey}_no_complete`, `${playerKey}_complete`];
      cy.empiricaLoginPlayers({ playerKeys }).then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

      cy.wait(incompletePlayerTime); // give the player some time to accumulate pay - this is essentially all the time they get

      // Completing player
      cy.stepInstructions(playerKeys[1]);
      cy.stepNickname(playerKeys[1]);
      cy.stepVideoCheck(playerKeys[1]);
      cy.get(`[test-player-id="${playerKeys[1]}"] [data-test="profile"]`, {
        timeout: 20000,
      }); // check that made it to the game

      // Back to non-completing player
      // Should boot to QC survey with sorry message
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("Sorry you did not get to play", { timeout: 10000 })
        .then(() => {
          // check that payment is correct
          end = dayjs();
          difference = end.diff(start);
          payment = (difference / 3600000) * 15;
          cy.log(`time elapsed: ${difference}, expected payment: $${payment}`);
          cy.contains("calculating", { timeout: 40000 }).should("not.exist");
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(($value) => cy.log(`Observed payment ${$value}`));
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(parseFloat)
            .should("be.closeTo", payment, 0.02);

          // see if the callback gets run again on refresh (it shouldn't)
          cy.reload(true);
          cy.wait(10000);
          cy.reload(true);
          cy.contains("calculating", { timeout: 40000 }).should("not.exist");
          cy.get('[data-test="dollarsOwed"]') // payment should still be what it was before.
            .invoke("text")
            .then(parseFloat)
            .should("be.closeTo", payment, 0.02);
        });
    });
  }
);

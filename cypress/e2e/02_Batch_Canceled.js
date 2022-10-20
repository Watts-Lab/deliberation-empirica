// Batch_Canceled.js
import dayjs from "dayjs";

describe("Batch canceled", { retries: { runMode: 2, openMode: 0 } }, () => {
  const condition = "cypress1_simple";
  let start;
  let end;
  let difference;
  let payment;

  beforeEach(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch(condition);
    cy.empiricaStartBatch(1);
  });

  it("from intro steps", () => {
    const playerKeys = [`test_intro_${Math.floor(Math.random() * 1e13)}`];
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys }).then(() => {
      start = dayjs();
      cy.log(`start: ${start}`);
    });
    cy.wait(10000); // build up time for payment
    // Cancel Batch
    cy.empiricaClearBatches(); // has a 5 second delay in it, need to subtract from participants payment

    // Check that player canceled
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.contains("About this study").should("not.exist");

    // Should boot to QC survey with sorry message
    cy.get(`[test-player-id="${playerKeys[0]}"]`)
      .contains("Sorry you did not get to play", { timeout: 10000 })
      .then(() => {
        // check that payment is correct
        end = dayjs();
        difference = end.diff(start) - 5000; // clear batches has a 5 second delay in it, need to subtract from participants payment
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
      });
  });

  it("from game", () => {
    // Consent and Login
    const playerKeys = [`test_game_${Math.floor(Math.random() * 1e13)}`];

    // Enter Game
    cy.empiricaLoginPlayers({ playerKeys }).then(() => {
      start = dayjs();
      cy.log(`start: ${start}`);
    });
    cy.wait(10000); // build up time for payment
    cy.stepInstructions(playerKeys[0]);
    cy.stepNickname(playerKeys[0]);
    cy.stepVideoCheck(playerKeys[0]);

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Cancel Batch
    cy.empiricaClearBatches(); // clear batches has a 5 second delay in it, need to subtract from participants payment

    // Should boot to exit steps
    cy.visit(`/?playerKey=${playerKeys[0]}`);
    cy.stepTeamViabilitySurvey(playerKeys[0]);
    cy.get(`[test-player-id="${playerKeys[0]}"]`)
      .contains("Thank you for participating", { timeout: 10000 })
      .then(() => {
        // check that payment is correct
        end = dayjs();
        difference = end.diff(start) - 5000; // clear batches has a 5 second delay in it, need to subtract from participants payment
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
      });
  });
});

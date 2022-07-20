// Game_Filled.js

import dayjs from "dayjs";

describe("All games fill up with extra player in intro steps", () => {
  let start;
  let end;
  let difference;
  let payment;

  const playerKey = "test_" + Math.floor(Math.random() * 1e13);
  const incomplete_player_time = 5000;

  before(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch("cypress1_control");

    //Start batch
    cy.get("tr", { log: false })
      .last({ log: false })
      .contains("Start", { log: false })
      .click({ log: "Start Button" });

    //Check started
    cy.waitUntil(
      () =>
        cy
          .get("tr", { log: false })
          .last({ log: false })
          .then(($tr) => $tr.find('button:contains("Stop")').length == 1),
      { log: false }
    );
  });

  it("redirects to sorry on game full", () => {
    //Non-completing player
    cy.empiricaLoginPlayer(playerKey + "_no_complete");
    cy.wait(incomplete_player_time); // give the player some time to accumulate pay - this is essentially all the time they get

    //Completing player
    cy.empiricaLoginPlayer(playerKey + "_complete");

    //Instructions and Understanding Check
    cy.log("Intro: instructions and understanding check");
    cy.contains("In this study", { timeout: 5000 });
    cy.contains("Please verify that you understand", { timeout: 5000 });
    cy.get("label").contains("Discuss a topic with others").click();
    cy.get("label").contains("Yes").click();
    cy.get("label").contains("In academic publications, anonymously").click();
    cy.get("label").contains("Researchers under confidentiality agreement").click();
    cy.get("label").contains("15-35 minutes").click();
    cy.get("button").contains("Next").click();

    // Name Input
    cy.contains("please enter your first name", { timeout: 5000 });
    cy.get("input")
      .click()
      .type(playerKey + "_name");
    cy.get("button").contains("Next").click();

    // Video check
    cy.contains("Check your webcam", { timeout: 5000 });
    cy.get('input[id="enabled"]').click();
    cy.get('input[id="see"]').click();
    cy.get('input[id="noName"]').click();
    cy.get('input[id="background"]').click();
    cy.get('input[id="safeplace"]').click();
    cy.get('input[id="speakFree"]').click();
    cy.get('input[id="noInterrupt"]').click();
    cy.get("button").contains("Next").click();


    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Back to non-completing player
    cy.visit(`/?playerKey=${playerKey + "_no_complete"}`);
    cy.contains("Experiment Unavailable", { timeout: 3000 }).then(() => {
      // check for correct payment
      payment = (incomplete_player_time / 3600000) * 15;
      const minPayment = payment - 0.01; // include a bit of margin for small timing differences between server and test runner
      const maxPayment = payment + 0.01;
      cy.contains(
        "We are sorry, your experiment has unexpectedly stopped. We hope you can join us in a future experiment!"
      );
      // wait for callback to complete and update value
      cy.waitUntil(() =>
        cy
          .get(`[data-test="dollarsOwed"]`)
          .invoke("text")
          .then(parseFloat)
          .then(($value) => minPayment < $value && $value < maxPayment)
      );
    });
  });
});

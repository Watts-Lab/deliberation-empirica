// Game_Filled.js

import dayjs from 'dayjs'

describe("All games fill up with extra player in intro steps", () => {
  let start; 
  let end; 
  let difference; 
  let payment;

  const condition = "cypress1";
  const playerKey = "test_" + Math.floor(Math.random() * 1e13);
  const incomplete_player_time = 5000

  before(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch("cypress1");

    //Start batch
    cy.get("tr", { log: false })
      .last({ log: false })
      .contains("Start", { log: false })
      .click({ log: "Start Button" });

    //Check started
    cy.waitUntil(
      () => cy.get("tr", { log: false })
              .last({ log: false })
              .then(($tr) => $tr.find('button:contains("Stop")').length == 1),
      { log: false }
    );
  });

  it("redirects to sorry on game full", () => {
    //Non-completing player
    cy.empiricaLoginPlayer(playerKey + "_no_complete")
    cy.wait(incomplete_player_time); // give the player some time to accumulate pay - this is essentially all the time they get

    //Completing player
    cy.empiricaLoginPlayer(playerKey + "_complete")

    //Instructions
    cy.contains("About this study:", { timeout: 5000 });
    // cy.get('button').contains("Next").click({force: true});
    // Understanding check
    cy.contains("Answer the following questions", { timeout: 5000 });
    cy.get("label").contains("Partcipate in and answer questions").click();
    cy.get("label").contains("True").click();
    cy.get("label").contains("anonmously published").click();
    cy.get("label").contains("Our research team").click();
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

    // Preread of topic
    cy.log("Initial Question");
    cy.contains("This is the topic", { timeout: 5000 });
    // This is flaky!  https://www.cypress.io/blog/2020/07/22/do-not-get-too-detached/
    cy.contains("Neither favor nor oppose").click({ force: true });
    cy.contains("Unsure").click({ force: true }); // flake backup

    cy.get("form") // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      })
  
    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Back to non-completing player
    cy.visit(`/?playerKey=${playerKey + "_no_complete"}`);
    cy.contains("Experiment Unavailable", {timeout: 3000})
      .then(() => {
        payment = (((incomplete_player_time / 3600000) * 15).toFixed(2))
        cy.contains("We are sorry, your experiment has unexpectedly stopped. We hope you can join us in a future experiment!")
        cy.contains("You will be paid $" + payment + " for your time today")
      }) 
    
  });
});

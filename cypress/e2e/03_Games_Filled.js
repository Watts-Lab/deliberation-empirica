// Game_Filled.js

import dayjs from "dayjs";

describe("All games fill up with extra player in intro steps", () => {
  let start;
  let end;
  let difference;
  let payment;


  const incomplete_player_time = 10000;

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
    const playerKey = "test_" + Math.floor(Math.random() * 1e13);
    cy.empiricaLoginMultiPlayers([playerKey + "_no_complete", playerKey + "_complete"])
    cy.wait(incomplete_player_time); // give the player some time to accumulate pay - this is essentially all the time they get
    

    //Completing player
    //Instructions and Understanding Check P2
    cy.log("Intro: instructions and understanding check");
    cy.get("[test-player-id='player2']").contains("In this study", { timeout: 5000 });
    cy.contains("Please verify that you understand", { timeout: 5000 });
    cy.get("[test-player-id='player2']").find("label").contains("Discuss a topic with others").click();
    cy.get("[test-player-id='player2']").find("label").contains("Yes").click();
    cy.get("[test-player-id='player2']").find("label").contains("In academic publications, anonymously").click();
    cy.get("[test-player-id='player2']").find("label").contains("Researchers under confidentiality agreement").click();
    cy.get("[test-player-id='player2']").find("label").contains("15-35 minutes").click();
    cy.get("[test-player-id='player2']").find("button[id='check-understanding-next']").click();
    
    // Name Input2
    cy.get("[test-player-id='player2']").contains("please enter your first name", { timeout: 5000 });
    cy.get("[test-player-id='player2']").find("input[id='inputNickname']")
      .click()
      .type(playerKey + "_complete" + "_name");
    cy.get("[test-player-id='player2']").find("button[id='enter-nickname']").contains("Next").click();

    // Video check2
    cy.get("[test-player-id='player2']").contains("Check your webcam", { timeout: 5000 });
    cy.get("[test-player-id='player2']").find('input[id="enabled"]').click();
    cy.get("[test-player-id='player2']").find('input[id="see"]').click();
    cy.get("[test-player-id='player2']").find('input[id="noName"]').click();
    cy.get("[test-player-id='player2']").find('input[id="background"]').click();
    cy.get("[test-player-id='player2']").find('input[id="safeplace"]').click();
    cy.get("[test-player-id='player2']").find('input[id="speakFree"]').click();
    cy.get("[test-player-id='player2']").find('input[id="noInterrupt"]').click();
    cy.get("[test-player-id='player2']").find("button").contains("Next").click();

    // in game body
    cy.get("[test-player-id='player2']").find('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded

    // Back to non-completing player
    cy.get("[test-player-id='player1']").contains("Experiment Unavailable", { timeout: 3000 }).then(() => {
      cy.contains("calculating", { timeout: 1000 })
      // check for correct payment
      payment = (incomplete_player_time / 3600000) * 15;
      cy.contains(
        "We are sorry, your experiment has unexpectedly stopped. We hope you can join us in a future experiment!"
      );
      // wait for callback to complete and update value
      cy.contains("calculating", { timeout: 40000 }).should('not.exist');
      cy.get(`[data-test="dollarsOwed"]`).invoke('text').then($value => cy.log(`Observed payment ${$value}`))
      cy.get(`[data-test="dollarsOwed"]`).invoke('text').then(parseFloat).should('be.closeTo', payment, .02)
    });
  });
});

// Game_Filled.js
import dayjs from "dayjs";

describe("All games fill up with extra player in intro steps", () => {
  let start;
  let end;
  let difference;
  let payment;

  const incompletePlayerTime = 10000;

  before(() => {
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
    // Instructions and Understanding Check P2
    cy.log("Intro: instructions and understanding check");
    cy.get(`[test-player-id="${playerKeys[1]}"]`).contains("In this study", {
      timeout: 5000,
    });
    cy.contains("Please verify that you understand", { timeout: 5000 });
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("label")
      .contains("Discuss a topic with others")
      .click();
    // deliberate error to check alert: don't answer the webcam question
    // cy.get(`[test-player-id="${playerKeys[1]}"]`).find("label").contains("Yes").click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("label")
      .contains("In academic publications, anonymously")
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("label")
      .contains("Researchers under confidentiality agreement")
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("label")
      .contains("15-35 minutes")
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('button[id="check-understanding-next"]')
      .click(); // contains incorrect answer

    // check for alert
    cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
      "Some of your responses were incorrect!",
      { timeout: 5000 }
    );
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("label")
      .contains("Yes")
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("button")
      .contains("Next")
      .click();

    // Name Input2
    cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
      "please enter your first name",
      { timeout: 5000 }
    );
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="inputNickname"]')
      .click()
      .type(`${playerKey}_complete_name`);
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('button[id="enter-nickname"]')
      .contains("Next")
      .click();

    // Video check2
    cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
      "Check your webcam",
      { timeout: 5000 }
    );
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="enabled"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="see"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="noName"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="background"]')
      .click();

    // check for alert
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .get("button")
      .contains("Next")
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
      "Not all of the necessary items were confirmed!",
      { timeout: 5000 }
    );

    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="safeplace"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="speakFree"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find('input[id="noInterrupt"]')
      .click();
    cy.get(`[test-player-id="${playerKeys[1]}"]`)
      .find("button")
      .contains("Next")
      .click();

    // in game body
    cy.get(`[test-player-id="${playerKeys[1]}"]`).find(
      '[data-test="profile"]',
      { timeout: 20000 }
    ); // check that profile loaded

    // Back to non-completing player
    cy.get(`[test-player-id="${playerKeys[0]}"]`)
      .contains("Sorry", { timeout: 3000 })
      .then(() => {
        cy.contains("calculating", { timeout: 1000 });
        // compute correct payment
        end = dayjs();
        difference = end.diff(start);
        payment = (difference / 3600000) * 15;


        // wait for callback to complete and update value
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
        cy.wait(3000);
        cy.reload(true);
        cy.contains("Experiment Unavailable", { timeout: 5000 });
        cy.contains("calculating", { timeout: 40000 }).should("not.exist");
        cy.get('[data-test="dollarsOwed"]') // payment should still be what it was before.
          .invoke("text")
          .then(parseFloat)
          .should("be.closeTo", payment, 0.02);
      });
  });
});

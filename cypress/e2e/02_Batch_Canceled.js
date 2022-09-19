// Batch_Canceled.js

describe('Batch canceled', () => {
  const condition = 'cypress1_control';

  beforeEach(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch(condition);
    cy.empiricaStartBatch(condition);
  });

  it('from intro steps', () => {
    const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
    const playerKeys = [playerKey];
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys });
    cy.wait(1000);
    // Cancel Batch
    cy.empiricaClearBatches();
    cy.wait(1000);

    // Check that player canceled
    cy.visit(`/?playerKey=${playerKey}`);
    cy.contains('About this study').should('not.exist');
    cy.contains('No experiments available');
  });

  it('from game', () => {
    // Consent and Login
    const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
    const playerKeys = [playerKey];
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys });

    // Instructions and Understanding Check
    cy.log('Intro: instructions and understanding check');
    cy.contains('In this study', { timeout: 5000 });
    cy.contains('Please verify that you understand', { timeout: 5000 });
    cy.get('label').contains('Discuss a topic with others').click();
    cy.get('label').contains('No').click();
    cy.get('label').contains('In academic publications, anonymously').click();
    cy.get('label')
      .contains('Researchers under confidentiality agreement')
      .click();
    cy.get('label').contains('15-35 minutes').click();
    cy.get('button').contains('Next').click(); // contains incorrect answer

    // check for alert
    cy.contains('Some of your responses were incorrect!', { timeout: 5000 });
    cy.get('label').contains('Yes').click();
    cy.get('button').contains('Next').click();

    // Name Input
    cy.contains('please enter your first name', { timeout: 5000 });
    cy.get('input')
      .click()
      .type(`${playerKey}_name`);
    cy.get('button').contains('Next').click();

    // Video Check
    cy.contains('Check your webcam', { timeout: 5000 });
    cy.get('input[id="enabled"]').click();
    cy.get('input[id="see"]').click();
    cy.get('input[id="noName"]').click();
    cy.get('input[id="background"]').click();

    // check for alert
    cy.get('button').contains('Next').click();
    cy.contains('Not all of the necessary items were confirmed!', { timeout: 5000 });

    cy.get('input[id="safeplace"]').click();
    cy.get('input[id="speakFree"]').click();
    cy.get('input[id="noInterrupt"]').click();
    cy.get('button').contains('Next').click();

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Cancel Batch
    cy.empiricaClearBatches();
    cy.visit(`/?playerKey=${playerKey}`);
    cy.get('[data-test="profile"]', { timeout: 3000 }).should('not.exist');
    cy.contains('Please select the option', { timeout: 10000 }); // in exit survey
  });

  // it("from exit steps", () => {
  //   //Consent and Login
  //   const playerKey = "test_" + Math.floor(Math.random() * 1e13);
  //   cy.empiricaLoginPlayer({playerKey});

  //   //Instructions and Understanding Check
  //   cy.log("Intro: instructions and understanding check");
  //   cy.contains("In this study", { timeout: 5000 });
  //   cy.contains("Please verify that you understand", { timeout: 5000 });
  //   cy.get("label").contains("Discuss a topic with others").click();
  //   cy.get("label").contains("Yes").click();
  //   cy.get("label").contains("In academic publications, anonymously").click();
  //   cy.get("label").contains("Researchers under confidentiality agreement").click();
  //   cy.get("label").contains("15-35 minutes").click();
  //   cy.get("button").contains("Next").click();

  //   // Name Input
  //   cy.contains("please enter your first name", { timeout: 5000 });
  //   cy.get("input")
  //     .click()
  //     .type(playerKey + "_name");
  //   cy.get("button").contains("Next").click();

  //   // Video Check
  //   cy.contains("Check your webcam", { timeout: 5000 });
  //   cy.get('input[id="enabled"]').click();
  //   cy.get('input[id="see"]').click();
  //   cy.get('input[id="noName"]').click();
  //   cy.get('input[id="background"]').click();
  //   cy.get('input[id="safeplace"]').click();
  //   cy.get('input[id="speakFree"]').click();
  //   cy.get('input[id="noInterrupt"]').click();
  //   cy.get("button").contains("Next").click();

  //   // in game body
  //   cy.get('[data-test="profile"]', { timeout: 20000 });
  //   cy.contains("personal opinion");
  //   cy.contains("Neither agree nor disagree").click();
  //   cy.get('input[type="submit"]').click();

  //   // in exit steps
  //   cy.contains("Please select the option", { timeout: 20000 }); // long timeout to wait out the game timer

  //   // Cancel Batch
  //   cy.empiricaClearBatches();

  //   cy.visit(`/?playerKey=${playerKey}`);
  //   cy.get('[data-test="profile"]', { timeout: 20000 }).should("not.exist");
  //   cy.contains("Please select the option", { timeout: 10000 }); // still at same place in exit survey

  // });
});

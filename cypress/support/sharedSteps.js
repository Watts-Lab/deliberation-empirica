const loremIpsum = "lorem ipsum dolor sit amet";

Cypress.Commands.add("stepInstructions", (playerKey) => {
  cy.log(
    `⌛️ Intro: instructions and understanding check, player ${playerKey}`
  );

  cy.get(`[test-player-id="${playerKey}"]`).contains("In this study", {
    timeout: 5000,
  });
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Please verify that you understand",
    { timeout: 5000 }
  );

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="doGroup"] input[value="correct"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="webcamGroup"] input[value="no"]`
  ).click(); // incorrect answer
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="surveyGroup"] input[value="correct"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="recordingGroup"] input[value="correct"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="timeGroup"] input[value="correct"]`
  ).click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("button")
    .contains("Next")
    .click();

  // check for alert
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Some of your responses were incorrect!",
    { timeout: 5000 }
  );
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="webcamGroup"] input[value="correct"]`
  ).click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("button")
    .contains("Next")
    .click();
});

Cypress.Commands.add("stepNickname", (playerKey) => {
  cy.log(`⌛️ Intro: Enter Nickname, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "please enter your first name",
    { timeout: 5000 }
  );
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("input")
    .eq(0)
    .click()
    .type(`${playerKey}_name`);
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("button")
    .contains("Next")
    .click();
});

Cypress.Commands.add("stepVideoCheck", (playerKey) => {
  cy.log(`⌛️ Intro: Video Check player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains("Check your webcam", {
    timeout: 5000,
  });
  // cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

  cy.get(`[test-player-id="${playerKey}"]`).find('input[id="enabled"]').click();
  cy.get(`[test-player-id="${playerKey}"]`).find('input[id="see"]').click();
  cy.get(`[test-player-id="${playerKey}"]`).find('input[id="noName"]').click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find('input[id="background"]')
    .click();

  // check for alert
  cy.get(`[test-player-id="${playerKey}"]`)
    .get("button")
    .contains("Next")
    .click();
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Not all of the necessary items were confirmed!",
    { timeout: 5000 }
  );

  cy.get(`[test-player-id="${playerKey}"]`)
    .find('input[id="safeplace"]')
    .click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find('input[id="speakFree"]')
    .click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find('input[id="noInterrupt"]')
    .click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("button")
    .contains("Next")
    .click();
});

Cypress.Commands.add("stepPreQuestion", (playerKey) => {
  cy.log(`⌛️ Stage: Read Topic player ${playerKey}`);
  cy.wait(500);
  cy.get(`[test-player-id="${playerKey}"]`).find('[data-test="profile"]', {
    timeout: 20000,
  }); // check that profile loaded

  cy.get(`[test-player-id="${playerKey}"]`).contains("personal opinion", {
    timeout: 3000,
  });
  cy.get(`[test-player-id="${playerKey}"]`)
    .contains("Neither agree nor disagree")
    .click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find('input[type="submit"]')
    .eq(0)
    .click();
});

Cypress.Commands.add("stepWatchTraining", (playerKey) => {
  cy.log(`⌛️ Stage: Watch Training Video, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`).contains("watch the following", {
    timeout: 10000,
  });
  // TODO: check that the video loaded (stub the handlers?)
  // skip the rest of the video
  cy.get(`[test-player-id="${playerKey}"] input[data-test="skip"]`).click({
    force: true,
  });
});

Cypress.Commands.add("stepIcebreaker", (playerKey) => {
  cy.log(`⌛️ Stage: Icebreaker, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`, {
    timeout: 15000,
  }).contains("you have in common", { timeout: 2000 });
});

Cypress.Commands.add("stepTeamViabilitySurvey", (playerKey) => {
  cy.log(`⌛️ Exit: Team Viability, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Please select the option",
    { timeout: 20000 }
  ); // long timeout to wait out the game timer
  cy.wait(700); // flake mitigation
  cy.get(
    `[test-player-id="${playerKey}"] [data-responsive-title="Disagree"] input`
  ).click({
    multiple: true,
    force: true,
    timeout: 10000,
  });

  cy.get(`[test-player-id="${playerKey}"]`)
    .find("form") // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]'))
        .eq(0)
        .click();
    });
});

Cypress.Commands.add("stepExampleSurvey", (playerKey) => {
  cy.log(`⌛️ Exit: Example Survey, player ${playerKey}`);
  cy.get(
    `[test-player-id="${playerKey}"] [data-name="nps_score"] input[value="2"]`
  )
    .next()
    .click({ force: true });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="nps_score"] input[value="1"]`
  )
    .next()
    .click({ force: true });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="disappointed_experience"] textarea`,
    { timeout: 8000 }
  )
    .click({ force: true })
    .type(loremIpsum);

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

Cypress.Commands.add("stepQCSurvey", (playerKey) => {
  cy.log(`⌛️ Exit: Quality Control, player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Quality Feedback Survey",
    { timeout: 5000 }
  );
  
  cy.get(
    `[test-player-id="${playerKey}"] [data-responsive-title="Disagree"] input`
  ).click({
    multiple: true,
    timeout: 6000,
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="adequateCompensation"] input[value="underpaid"]`
  ).click({ force: true });

  cy.get(
    ` [test-player-id="${playerKey}"] [data-name="adequateTime"] input[value="adequate"]`
  ).click({ force: true });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="videoQuality"] input[value="2"]`
  ).click({ force: true });

  cy.get(`[test-player-id="${playerKey}"] [data-name="textExpansion"] input`)
    .click()
    .type(`Check_${playerKey}_text_entry`);

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

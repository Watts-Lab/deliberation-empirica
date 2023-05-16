const loremIpsum = "lorem ipsum dolor sit amet";

Cypress.Commands.add(
  "empiricaLoginPlayers",
  ({ playerKeys, hitId, workerId }) => {
    // Logs in if not already logged in.
    // playerKeys is ideally an array. Can handle single values.
    // TODO: someday, do this step programmatically

    const log = Cypress.log({
      name: "empiricaLoginMultiPlayers",
      displayName: "🐘 Login Players",
      message: playerKeys,
      autoEnd: false,
    });

    if (!Array.isArray(playerKeys)) {
      // eslint-disable-next-line no-param-reassign
      playerKeys = Array(playerKeys);
    }

    cy.viewport(2000, 1000, { log: false });

    const urlParams = [];
    playerKeys.forEach((playerKey) => urlParams.push(`playerKey=${playerKey}`));
    let url = `/?${urlParams.join("&")}`;

    if (hitId) {
      url += `&hitId=${hitId}`;
    }
    if (workerId) {
      url += `&workerId=${hitId}`;
    }
    cy.visit(url, { log: false });
    cy.wait(300, { log: false });
    log.snapshot("before");

    // Intro splash
    playerKeys.forEach((playerKey) => {
      cy.get(`[test-player-id="${playerKey}"]`).contains(
        "Join a group discussion"
      );

      // Assume input payment is always present in cypress test
      cy.get(
        `[test-player-id="${playerKey}"] [data-test="inputPaymentId"]`
      ).type(`noWorkerIdGiven_${playerKey}`);

      cy.get(
        `[test-player-id="${playerKey}"] [data-test="joinButton"]`
      ).click();
    });

    log.snapshot("after");
    log.end();
  }
);

Cypress.Commands.add("stepConsent", (playerKey) => {
  cy.get(`[test-player-id="${playerKey}"]`).contains("Informed Consent", {
    timeout: 8000,
  });
  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="consentButton"]`
  ).click();
});

Cypress.Commands.add("submitStage", (playerKey) => {
  cy.get(`[test-player-id="${playerKey}"] [data-test="hiddenMenu"]`)
    .should("be.hidden")
    .invoke("show");
  cy.get(`[test-player-id="${playerKey}"] [data-test="devSubmitStage"]`).click({
    force: true,
  });
  cy.get(`[test-player-id="${playerKey}"] [data-test="hiddenMenu"]`)
    .should("not.be.hidden")
    .invoke("hide");
});

Cypress.Commands.add("skipIntro", (playerKey) => {
  cy.get(`[test-player-id="${playerKey}"] [data-test="hiddenMenu"]`)
    .should("be.hidden")
    .invoke("show");
  cy.get(`[test-player-id="${playerKey}"] [data-test="devSubmitStage"]`).click({
    force: true,
  });
  cy.get(`[test-player-id="${playerKey}"] [data-test="hiddenMenu"]`)
    .should("not.be.hidden")
    .invoke("hide");
});

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
    `[test-player-id="${playerKey}"] [data-test="doGroup"] input[value="discuss"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="webcamGroup"] input[value="no"]`
  ).click(); // incorrect answer
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="responseGroup"] input[value="publish"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="recordingGroup"] input[value="researchers"]`
  ).click();
  cy.get(
    `[test-player-id="${playerKey}"] [data-test="timeGroup"] input[value="thirtyfive"]`
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
    `[test-player-id="${playerKey}"] [data-test="webcamGroup"] input[value="yes"]`
  ).click();
  cy.get(`[test-player-id="${playerKey}"]`)
    .find("button")
    .contains("Next")
    .click();
});

Cypress.Commands.add("stepVideoCheck", (playerKey) => {
  cy.log(`⌛️ Intro: Video Check player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "check your sound output",
    {
      timeout: 5000,
    }
  );

  cy.get(`[test-player-id="${playerKey}"] input[value="clock"]`).click();

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueSpeakers"]`
  ).click();
});

Cypress.Commands.add("stepNickname", (playerKey) => {
  cy.log(`⌛️ Intro: Enter Nickname ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains("enter your first name", {
    timeout: 5000,
  });

  cy.get(
    `[test-player-id="${playerKey}"] input[data-test="inputNickname"]`
  ).type(`nickname_${playerKey}`, { force: true });

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueNickname"]`
  ).click();
});

Cypress.Commands.add("stepCountdown", (playerKey) => {
  cy.log(`⌛️ Wait: countdown`);
  cy.get(`[test-player-id="${playerKey}"] button[data-test="proceedButton"]`, {
    timeout: 20000,
  }).click({ force: true, log: false }); // check that profile loaded
});

Cypress.Commands.add("waitForGameLoad", (playerKey) => {
  cy.log(`⌛️ Wait: lobby`);
  cy.get(`[test-player-id="${playerKey}"]`).find('[data-test="profile"]', {
    timeout: 20000,
  }); // check that profile loaded
});

Cypress.Commands.add("stepSurveyPoliticalPartyUS", (playerKey) => {
  cy.log(`⌛️ Survey: PoliticalPartyUS ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Generally speaking, do you usually think",
    {
      timeout: 3000,
    }
  );

  cy.get(`[test-player-id="${playerKey}"] input[value="Republican"]`).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] input[value="Strong Republican"]`
  ).click({
    force: true,
  });

  cy.get(`[test-player-id="${playerKey}"] input[value="Next"]`).click({
    force: true,
  });

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

Cypress.Commands.add("stepQualtrics", (playerKey) => {
  cy.log(`⌛️ Stage: Qualtrics player ${playerKey}`);

  // listen for events bubbling up to the top window: cypress specs
  // then re-emits those events down to the application under test (AUT)
  cy.window().then((win) => {
    win.top.addEventListener("message", (e) => {
      console.log("message", e);
      win.postMessage(e.data, "*");
    });
  });

  cy.iframe(`#${playerKey} iframe`).contains("this is it!");

  cy.iframe(`#${playerKey} iframe`).find("#NextButton").click({ force: true });
  cy.wait(2000);
});


Cypress.Commands.add("stepPreQuestion", (playerKey) => {
  cy.log(`⌛️ Stage: Read Topic player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains("Markdown", {
    timeout: 3000,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoice.md"] input[value="1"]`
  ).click();

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="6"]`
  ).click();

  cy.get(
    `[test-player-id="${playerKey}"] textarea[data-test="projects/example/openResponse.md"]`
  ).type(loremIpsum, { force: true });

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoice.md"] input[value="1"]`
  ).should("be.checked");

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="6"]`
  ).should("be.checked");

  cy.get(
    `[test-player-id="${playerKey}"] [data-test="projects/example/multipleChoiceColors.md"]`
  ).should("not.exist");

  cy.get(`[test-player-id="${playerKey}"] [data-test="unnamedSeparator"]`)
    .get("hr")
    .should("be.visible");

  cy.get(`[test-player-id="${playerKey}"] [data-test="submitButton"]`).contains("Continue");

  // get player with right player key, find data-test (corr. to button)
  cy.get(`[test-player-id="${playerKey}"] [data-test="submitButton"]`).click();
});

Cypress.Commands.add("stepWatchTraining", (playerKey) => {
  cy.log(`⌛️ Stage: Watch Training Video, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`).contains("watch the following", {
    timeout: 10000,
  });

  // TODO: check that the video loaded (stub the handlers?)
  // skip the rest of the video
  cy.submitStage(playerKey);
});

Cypress.Commands.add("stepTeamViabilitySurvey", (playerKey) => {
  cy.log(`⌛️ Exit: Team Viability, player ${playerKey}`);
  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "Please select the option",
    { timeout: 20000 }
  ); // long timeout to wait out the game timer
  cy.wait(700); // flake mitigation

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="capableUnit"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="futureSuccess"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="fallingApart"] input[value="-2"]`
  ).click({
    force: true,
  });

  // Leave out to test that we can handle missing data
  // cy.get(`[test-player-id="${playerKey}"] [data-name="welcomeReuinion"] input[value="2"]`).click({
  //   force: true,
  // });

  // cy.get(`[test-player-id="${playerKey}"] [data-name="persistDespiteObstacles"] input[value="2"]`).click({
  //   force: true,
  // });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="succeedDespiteDislike"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="futureSuccess"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="futureSuccess"] input[value="2"]`
  ).click({
    force: true,
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
  ).type(`${loremIpsum} ${playerKey}`, { force: true });

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

Cypress.Commands.add("stepQCSurvey", (playerKey) => {
  cy.log(`⌛️ Exit: Quality Control, player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains("Help us improve", {
    timeout: 5000,
  });

  cy.get('[data-name="participateAgain"] input[value="no"]').click({
    force: true,
  });

  cy.get('[data-name="adequateCompensation"] input[value="underpaid"]').click({
    force: true,
  });

  cy.get('[data-name="adequateTime"] input[value="adequate"]').click({
    force: true,
  });

  cy.get('[data-name="clearInstructions"] input[value="2"]').click({
    force: true,
  });

  cy.get('[data-name="videoQuality"] input[value="2"]').click({
    force: true,
  });

  cy.get('[data-name="joiningProblems"] input[value="no"]').click({
    force: true,
  });

  cy.get('[data-name="technicalProblems"] input[value="yes"]').click({
    force: true,
  });

  cy.get('[data-name="technicalDetail"] input').type(
    `Check_${playerKey}_technical_entry`,
    { force: true }
  );

  cy.get('[data-name="textExpansion"] input').type(
    `Check_${playerKey}_text_entry`,
    { force: true }
  );

  cy.contains(
    "tell us more about the trouble you had joining the study"
  ).should("not.exist");

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

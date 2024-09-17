const loremIpsum = "lorem ipsum dolor sit amet";

Cypress.Commands.add(
  "empiricaSetupWindow",
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
      url += `&workerId=${workerId}`;
    }
    cy.visit(url, { log: false });
    cy.wait(300, { log: false });
  }
);

Cypress.Commands.add("stepPreIdChecks", (playerKey, { checks }) => {
  if (checks) {
    cy.get(`[test-player-id="${playerKey}"]`).contains(
      "Please confirm the following"
    );

    checks.forEach((check) => {
      cy.get(
        `[test-player-id="${playerKey}"] [data-test="checks"] input[value="${check}"]`
      ).click();
    });
  }
});

Cypress.Commands.add("stepIntro", (playerKey) => {
  // Logs in if not already logged in.
  // playerKeys is ideally an array. Can handle single values.
  // TODO: someday, do this step programmatically

  // Intro splash
  cy.get(`[test-player-id="${playerKey}"]`).contains("Please enter");

  // Assume input payment is always present in cypress test
  cy.get(`[test-player-id="${playerKey}"] [data-test="inputPaymentId"]`).type(
    `noWorkerIdGiven_${playerKey}`,
    { delay: 2 }
  );

  cy.get(`[test-player-id="${playerKey}"] [data-test="joinButton"]`).click();
  // cy.wait(1000); // wait for player join callbacks to complete
});

Cypress.Commands.add("stepConsent", (playerKey) => {
  cy.get(`[test-player-id="${playerKey}"]`).contains("Informed Consent", {
    timeout: 12000,
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

Cypress.Commands.add("submitPlayers", (playerKeys) => {
  playerKeys.forEach((playerKey) => {
    cy.get(
      `[test-player-id="${playerKey}"] [data-test="submitButton"]`
    ).click();
  });
});

Cypress.Commands.add("playerCanSee", (playerKey, text) =>
  cy.get(`[test-player-id="${playerKey}"]`).contains(text)
);
Cypress.Commands.add("playerCanNotSee", (playerKey, text) =>
  cy.get(`[test-player-id="${playerKey}"]`).contains(text).should("not.exist")
);

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

Cypress.Commands.add("stepVideoCheck", (playerKey, { headphonesRequired }) => {
  cy.log(`⌛️ Intro: Video Check player ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "check your sound output",
    {
      timeout: 5000,
    }
  );

  if (headphonesRequired) {
    cy.get(
      `[test-player-id="${playerKey}"] input[value="wearingHeadphones"]`
    ).click();
  }

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="playSound"]`
  ).click();

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
  ).type(`nickname_${playerKey}`, { force: true, delay: 2 });

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueNickname"]`
  ).click();
});

Cypress.Commands.add("stepAttentionCheck", (playerKey) => {
  cy.log(`⌛️ Intro: Attention Check ${playerKey}`);

  cy.get(`[test-player-id="${playerKey}"]`).contains(
    "type the following sentence",
    { timeout: 5000 }
  );

  // when nothing is entered and submitted, the whole sentence should be red
  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueAttentionCheck"]`
  ).click();

  cy.get(`[test-player-id="${playerKey}"] mark[data-test="incorrectPortion"]`)
    .should("have.css", "background-color", "rgb(248, 128, 128)")
    .contains(
      "I agree to participate in this study to the best of my ability."
    );

  // check if it allows copy-paste
  cy.get(`[test-player-id="${playerKey}"] span#originalString`).trigger(
    "keydown",
    { keyCode: 67, ctrlKey: true }
  );

  cy.get(
    `[test-player-id="${playerKey}"] input[data-test="inputAttentionCheck"]`
  )
    .focus()
    .trigger("keydown", { keyCode: 86, ctrlKey: true });

  cy.get(
    `[test-player-id="${playerKey}"] input[data-test="inputAttentionCheck"]`
  ).should(($input) => {
    expect($input.val()).to.equal("");
  });

  // TODO: check if it allows drag and drop

  // when only parts are entered and submitted, it should be half green half red
  cy.get(
    `[test-player-id="${playerKey}"] input[data-test="inputAttentionCheck"]`
  ).type(`I agree to eat a starfish`, { force: true });

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueAttentionCheck"]`
  ).click();

  cy.get(`[test-player-id="${playerKey}"] mark[data-test="correctPortion"]`)
    .should("have.css", "background-color", "rgb(128, 248, 128)")
    .contains("I agree to ");

  cy.get(`[test-player-id="${playerKey}"] mark[data-test="incorrectPortion"]`)
    .should("have.css", "background-color", "rgb(248, 128, 128)")
    .contains("participate in this study to the best of my ability.");

  // when the correct sentence is entered, pass the stage
  cy.get(
    `[test-player-id="${playerKey}"] input[data-test="inputAttentionCheck"]`
  ).type(
    `{selectall}{backspace}I agree to participate in this study to the best of my ability.`,
    { force: true }
  );

  cy.get(
    `[test-player-id="${playerKey}"] button[data-test="continueAttentionCheck"]`
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

Cypress.Commands.add(
  "stepSurveyPoliticalPartyUS",
  (playerKey, party = "Republican") => {
    cy.log(`⌛️ Survey: PoliticalPartyUS ${playerKey}`);

    cy.get(`[test-player-id="${playerKey}"]`).contains(
      "Generally speaking, do you usually think",
      {
        timeout: 5000,
      }
    );

    if (party === "Republican") {
      cy.get(`[test-player-id="${playerKey}"] input[value="Republican"]`).click(
        {
          force: true,
        }
      );
      cy.get(
        `[test-player-id="${playerKey}"] input[value="Strong Republican"]`
      ).click({
        force: true,
      });

      cy.get(`[test-player-id="${playerKey}"] input[value="Next"]`).click({
        force: true,
      });
      cy.get(
        `[test-player-id="${playerKey}"] [data-name="republicanImportance"] input[type=range]`
      )
        .invoke("val", 25)
        .click();
    } else if (party === "Democrat") {
      cy.get(`[test-player-id="${playerKey}"] input[value="Democrat"]`).click({
        force: true,
      });
      cy.get(
        `[test-player-id="${playerKey}"] input[value="Strong Democrat"]`
      ).click({
        force: true,
      });

      cy.get(`[test-player-id="${playerKey}"] input[value="Next"]`).click({
        force: true,
      });
      cy.get(
        `[test-player-id="${playerKey}"] [data-name="democratImportance"] input[type=range]`
      )
        .invoke("val", 25)
        .click();
    } else if (party === "Independent") {
      cy.get(
        `[test-player-id="${playerKey}"] input[value="Independent"]`
      ).click({
        force: true,
      });
      cy.get(`[test-player-id="${playerKey}"] input[value="Neither"]`).click({
        force: true,
      });
      cy.get(`[test-player-id="${playerKey}"] input[value="Next"]`).click({
        force: true,
      });
      cy.get(
        `[test-player-id="${playerKey}"] [data-name="independentImportance"] input[type=range]`
      )
        .invoke("val", 25)
        .click();
    } else {
      throw new Error("Invalid party");
    }

    cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });
  }
);

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
  ).type(`${loremIpsum} ${playerKey}`, { force: true });

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

  cy.get(`[test-player-id="${playerKey}"] [data-test="submitButton"]`).contains(
    "Continue"
  );

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
    // .next()
    .parent()
    .contains("2")
    .should("exist")
    .should("be.visible")
    .click({ force: true });

  cy.wait(500); // flake mitigation
  cy.get(
    `[test-player-id="${playerKey}"] [data-name="nps_score"] input[value="1"]`
  )
    // .next()
    .parent()
    .contains("1")
    .should("exist")
    .should("be.visible")
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

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="participateAgain"] input[value="no"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="adequateCompensation"] input[value="underpaid"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="adequateTime"] input[value="adequate"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="clearInstructions"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="videoQuality"] input[value="2"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="joiningProblems"] input[value="no"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="technicalProblems"] input[value="yes"]`
  ).click({
    force: true,
  });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="technicalDetail"] input`
  ).type(`Check_${playerKey}_technical_entry`, { force: true });

  cy.get(
    `[test-player-id="${playerKey}"] [data-name="textExpansion"] input`
  ).type(`Check_${playerKey}_text_entry`, { force: true });

  cy.get(`[test-player-id="${playerKey}"]`)
    .contains("tell us more about the trouble you had joining the study")
    .should("not.exist");

  cy.get(`[test-player-id="${playerKey}"] form`) // submit surveyJS form
    .then(($form) => {
      cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
    });
});

Cypress.Commands.add("typeInChat", (playerKey, message) => {
  cy.get(`[test-player-id="${playerKey}"] textarea[name="message"]`)
    .type(message)
    .type("{enter}");
});

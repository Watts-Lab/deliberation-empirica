// Normal_Paths.js
// This test aims to test all the functionality that a user
// will encounter if they proceed through the experiement as expected

describe("normal_paths", () => {
  const playerKeys = ["test_" + Math.floor(Math.random() * 1e13)];

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

  it("walks properly", () => {
    cy.log("Log in all players");
    cy.wrap(playerKeys, { log: false }).each((playerKey) => {
      cy.empiricaLoginPlayer(playerKey)
    });

    cy.log("Advance all players through video check");
    cy.wrap(playerKeys, { log: false }).each((playerKey) => {
      cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

      //Instructions
      cy.contains("About this study:", { timeout: 5000 });
      // Understanding check
      cy.contains(
        "Answer the following questions to verify your understanding of the instructions.",
        { timeout: 5000 }
      );
      cy.get("label")
        .contains(
          "Partcipate in and answer questions about a discussion with others"
        )
        .click();
      cy.get("label").contains("True").click();
      cy.get("label")
        .contains("To be anonmously published in academic venues")
        .click();
      cy.get("label")
        .contains(
          "Our research team and select researchers under confidentiality agreements"
        )
        .click();
      cy.get("label").contains("15-35 minutes").click();
      cy.get("button").contains("Next").click();
      // cy.get('button').contains("Next").click({force: true});

      // Name Input
      cy.contains("please enter your first name", { timeout: 5000 });
      cy.get("input")
        .click()
        .type(playerKey + "_name");
      cy.get("button").contains("Next").click();

      // Video check
      cy.contains("Check your webcam", { timeout: 5000 });
      //cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get('input[id="enabled"]').click();
      cy.get('input[id="see"]').click();
      cy.get('input[id="noName"]').click();
      cy.get('input[id="background"]').click();

      // Todo: fix alert checking.
      // cy.get("button").contains("Next").click(); // not everything is checked!
      // cy.on("window:alert", (txt) => {
      //   expect(txt).to.contains("Please confirm that you are read");
      // });

      cy.get('input[id="safeplace"]').click();
      cy.get('input[id="speakFree"]').click();
      cy.get('input[id="noInterrupt"]').click();

      cy.get("button").contains("Next").click();
    });

    cy.log("Advance all players to lobby");
    cy.wrap(playerKeys, { log: false }).each((playerKey) => {
      // Preread of topic
      cy.log("Initial Question");
      cy.contains("This is the topic", { timeout: 5000 });
      // This is flaky!  https://www.cypress.io/blog/2020/07/22/do-not-get-too-detached/
      cy.contains("Neither favor nor oppose").click({ force: true });
      cy.contains("Unsure").click({ force: true }); // flake backup

      cy.get("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
        });
    });

    cy.log("Advance first player into game");
    const playerKey = playerKeys[0];
    cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
    // .then(cy.get('[data-test="skip"]', {timeout: 200}).click({force: true}));

    //team viability survey
    cy.log("Team Viability");
    cy.contains("Please select the option", { timeout: 10000 }); // long timeout to wait out the game timer
    cy.wait(500); // flake mitigation
    cy.get('[data-responsive-title="Disagree"]').click({
      multiple: true,
      timeout: 6000,
    });
    cy.get("form") // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });

    cy.contains("Quality Feedback Survey", { timeout: 5000 });
    cy.wait(500); // flake mitigation
    cy.get('[data-responsive-title="Disagree"]').click({
      multiple: true,
      timeout: 6000,
    });
    cy.contains("underpaid").click({ force: true });
    cy.get('[aria-label="Please rate the quality of the video call."]')
      .eq(3)
      .click({ force: true });

    cy.get('input[aria-label="Did you find the platform easy to use? Why or why not?"')
      .click().type("EasyUseStoreTest");

    cy.get("form") // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });

    //TODO @kailyl: Check payment is correct for normal games

    cy.contains("Finished");
    cy.empiricaLoginAdmin()
    cy.waitUntil(
      () => cy.get('body', { log: false }).then( $body => $body.find('button:contains("Stop")').length < 1),
      {log: false}
  )

    // Check that data was entered into tajriba.json
    // path is relative to the location of `cypress.config.js`
    cy.exec('cp ../.empirica/local/tajriba.json tmp_tajriba.txt')
    cy.readFile('tmp_tajriba.txt')
      .should('contain', "responses") // this puts a lot of cruft in the log, but it works
      .should('contain', "result")
      .should('contain', "normScore")
      .should('contain', "EasyUseStoreTest") 

  });
});
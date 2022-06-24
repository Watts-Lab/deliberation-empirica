// Game_Filled.js

describe("All games fill up with extra player in intro steps", () => {
  const condition = "cypress1";
  const playerKey = "test_" + Math.floor(Math.random() * 1e13);

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
    cy.wait(500)
    // cy.visit(`http://localhost:3000/?playerKey=${playerKey + "_no_complete"}`);

    // cy.log("Consent");
    // cy.contains("consent", { timeout: 5000 });
    // cy.get("button").contains("I AGREE").click();

    // // Login
    // cy.log("Enter Username");
    // cy.contains("Enter your", { timeout: 5000, log: false });
    // cy.get("input").click().type(playerKey + "_no_complete");
    // cy.get("button").contains("Enter").click();

    //Completing player
    cy.empiricaLoginPlayer(playerKey + "_complete")
    // cy.visit(`http://localhost:3000/?playerKey=${playerKey + "_complete"}`);

    // cy.log("Consent");
    // //cy.contains("Informed Consent", { timeout: 5000 });
    // cy.contains("consent", { timeout: 5000 });
    // cy.get("button").contains("I AGREE").click();

    // // Login
    // cy.log("Add Username");
    // cy.contains("Enter your", { timeout: 5000 });
    // cy.get("input").click().type(playerKey + "_complete");
    // cy.get("button").contains("Enter").click();

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
      });

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 });

    // Back to non-completing player
    cy.visit(`/?playerKey=${playerKey + "_no_complete"}`);
    
    // Todo: @kailyl - check for gamefull page here.
    cy.contains("No experiments available", {timeout: 3000})
  });
});

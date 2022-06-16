// Game_Filled.js

import dayjs from 'dayjs'

describe("All games fill up with extra player in intro steps", () => {
    const condition = "cypress1";
    const playerKey = 'test_'+Math.floor(Math.random() * 1e13)
    let start; 
    let end; 
    let difference; 
    let payment;

  before(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch("cypress1");

    //Start batch
    cy.get("tr", { log: false })
      .last({ log: false })
      .contains("Start", { log: false })
      .click({ log: "Start Button" });

    //Check started
    cy.waitUntil(() =>
      cy.get("tr")
        .last()
        .then(($tr) => $tr.find('button:contains("Stop")').length == 1)
    );
  });

  it("redirects to sorry on game full", () => {
    /////////// Non-completing player ////////////////////////////////
    cy.visit(`http://localhost:3000/?playerKey=${playerKey + "_no_complete"}`);

    // Consent
    cy.log("Consent");
    cy.contains("consent", { timeout: 5000 });
    cy.get("button").contains("I AGREE").click();

    // Login
    cy.log("Enter Username");
    cy.contains("Enter your", { timeout: 5000 });
    cy.get("input").click().type(playerKey + "_no_complete");
    cy.get('button').contains("Enter").click()
      .then(() => {
        start = dayjs();
        cy.log(`start: ${start}`)
      });
    cy.log("Spend some time")
    cy.wait(10000) // build in some time to accrue a payment more than 0.00
    
    //////////// Completing player /////////////////////////
    cy.visit(`http://localhost:3000/?playerKey=${playerKey+"_complete"}`);
    
    // Consent
    cy.log("Consent");
    cy.contains("consent", { timeout: 5000 });
    cy.get("button").contains("I AGREE").click();

    // Login
    cy.log("Add Username");
    cy.contains("Enter your", { timeout: 5000 });
    cy.get("input").click().type(playerKey+"_complete");
    cy.get("button").contains("Enter").click();

    //Instructions
    cy.contains("About this study:", { timeout: 5000 });
    cy.contains(
      "Answer the following questions to verify your understanding of the instructions.",
      { timeout: 5000 }
    );
    cy.get("label")
      .contains("Partcipate in a discussion with other participants")
      .click();
    cy.get("label").contains("Write about your group's discussion").click();
    cy.get("label")
      .contains("To be anonmously published in academic venues.")
      .click();
    cy.get("label")
      .contains("To disclose to other participants during the session")
      .click();
    cy.get("label").contains("For quality control").click();
    cy.get("label")
      .contains("To analyze for behavioral patterns to support our research.")
      .click();
    cy.get("label")
      .contains(
        "To share with select researchers under confidentiality agreements."
      )
      .click();
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
    cy.contains(" My camera and microphone are enabled.").click();
    cy.contains(" I can see my full face in the video window.").click();
    cy.contains(
      " (i.e. a diploma on the wall, the name of an employer)."
    ).click();

    cy.get("button").contains("Next").click(); // not everything is checked!
    cy.on("window:alert", (txt) => {
      expect(txt).to.contains("Please confirm that you are read");
    });

    cy.contains(
      " My background doesn't reveal other personal information I am not comfortable sharing."
    ).click();
    cy.contains(" I am in a safe place to engage in a discussion.").click();
    cy.contains(
      " I am in a space where I can speak freely without bothering other people."
    ).click();
    cy.contains(" I will not be interrupted").click();

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
    cy.get('[data-test="profile"]', { timeout: 20000 })
      .then(() => {
          end = dayjs();
          cy.log(`start: ${start.valueOf()}`);
          cy.log(`end: ${end.valueOf()}`)
          difference = end.diff(start)
          payment = String(((difference / 3600000) * 15).toFixed(2))
      })

    // Back to non-completing player
    cy.visit(`http://localhost:3000/?playerKey=${playerKey}_no_complete`);
    cy.contains("Experiment Unavailable", {timeout: 3000}).then( () => {
      cy.log(`Expected payment $${payment}`);
      cy.get('[data-test="paymentAmmount"]')
        .invoke('text')
        .then( (val) => {
          cy.log(`Found ${val}`)
        })
      cy.get('[data-test="paymentAmmount"]').contains(payment)
        //.filter(`:contains("${payment}")`)
        //.should('have.length', 1)
    });


  });
});

/// <reference types="Cypress" />
import dayjs from "dayjs";

// EyesOn_Check.js
// This test aims to test that the EyesOn Component behaves as expected
describe("eyeson_check", () => {
  let start; 
  let end; 
  let difference; 
  let payment;

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
    cy.waitUntil(() =>
      cy
        .get("tr")
        .last()
        .then(($tr) => $tr.find('button:contains("Stop")').length == 1)
    );
  });

  it("connects properly and receives all events", () => {
    cy.empiricaLoginPlayer(playerKey)
      .then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

    cy.log("Advance through preamble");

    //Instructions
    //Instructions and Understanding Check
    cy.log("Intro: instructions and understanding check");
    cy.contains("In this study", { timeout: 5000 });
    cy.contains("Please verify that you understand", { timeout: 5000 });
    cy.get("label").contains("Discuss a topic with others").click();
    cy.get("label").contains("Yes").click();
    cy.get("label").contains("In academic publications, anonymously").click();
    cy.get("label").contains("Researchers under confidentiality agreement").click();
    cy.get("label").contains("15-35 minutes").click();
    cy.get("button").contains("Next").click();

    // Name Input
    cy.contains("please enter your first name", { timeout: 5000 });
    cy.get("input")
      .click()
      .type(playerKey + "_name");
    cy.get("button").contains("Next").click();

    // Video Check
    cy.log('video check');
    cy.contains("Check your webcam", { timeout: 5000 });
    cy.get('input[data-test="enableIframe"]').check({force: true})
    cy.contains("Preparing the Meeting Room...", { timeout: 3000 });
    cy.get('button[class="join-button"]', { timeout: 5000 }).click();
    
    cy.get('input[data-test="enableIframe"]', { timeout: 5000 }).check({force: true})
    cy.window().then(win => {
      cy.spy(win.console, 'debug').as('debugConsole');
    });
    cy.get("video", { timeout: 15000 });
    cy.get('@debugConsole').should('not.be.calledWith', 'recording_update');
    cy.get('@debugConsole').should('be.calledWith', 'accept');
    cy.get('@debugConsole').should('be.calledWith', 'podium');
    
    cy.get('i[class="video-icon"]').parent().click();
    cy.get('@debugConsole').should('be.calledWith', 'podium'); 
    cy.get('i[class="audio-icon"]').parent().click();
    cy.get('@debugConsole').should('be.calledWith', 'podium'); 
    
    cy.get('i[class="audio-icon-muted"]');
    cy.get('i[class="video-icon-muted"]');

    cy.get('input[id="enabled"]').click();
    cy.get('input[id="see"]').click();
    cy.get('input[id="noName"]').click();
    cy.get('input[id="background"]').click();

    cy.get('input[id="safeplace"]').click();
    cy.get('input[id="speakFree"]').click();
    cy.get('input[id="noInterrupt"]').click();

    cy.get("button").contains("Next").click();

    // in game body
    cy.log("Initial Question");
    cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
    // read the topic stage
    cy.contains("personal opinion");
    cy.contains("Neither agree nor disagree").click();
    cy.get('input[type="submit"]').click();
      
      
    // .then(cy.get('[data-test="skip"]', {timeout: 200}).click({force: true}));
    cy.log("In Discussion")
    cy.contains("as a group", { timeout: 20000 });

    // in game body
    cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
    // .then(cy.get('[data-test="skip"]', {timeout: 200}).click({force: true}));
    cy.contains("country would be better off");
    // not skipping out of the discussion because we need to accumulate some time to get paid...
    // cy.get('[data-test="skip"]')
    //   .click({force: true}) //click invisible button to exit discussion

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
    cy.get("form") // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });

    // QC Survey
    cy.contains("Thank you for participating", { timeout: 5000 })
      .then(() => {
          // check that payment is correct
          end = dayjs();
          difference = end.diff(start)
          payment = ((difference / 3600000) * 15)
          const minPayment = payment - .02  // include a bit of margin for small timing differences between server and test runner
          const maxPayment = payment + .02 
          cy.log(`time elapsed: ${difference}, payment: \$${payment}`);
          // wait for callback to complete and update value
          cy.waitUntil( () => cy.get(`[data-test="dollarsOwed"]`)
                                .invoke('text')
                                .then(parseFloat)
                                .then( $value => (minPayment < $value) && ($value < maxPayment) )
          )
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
      .click().type(`Check_${playerKey}_text_entry`);

    cy.get("form") // submit surveyJS form
      .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });

    cy.contains("Finished");
    
    // check that the batch is done
    cy.empiricaLoginAdmin()
    cy.waitUntil(
      () => cy.get('body', { log: false }).then( $body => $body.find('button:contains("Stop")').length < 1),
      {log: false}
    )

    // Check that data was entered into tajriba.json
    // path is relative to the location of `cypress.config.js`
    
    cy.unixRun(() => {
      cy.exec('cp ../.empirica/local/tajriba.json tmp_tajriba.txt')
      .then(() => {
        cy.readFile('tmp_tajriba.txt')
          .should('contain', "responses") // this puts a lot of cruft in the log, but it works
          .should('contain', "result")
          .should('contain', "normScore")
          .should('contain', `Check_${playerKey}_text_entry`) 
          .should('contain', "recording_url")
          .should('contain', "videoEnabled")
          .should('contain', "audioEnabled")
      });
    });
  });
});

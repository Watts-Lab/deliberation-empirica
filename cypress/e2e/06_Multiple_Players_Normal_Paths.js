import dayjs from "dayjs";

describe("multiple_players normal paths", { retries: { runMode: 2, openMode: 1 } }, () => {
    let start; 
    let end; 
    let difference; 
    let payment;

    beforeEach(() => {  // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.empiricaCreateBatch("cypress2");

      //Start batch
      cy.get("tr", { log: false })
      .last({ log: false })
      .contains("Start", { log: false })
      .click({ log: "Start Button" })

      //Check started
      cy.waitUntil(
        () => cy.get("tr", { log: false })
                .last({ log: false })
                .then(($tr) => $tr.find('button:contains("Stop")').length == 1),
        { log: false }
      );
    });

    it("walks properly", () => {
      const playerKey1 = "test_" + Math.floor(Math.random() * 1e13);
      const playerKey2 = "test_" + Math.floor(Math.random() * 1e13);
      const playerKeys = [playerKey1, playerKey2]
      //Consent and Login
      cy.empiricaLoginMultiPlayers(playerKeys)
        .then(() => {
          start = dayjs();
          cy.log(`start: ${start}`);
        })

      //Instructions and Understanding Check P1
      cy.log("Intro: instructions and understanding check");
      cy.contains("In this study", { timeout: 5000 });
      cy.contains("Please verify that you understand", { timeout: 5000 });
      cy.get("label").contains("Discuss a topic with others").click();
      cy.get("label").contains("Yes").click();
      cy.get("label").contains("In academic publications, anonymously").click();
      cy.get("label").contains("Researchers under confidentiality agreement").click();
      cy.get("label").contains("15-35 minutes").click();
      cy.get("button").contains("Next").click();

      cy.scrollTo('bottom');
      //Instructions and Understanding Check P2
      cy.log("Intro: instructions and understanding check");
      cy.contains("In this study", { timeout: 5000 });
      cy.contains("Please verify that you understand", { timeout: 5000 });
      cy.get("label").contains("Discuss a topic with others").click();
      cy.get("label").contains("Yes").click();
      cy.get("label").contains("In academic publications, anonymously").click();
      cy.get("label").contains("Researchers under confidentiality agreement").click();
      cy.get("label").contains("15-35 minutes").click();
      cy.scrollTo('bottom')
      cy.get("button[id='check-understanding-next']").click();
      cy.scrollTo('top');
      

      // Name Input1
      cy.contains("please enter your first name", { timeout: 5000 });
      cy.get("input").eq(0)
        .click()
        .type(playerKey1 + "_name");
      cy.get("button").contains("Next").click();

      cy.scrollTo('bottom')

      // Name Input2
      cy.contains("please enter your first name", { timeout: 5000 });
      cy.get("input[id='inputNickname']")
        .click()
        .type(playerKey2 + "_name");
      cy.get("button[id='enter-nickname']").contains("Next").click();

      // Video check1
      cy.scrollTo('top');
      cy.contains("Check your webcam", { timeout: 5000 });
      //cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get('input[id="enabled"]').eq(0).click();
      cy.get('input[id="see"]').eq(0).click();
      cy.get('input[id="noName"]').eq(0).click();
      cy.get('input[id="background"]').eq(0).click();

      // Todo: fix alert checking.
      // cy.get("button").contains("Next").click(); // not everything is checked!
      // cy.on("window:alert", (txt) => {
      //   expect(txt).to.contains("Please confirm that you are read");
      // });

      cy.get('input[id="safeplace"]').eq(0).click();
      cy.get('input[id="speakFree"]').eq(0).click();
      cy.get('input[id="noInterrupt"]').eq(0).click();
      cy.get("button").contains("Next").eq(0).click();

      // Video check2
      cy.scrollTo('bottom');
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
  
      
      // Initial topic read
      cy.log("Stage: Read Topic");
      cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
      cy.contains("personal opinion");
      cy.contains("Neither agree nor disagree").click();
      cy.get('input[type="submit"]').eq(0).click();

      cy.log("Stage: Read Topic");
      cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
      cy.contains("personal opinion");
      cy.contains("Neither agree nor disagree").click();
      cy.get('input[type="submit"]').click();
        
      // Discussion
      cy.log("Stage: Discussion")
      cy.contains("as a group", { timeout: 1000 });
      cy.contains("Neither agree nor disagree").click();
      // cy.scrollTo('bottom')
      // cy.contains("Neither agree nor disagree").should('have.attr', 'checked', true); //TODO figure out how to check that its checked on both screens

      // not skipping out of the discussion because we need to accumulate some time to get paid...
      // cy.get('[data-test="skip"]')
      //   .click({force: true}) //click invisible button to exit discussion

      //Exit steps
      cy.log("Exit: Team Viability 1");
      cy.contains("Please select the option", { timeout: 20000 }); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });
      cy.get("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(0).click();
      });

      cy.log("Exit: Team Viability 2");
      cy.contains("Please select the option", { timeout: 20000 }); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });
      cy.get("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(1).click();
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
                                  .invoke('text').then(parseFloat)
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

      cy.get('input[aria-label="Did you find the platform easy to use? Why or why not?"').eq(0)
        .click().type(`Check_${playerKey1}_text_entry`);

      cy.get("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(0).click();
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
      cy.exec('cp ../.empirica/local/tajriba.json tmp_tajriba.txt')
        .then(() => {
          cy.readFile('tmp_tajriba.txt')
            .should('contain', "responses") // this puts a lot of cruft in the log, but it works
            .should('contain', "result")
            .should('contain', "normScore")
            .should('contain', `Check_${playerKey1}_text_entry`) 
        })

    });
});
import dayjs from "dayjs";

describe("multiple_players normal paths", { retries: { runMode: 1, openMode: 1 } }, () => {
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
      cy.get("[test-player-id='player1']").contains("In this study", { timeout: 5000 });
      cy.get("[test-player-id='player1']").contains("Please verify that you understand", { timeout: 5000 });
      cy.get("[test-player-id='player1']").find("label").contains("Discuss a topic with others").click();
      cy.get("[test-player-id='player1']").find("label").contains("Yes").click();
      cy.get("[test-player-id='player1']").find("label").contains("In academic publications, anonymously").click();
      cy.get("[test-player-id='player1']").find("label").contains("Researchers under confidentiality agreement").click();
      cy.get("[test-player-id='player1']").find("label").contains("15-35 minutes").click();
      cy.get("[test-player-id='player1']").find("button").contains("Next").click();

      //Instructions and Understanding Check P2
      cy.log("Intro: instructions and understanding check");
      cy.get("[test-player-id='player2']").contains("In this study", { timeout: 5000 });
      cy.contains("Please verify that you understand", { timeout: 5000 });
      cy.get("[test-player-id='player2']").find("label").contains("Discuss a topic with others").click();
      cy.get("[test-player-id='player2']").find("label").contains("Yes").click();
      cy.get("[test-player-id='player2']").find("label").contains("In academic publications, anonymously").click();
      cy.get("[test-player-id='player2']").find("label").contains("Researchers under confidentiality agreement").click();
      cy.get("[test-player-id='player2']").find("label").contains("15-35 minutes").click();
      cy.get("[test-player-id='player2']").find("button[id='check-understanding-next']").click();
      

      // Name Input1
      cy.get("[test-player-id='player1']").contains("please enter your first name", { timeout: 5000 });
      cy.get("[test-player-id='player1']").find("input").eq(0)
        .click()
        .type(playerKey1 + "_name");
      cy.get("[test-player-id='player1']").find("button").contains("Next").click();

      // Name Input2
      cy.get("[test-player-id='player2']").contains("please enter your first name", { timeout: 5000 });
      cy.get("[test-player-id='player2']").find("input[id='inputNickname']")
        .click()
        .type(playerKey2 + "_name");
      cy.get("[test-player-id='player2']").find("button[id='enter-nickname']").contains("Next").click();

      // Video check1
      cy.get("[test-player-id='player1']").contains("Check your webcam", { timeout: 5000 });
      //cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get("[test-player-id='player1']").find('input[id="enabled"]').click();
      cy.get("[test-player-id='player1']").find('input[id="see"]').click();
      cy.get("[test-player-id='player1']").find('input[id="noName"]').click();
      cy.get("[test-player-id='player1']").find('input[id="background"]').click();

      // Todo: fix alert checking.
      // cy.get("button").contains("Next").click(); // not everything is checked!
      // cy.on("window:alert", (txt) => {
      //   expect(txt).to.contains("Please confirm that you are read");
      // });

      cy.get("[test-player-id='player1']").find('input[id="safeplace"]').click();
      cy.get("[test-player-id='player1']").find('input[id="speakFree"]').click();
      cy.get("[test-player-id='player1']").find('input[id="noInterrupt"]').click();
      cy.get("[test-player-id='player1']").find("button").contains("Next").click();

      // Video check2
      cy.get("[test-player-id='player2']").contains("Check your webcam", { timeout: 5000 });
      //cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get("[test-player-id='player2']").find('input[id="enabled"]').click();
      cy.get("[test-player-id='player2']").find('input[id="see"]').click();
      cy.get("[test-player-id='player2']").find('input[id="noName"]').click();
      cy.get("[test-player-id='player2']").find('input[id="background"]').click();

      // Todo: fix alert checking.
      // cy.get("button").contains("Next").click(); // not everything is checked!
      // cy.on("window:alert", (txt) => {
      //   expect(txt).to.contains("Please confirm that you are read");
      // });

      cy.get("[test-player-id='player2']").find('input[id="safeplace"]').click();
      cy.get("[test-player-id='player2']").find('input[id="speakFree"]').click();
      cy.get("[test-player-id='player2']").find('input[id="noInterrupt"]').click();
      cy.get("[test-player-id='player2']").find("button").contains("Next").click();
  
      
      // Initial topic read p1
      cy.log("Stage: Read Topic P1");
      cy.get("[test-player-id='player1']").find('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
      cy.get("[test-player-id='player1']").contains("personal opinion");
      cy.get("[test-player-id='player1']").contains("Neither agree nor disagree").click();
      cy.get("[test-player-id='player1']").find('input[type="submit"]').eq(0).click();

      //initial topic read p2
      cy.log("Stage: Read Topic P2");
      cy.get("[test-player-id='player2']").find('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
      cy.get("[test-player-id='player2']").contains("personal opinion");
      cy.get("[test-player-id='player2']").get('input[value="Neither agree nor disagree"]').should("not.be.checked") // check no spillover from p1
      cy.get("[test-player-id='player2']").contains("Agree strongly").click();
      cy.get("[test-player-id='player2']").find('input[type="submit"]').click();
      
      // Discussion
      cy.log("Stage: Discussion P1")
      cy.get("[test-player-id='player2']").get('input[value="Neither agree nor disagree"]').should("not.be.checked") // check no spillover from previous stage
      cy.get("[test-player-id='player2']").get('input[value="Agree strongly"]').should("not.be.checked") // check no spillover from previous stage
      cy.get("[test-player-id='player1']").contains("Neither agree nor disagree").click();

      cy.log("Stage: Discussion P2")
      cy.get("[test-player-id='player2']").contains("as a group", { timeout: 1000 });
      cy.get("[test-player-id='player2']").get('input[value="Neither agree nor disagree"]').should("be.checked") // check updates p2 from p1
      cy.get("[test-player-id='player2']").contains("Agree strongly").click();
      
      cy.get("[test-player-id='player2']").get('input[value="Agree strongly"]').should("be.checked") // check updates p1 from p2

      // not skipping out of the discussion because we need to accumulate some time to get paid...
      // cy.get('[data-test="skip"]')
      //   .click({force: true}) //click invisible button to exit discussion

      //Exit steps

      // Player 1
      cy.log("Exit: Team Viability 1");
      cy.get("[test-player-id='player1']").contains("Please select the option", { timeout: 20000 }); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get("[test-player-id='player1']").find('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });

      cy.get("[test-player-id='player1']").find("form") // submit surveyJS form
        .then(($form) => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(0).click();
      });


      // QC Survey P1
      cy.get("[test-player-id='player1']").contains("Thank you for participating", { timeout: 5000 })
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

      cy.get("[test-player-id='player1']").contains("Quality Feedback Survey", { timeout: 5000 });
      cy.wait(500); // flake mitigation
      cy.get("[test-player-id='player1']").find('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });
      cy.get("[test-player-id='player1']").contains("underpaid").click({ force: true });
      cy.get("[test-player-id='player1']").contains("too little time").click({ force: true });
      cy.get("[test-player-id='player1']").find('[aria-label="Please rate the quality of the video call."]')
        .eq(3)
        .click({ force: true });

      cy.get(`input[aria-label="If you'd like to expand on any of your above responses or add any additional feedback, please do so here."`)
        .click().type(`Check_${playerKey1}_text_entry`);

      cy.get("[test-player-id='player1']").find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(0).click();
        });

      cy.get("[test-player-id='player1']").contains("Finished");


      // Player 2 exit steps
      cy.log("Exit: Team Viability 2");
      cy.get("[test-player-id='player2']").contains("Please select the option", { timeout: 20000 }); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get("[test-player-id='player2']").find('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });

      cy.get("[test-player-id='player2']").find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });



      // QC Survey P2
      cy.get("[test-player-id='player2']").contains("Thank you for participating", { timeout: 5000 })
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

      cy.get("[test-player-id='player2']").contains("Quality Feedback Survey", { timeout: 5000 });
      cy.wait(500); // flake mitigation
      cy.get("[test-player-id='player2']").find('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });
      cy.get("[test-player-id='player2']").contains("underpaid").click({ force: true });
      cy.get("[test-player-id='player2']").contains("too little time").click({ force: true });
      cy.get("[test-player-id='player2']").find('[aria-label="Please rate the quality of the video call."]')
        .eq(3)
        .click({ force: true });

      cy.get(`input[aria-label="If you'd like to expand on any of your above responses or add any additional feedback, please do so here."`)
        .click().type(`Check_${playerKey2}_text_entry`);

      cy.get("[test-player-id='player2']").find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).eq(0).click();
        });

      cy.get("[test-player-id='player2']").contains("Finished");
      
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
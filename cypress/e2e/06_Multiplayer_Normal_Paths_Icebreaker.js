import dayjs from "dayjs";

describe(
  "Multiplayer normal paths: Icebreaker",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    let start;
    let end;
    let difference;
    let payment;

    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.empiricaCreateBatch("cypress2_icebreaker");
      cy.empiricaStartBatch("cypress2_icebreaker");
    });

    it("walks properly", () => {
      const playerKeys = [
        `test_${Math.floor(Math.random() * 1e13)}`,
        `test_${Math.floor(Math.random() * 1e13)}`,
      ];

      // Consent and Login
      cy.empiricaLoginPlayers({ playerKeys }).then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

      // Instructions and Understanding Check P1
      cy.log("Intro: instructions and understanding check");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("In this study", {
        timeout: 5000,
      });
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please verify that you understand",
        { timeout: 5000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("label")
        .contains("Discuss a topic with others")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("label")
        .contains("No")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("label")
        .contains("In academic publications, anonymously")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("label")
        .contains("Researchers under confidentiality agreement")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("label")
        .contains("15-35 minutes")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("button")
        .contains("Next")
        .click(); // contains incorrect answer

      // check for alert
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Some of your responses were incorrect!",
        { timeout: 5000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get("label")
        .contains("Yes")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("button")
        .contains("Next")
        .click();

      cy.log("Intro: instructions and understanding check");
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains("In this study", {
        timeout: 5000,
      });
      cy.contains("Please verify that you understand", { timeout: 5000 });
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("label")
        .contains("Discuss a topic with others")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("label")
        .contains("No")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("label")
        .contains("In academic publications, anonymously")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("label")
        .contains("Researchers under confidentiality agreement")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("label")
        .contains("15-35 minutes")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('button[id="check-understanding-next"]')
        .click(); // contains incorrect answer

      // check for alert
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Some of your responses were incorrect!",
        { timeout: 5000 }
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .get("label")
        .contains("Yes")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("button")
        .contains("Next")
        .click();

      // Name Input1
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "please enter your first name",
        { timeout: 5000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("input")
        .eq(0)
        .click()
        .type(`${playerKeys[0]}_name`);
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("button")
        .contains("Next")
        .click();

      // Name Input2
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "please enter your first name",
        { timeout: 5000 }
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="inputNickname"]')
        .click()
        .type(`${playerKeys[1]}_name`);
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('button[id="enter-nickname"]')
        .contains("Next")
        .click();

      // Video check1
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Check your webcam",
        { timeout: 5000 }
      );
      // cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="enabled"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="see"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="noName"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="background"]')
        .click();

      // check for alert
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get("button")
        .contains("Next")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Not all of the necessary items were confirmed!",
        { timeout: 5000 }
      );

      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="safeplace"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="speakFree"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[id="noInterrupt"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("button")
        .contains("Next")
        .click();

      // Player 1 in lobby
      // TODO: check that we like the message here
      // cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
      //   '1 players have joined out of 2 total expected',
      // );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Waiting for other players"
      );

      // Video check2
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Check your webcam",
        { timeout: 5000 }
      );
      // cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="enabled"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="see"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="noName"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="background"]')
        .click();

      // check for alert
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .get("button")
        .contains("Next")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Not all of the necessary items were confirmed!",
        { timeout: 5000 }
      );

      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="safeplace"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="speakFree"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[id="noInterrupt"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("button")
        .contains("Next")
        .click();

      // Initial topic read p1
      cy.log("Stage: Read Topic P1");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).find(
        '[data-test="profile"]',
        { timeout: 20000 }
      ); // check that profile loaded
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "personal opinion",
        { timeout: 3000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("Neither agree nor disagree")
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('input[type="submit"]')
        .eq(0)
        .click();
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other player"
      );

      // initial topic read p2
      cy.log("Stage: Read Topic P2");
      cy.get(`[test-player-id="${playerKeys[1]}"]`).find(
        '[data-test="profile"]',
        { timeout: 20000 }
      ); // check that profile loaded
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "personal opinion"
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .get('input[value="Neither agree nor disagree"]')
        .should("not.be.checked"); // check no spillover from p1
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("Agree strongly")
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('input[type="submit"]')
        .click();
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("Please wait for other player")
        .should("not.exist");

      // Icebreaker
      cy.contains("you have in common", { timeout: 2000 });

      // Discussion
      cy.log("Stage: Discussion P1");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("as a group", {
        timeout: 15000,
      });
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get('input[value="Neither agree nor disagree"]')
        .should("not.be.checked"); // check no spillover from previous stage
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get('input[value="Agree strongly"]')
        .should("not.be.checked"); // check no spillover from previous stage
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("Neither agree nor disagree")
        .click();

      cy.log("Stage: Discussion P2");
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        `${playerKeys[0]}_name changed the selected answer`
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .get('input[value="Neither agree nor disagree"]')
        .should("be.checked"); // check updates p2 from p1
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("Agree strongly")
        .click();

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        `${playerKeys[1]}_name changed the selected answer`
      ); // check that the notification displays
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get('input[value="Agree strongly"]')
        .should("be.checked"); // check updates p1 from p2

      // not skipping out of the discussion because we need to accumulate some time to get paid...
      // cy.get('[data-test="skip"]')
      //   .click({force: true}) //click invisible button to exit discussion

      // Exit steps

      // Player 1
      cy.log("Exit: Team Viability 1");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please select the option",
        { timeout: 20000 }
      ); // long timeout to wait out the game timer
      cy.wait(700); // flake mitigation
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('[data-responsive-title="Disagree"]')
        .click({
          multiple: true,
          timeout: 10000,
        });

      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]'))
            .eq(0)
            .click();
        });

      // QC Survey P1
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("Thank you for participating", { timeout: 10000 })
        .then(() => {
          // check that payment is correct
          end = dayjs();
          difference = end.diff(start);
          payment = (difference / 3600000) * 15;
          cy.log(`time elapsed: ${difference}, expected payment: $${payment}`);
          cy.contains("calculating", { timeout: 40000 }).should("not.exist");
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(($value) => cy.log(`Observed payment ${$value}`));
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(parseFloat)
            .should("be.closeTo", payment, 0.02);
        });

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Quality Feedback Survey",
        { timeout: 5000 }
      );
      cy.wait(1000); // flake mitigation
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('[data-responsive-title="Disagree"]')
        .click({
          multiple: true,
          timeout: 10000,
        });
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("underpaid")
        .click({ force: true });
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .contains("too little time")
        .click({ force: true });
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find('[aria-label="Please rate the quality of the video call."]')
        .eq(3)
        .click({ force: true });

      cy.get(
        'input[aria-label="If you\'d like to expand on any of your above responses or add any additional feedback, please do so here."'
      )
        .click()
        .type(`Check_${playerKeys[0]}_text_entry`);

      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]'))
            .eq(0)
            .click();
        });

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // Player 2 exit steps
      cy.log("Exit: Team Viability 2");
      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Please select the option",
        { timeout: 20000 }
      ); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('[data-responsive-title="Disagree"]')
        .click({
          multiple: true,
          timeout: 6000,
        });

      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
        });

      // QC Survey P2
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("Thank you for participating", { timeout: 5000 })
        .then(() => {
          // check that payment is correct
          end = dayjs();
          difference = end.diff(start);
          payment = (difference / 3600000) * 15;
          cy.log(`time elapsed: ${difference}, expected payment: $${payment}`);
          // TODO: figure out why these timeouts take so long on GH actions
          cy.contains("calculating", { timeout: 40000 }).should("not.exist");
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(($value) => cy.log(`Observed payment ${$value}`));
          cy.get('[data-test="dollarsOwed"]')
            .invoke("text")
            .then(parseFloat)
            .should("be.closeTo", payment, 0.02);
        });

      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        "Quality Feedback Survey",
        { timeout: 5000 }
      );
      cy.wait(1000); // flake mitigation
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('[data-responsive-title="Disagree"]')
        .click({
          multiple: true,
          timeout: 6000,
        });
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("underpaid")
        .click({ force: true });
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .contains("too little time")
        .click({ force: true });
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find('[aria-label="Please rate the quality of the video call."]')
        .eq(3)
        .click({ force: true });

      cy.get(
        'input[aria-label="If you\'d like to expand on any of your above responses or add any additional feedback, please do so here."'
      )
        .click()
        .type(`Check_${playerKeys[1]}_text_entry`);

      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .find("form") // submit surveyJS form
        .then(($form) => {
          cy.wrap($form.find('input[type="button"][value="Complete"]'))
            .eq(0)
            .click();
        });

      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains("Finished");

      // check that the batch is done
      cy.empiricaLoginAdmin();
      cy.waitUntil(
        () =>
          cy
            .get("body", { log: false })
            .then(($body) => $body.find('button:contains("Stop")').length < 1),
        { log: false }
      );

      // Check that data was entered into tajriba.json
      // path is relative to the location of `cypress.config.js`
      cy.unixRun(() => {
        cy.exec("cp ../.empirica/local/tajriba.json tmp_tajriba.txt").then(
          () => {
            cy.readFile("tmp_tajriba.txt")
              .should("contain", "responses") // this puts a lot of cruft in the log, but it works
              .should("contain", "result")
              .should("contain", "normScore")
              .should("contain", `Check_${playerKeys[0]}_text_entry`);
          }
        );
      });
    });
  }
);

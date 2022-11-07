import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    let start;
    let end;
    let difference;
    let payment;

    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.empiricaCreateBatch("cypress_omnibus");
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      const playerKeys = [
        `test_A_${Math.floor(Math.random() * 1e13)}`,
        `test_B_${Math.floor(Math.random() * 1e13)}`,
      ];

      const hitId = "cypressTestHIT";
      // Consent and Login
      cy.empiricaLoginPlayers({ playerKeys, hitId }).then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
      });

      // Instructions and Understanding Check
      cy.stepInstructions(playerKeys[0]);
      cy.stepInstructions(playerKeys[1]);

      // Video check
      cy.stepVideoCheck(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Waiting for other players"
      ); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // Initial topic read
      cy.get("@consoleLog").should("be.calledWith", "Stage 0: Topic Survey");
      cy.stepPreQuestion(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other player"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // Watch training video
      cy.get("@consoleLog").should("be.calledWith", "Stage 1: Training Video");
      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // Icebreaker
      cy.stepIcebreaker(playerKeys[0]);
      cy.stepIcebreaker(playerKeys[1]);

      // Discussion
      cy.log("Stage: Discussion");
      cy.waitUntil(() =>
        cy
          .get("body", { log: false })
          .then(($body) => $body.find("you have in common").length < 1)
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "level of agreement",
        { timeout: 15000 }
      );
      cy.get("@consoleLog").should("be.calledWith", "Stage 3: Deliberation");
      cy.get(`[test-player-id="${playerKeys[0]}"] input[value="2"]`).should(
        "not.be.checked"
      ); // check no spillover from previous stage
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get('input[value="4"]')
        .should("not.be.checked"); // check no spillover from previous stage
      // make selection
      cy.get(`[test-player-id="${playerKeys[0]}"] input[value="2"]`).click();

      cy.get(`[test-player-id="${playerKeys[1]}"]`).contains(
        `${playerKeys[0]}_name changed the selected answer`
      );
      cy.get(`[test-player-id="${playerKeys[1]}"]`)
        .get('input[value="2"]')
        .should("be.checked"); // check updates p2 from p1
      cy.get(`[test-player-id="${playerKeys[1]}"] input[value="4"]`).click();

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        `${playerKeys[1]}_name changed the selected answer`
      ); // check that the notification displays
      cy.get(`[test-player-id="${playerKeys[0]}"]`)
        .get('input[value="4"]')
        .should("be.checked"); // check updates p1 from p2

      // Exit steps

      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

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

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // Player 2 exit steps
      cy.stepTeamViabilitySurvey(playerKeys[1]);
      cy.wait(3000); // ensure that p2 completion time will be different from p1
      cy.stepExampleSurvey(playerKeys[1]);

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

      cy.stepQCSurvey(playerKeys[1]);

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
      cy.empiricaDataContains([
        `Check_${playerKeys[0]}_text_entry`,
        `Check_${playerKeys[1]}_text_entry`,
      ]);

      cy.empiricaPaymentFileContains({
        paymentFilename: `payments_turk_${hitId}.csv`,
        contents: playerKeys,
      });
    });
  }
);

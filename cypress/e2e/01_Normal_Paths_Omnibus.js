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
      cy.wait(500);
      cy.empiricaCreateBatch("cypress_omnibus");
      cy.empiricaStartBatch("cypress_omnibus");
    });

    it("walks properly", () => {
      const playerKeys = [
        `test_A_${Math.floor(Math.random() * 1e13)}`,
        `test_B_${Math.floor(Math.random() * 1e13)}`,
      ];

      // Consent and Login
      cy.empiricaLoginPlayers({ playerKeys }).then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

      // Instructions and Understanding Check P1
      cy.stepInstructions(playerKeys[0]);
      cy.stepInstructions(playerKeys[1]);

      // Name Input1
      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);

      // Video check1
      cy.stepVideoCheck(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Waiting for other players"
      ); // lobby wait
      cy.stepVideoCheck(playerKeys[1]);

      // Initial topic read p1
      cy.stepPreQuestion(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other player"
      ); // stage advance wait
      cy.stepPreQuestion(playerKeys[1]);

      // Watch training video
      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // Icebreaker
      cy.stepIcebreaker(playerKeys[0]);
      cy.stepIcebreaker(playerKeys[1]);

      // Discussion
      cy.log("Stage: Discussion P1");
      cy.waitUntil(() =>
        cy
          .get("body", { log: false })
          .then(($body) => $body.find("you have in common").length < 1)
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`, {
        timeout: 15000,
      }).contains("as a group", { timeout: 15000 });
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
    });
  }
);
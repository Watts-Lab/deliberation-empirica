// Normal_Paths.js
// This test aims to test all the functionality that a user
// will encounter if they proceed through the experiement as expected

import dayjs from 'dayjs';

describe(
  'Normal paths: Training Video',
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    let start;
    let end;
    let difference;
    let payment;

    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.empiricaCreateBatch('cypress1_trainingVideo');

      // Start batch
      cy.get('tr', { log: false })
        .last({ log: false })
        .contains('Start', { log: false })
        .click({ log: 'Start Button' });

      // Check started
      cy.waitUntil(
        () => cy
          .get('tr', { log: false })
          .last({ log: false })
          .then($tr => $tr.find('button:contains("Stop")').length === 1),
        { log: false },
      );
    });

    it('walks properly', () => {
      const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
      // Consent and Login
      cy.empiricaLoginPlayer({ playerKey }).then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

      // Instructions and Understanding Check
      cy.log('Intro: instructions and understanding check');
      cy.contains('In this study', { timeout: 5000 });
      cy.contains('Please verify that you understand', { timeout: 5000 });
      cy.get('label').contains('Discuss a topic with others').click();
      cy.get('label').contains('No').click();
      cy.get('label').contains('In academic publications, anonymously').click();
      cy.get('label')
        .contains('Researchers under confidentiality agreement')
        .click();
      cy.get('label').contains('15-35 minutes').click();
      cy.get('button').contains('Next').click(); // contains incorrect answer

      // check for alert
      cy.contains('Some of your responses were incorrect!', { timeout: 5000 });
      cy.get('label').contains('Yes').click();
      cy.get('button').contains('Next').click();

      // Name Input
      cy.contains('please enter your first name', { timeout: 5000 });
      cy.get('input')
        .click()
        .type(`${playerKey}_name`);
      cy.get('button').contains('Next').click();

      // Video check
      cy.contains('Check your webcam', { timeout: 5000 });
      // cy.get('[data-test="enableIframe"]').uncheck({force: true}) // default disabled in cypress

      cy.get('input[id="enabled"]').click();
      cy.get('input[id="see"]').click();
      cy.get('input[id="noName"]').click();
      cy.get('input[id="background"]').click();

      // check for alert
      cy.get('button').contains('Next').click();
      cy.contains('Not all of the necessary items were confirmed!', { timeout: 5000 });

      cy.get('input[id="safeplace"]').click();
      cy.get('input[id="speakFree"]').click();
      cy.get('input[id="noInterrupt"]').click();
      cy.get('button').contains('Next').click();

      // Initial topic read
      cy.log('Stage: Read Topic');
      cy.get('[data-test="profile"]', { timeout: 20000 }); // check that profile loaded
      cy.contains('personal opinion');
      cy.contains('Neither agree nor disagree').click();
      cy.get('input[type="submit"]').click();

      // Training
      cy.contains('watch the following training video', { timeout: 1000 });

      // No icebreaker
      cy.contains('you have in common', { timeout: 3000 }).should('not.exist');

      // Discussion
      cy.log('Stage: Discussion');
      cy.contains('as a group', { timeout: 25000 });
      cy.contains('Neither agree nor disagree').click();
      // cy.get('[data-test="skip"]').click({force: true}) //click invisible button to exit discussion

      // not skipping out of the discussion because we need to accumulate some time to get paid...
      // cy.get('[data-test="skip"]')
      //   .click({force: true}) //click invisible button to exit discussion

      // Exit steps
      cy.log('Exit: Team Viability');
      cy.contains('Please select the option', { timeout: 20000 }); // long timeout to wait out the game timer
      cy.wait(500); // flake mitigation
      cy.get('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });
      cy.get('form') // submit surveyJS form
        .then($form => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
        });

      // QC Survey
      cy.contains('Thank you for participating', { timeout: 5000 }).then(() => {
        cy.contains('calculating', { timeout: 1000 });
        // check that payment is correct
        end = dayjs();
        difference = end.diff(start);
        payment = (difference / 3600000) * 15;
        cy.contains('calculating', { timeout: 40000 }).should('not.exist');
        cy.get('[data-test="dollarsOwed"]')
          .invoke('text')
          .then($value => cy.log(`Observed payment ${$value}`));
        cy.get('[data-test="dollarsOwed"]')
          .invoke('text')
          .then(parseFloat)
          .should('be.closeTo', payment, 0.02);
      });

      cy.contains('Quality Feedback Survey', { timeout: 5000 });
      cy.wait(1500); // flake mitigation
      cy.get('[data-responsive-title="Disagree"]').click({
        multiple: true,
        timeout: 6000,
      });

      cy.contains('an adequate amount of time').click({ force: true });
      cy.contains('underpaid').click({ force: true });
      cy.get('[aria-label="Please rate the quality of the video call."]')
        .eq(3)
        .click({ force: true });

      cy.get('input[aria-label="If you\'d like to expand on any of your above responses or add any additional feedback, please do so here."')
        .click()
        .type(`Check_${playerKey}_text_entry`);

      cy.get('form') // submit surveyJS form
        .then($form => {
          cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
        });

      cy.contains('Finished');

      // check that the batch is done
      cy.empiricaLoginAdmin();
      cy.waitUntil(
        () => cy
          .get('body', { log: false })
          .then($body => $body.find('button:contains("Stop")').length < 1),
        { log: false },
      );

      // Check that data was entered into tajriba.json
      // path is relative to the location of `cypress.config.js`
      cy.unixRun(() => {
        cy.exec('cp ../.empirica/local/tajriba.json tmp_tajriba.txt').then(() => {
          cy.readFile('tmp_tajriba.txt')
            .should('contain', 'responses') // this puts a lot of cruft in the log, but it works
            .should('contain', 'result')
            .should('contain', 'normScore')
            .should('contain', `Check_${playerKey}_text_entry`);
        });
      });
    });
  },
);

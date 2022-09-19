import dayjs from 'dayjs';

// EyesOn_Check.js
// This test aims to test that the EyesOn Component behaves as expected
describe('eyeson_check', () => {
  let start;
  let end;
  let difference;
  let payment;

  beforeEach(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch('cypress1_control');
    cy.empiricaStartBatch('cypress1_control');
  });

  it('connects properly and receives all events', () => {
    const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
    const playerKeys = [playerKey];
    // Consent and Login
    cy.empiricaLoginPlayers({ playerKeys, enableVideoCall: true })
      .then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

    cy.log('Advance through preamble');

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

    // Video Check
    cy.log('video check');

    cy.contains('Check your webcam', { timeout: 5000 });
    cy.contains('Loading meeting room');

    cy.contains('Connecting to the Meeting Room', { timeout: 10000 });
    cy.window().then(win => {
      cy.spy(win.console, 'log').as('consoleLog');
      cy.spy(win.console, 'debug').as('debugConsole');
    });
    // Should not need this wait in the future
    cy.wait(15000);
    cy.contains('h2[data-test="loadingVideoCall"]').should('not.exist');

    cy.get('@consoleLog').should('not.be.calledWith', 'Access Key: null');

    cy.get('video', { timeout: 15000 });
    cy.get('@debugConsole', { timeout: 15000 }).should('not.be.calledWith', 'recording_update');
    cy.get('@debugConsole', { timeout: 15000 }).should('be.calledWith', 'accept');
    cy.get('@debugConsole', { timeout: 15000 }).should('be.calledWith', 'podium');

    cy.wait(3000);
    cy.get('img[class="video-icon"]').should('have.attr', 'src').should('include', 'video_icon.svg');
    cy.get('img[class="video-icon"]').parent().click();
    cy.get('@debugConsole', { timeout: 15000 }).should('be.calledWith', 'podium');
    cy.get('img[class="audio-icon"]').should('have.attr', 'src').should('include', 'audio_icon.svg');
    cy.get('img[class="audio-icon"]').parent().click();
    cy.get('@debugConsole', { timeout: 15000 }).should('be.calledWith', 'podium');

    cy.get('img[class="video-icon"]').should('have.attr', 'src').should('include', 'video_icon_muted.svg');
    cy.get('img[class="audio-icon"]').should('have.attr', 'src').should('include', 'audio_icon_muted.svg');

    cy.get('input[id="enabled"]').click();
    cy.get('input[id="see"]').click();
    cy.get('input[id="noName"]').click();
    cy.get('input[id="background"]').click();
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

    // Icebreaker
    cy.contains('you have in common', { timeout: 1000 }).should('not.exist');

    // Discussion
    cy.log('Stage: Discussion');
    cy.contains('as a group', { timeout: 15000 });
    cy.contains('Neither agree nor disagree').click();

    // not skipping out of the discussion because we need to accumulate some time to get paid...
    // cy.get('[data-test="skip"]')
    //   .click({force: true}) //click invisible button to exit discussion

    // Exit Steps
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
    cy.get('form') // submit surveyJS form
      .then($form => {
        cy.wrap($form.find('input[type="button"][value="Complete"]')).click();
      });

    // QC Survey
    cy.contains('Thank you for participating', { timeout: 5000 }).then(() => {
      // check that payment is correct
      end = dayjs();
      difference = end.diff(start);
      payment = (difference / 3600000) * 15;
      const minPayment = payment - 0.02; // include a bit of margin for small timing differences between server and test runner
      const maxPayment = payment + 0.02;
      cy.log(`time elapsed: ${difference}, payment: $${payment}`);
      // wait for callback to complete and update value
      cy.get('[data-test="dollarsOwed"]')
        .invoke('text')
        .then(parseFloat)
        .then($value => minPayment < $value && $value < maxPayment);
    });

    cy.contains('Quality Feedback Survey', { timeout: 5000 });
    cy.wait(500); // flake mitigation
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
          .should('contain', `Check_${playerKey}_text_entry`)
          // .should('contain', 'recording_url')
          .should('contain', 'videoEnabled')
          .should('contain', 'audioEnabled');
      });
    });
  });
});

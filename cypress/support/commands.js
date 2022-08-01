// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
import 'cypress-wait-until';

Cypress.Commands.add('empiricaLoginAdmin', () => {
  // if not already logged in, logs in
  // TODO: someday, do this step programmatically

  const log = Cypress.log({
    name: "empiricaLoginAdmin",
    displayName: "🐘 Login Admin",
    autoEnd: false,
  });

  cy.viewport(2000, 1000, { log: false })
  cy.visit('/admin/', { log: false });

  cy.wait(300, { log: false })
  log.snapshot("before");

  cy.get('body', { log: false })
    .then( ($body) => {
        if ( $body.find('button:contains("Sign in")').length > 0 ) {
            cy.wrap($body).get('[id="username"]').type("admin");
            cy.wrap($body).get('[id="password"]').type("testpw");  // from empirica.toml
            cy.wrap($body.find('button:contains("Sign in")')).click();
            log.set({ message: "Logging in"})
        } else {
          log.set({ message: "Already logged in"})
        }
    })
    cy.waitUntil(
      () => cy.get('body', { log: false }).then( $body => $body.find('button:contains("Sign in")').length < 1),
      {log: false}
  )

  // wait for page load
  cy.contains('Batches are groups of Games', { timeout: 5000, log: false } )
    .should('be.visible');

  log.snapshot("after");
  log.end();
})

Cypress.Commands.add('empiricaClearBatches', () => {
    // TODO: someday, do this step programmatically
    const log = Cypress.log({
        name: "empiricaClearBatches",
        displayName: "🐘 Clear Batches",
        autoEnd: false,
      });

    cy.empiricaLoginAdmin()
    log.snapshot("before");
    
    //start all existing unstarted batches
    let nStarts = 0
    cy.get('body', { log: false })
    .then( ($body) => {
        const startButtons = $body.find('button:contains("Start")')
        nStarts = startButtons.length
        if ( nStarts ) {
            cy.wrap(startButtons, {log: false}).each(
                ($button, index, $list) => {
                cy.wrap($button, {log: false}).click({ log: false })
                } 
            )
        }
    })
    cy.waitUntil(
        () => cy.get('body', { log: false }).then( $body => $body.find('button:contains("Start")').length < 1),
        {log: false}
    )
    
    //stop all existing unstarted batches
    let nStops = 0
    cy.get('body', { log: false })
    .then( ($body) => {
        const stopButtons = $body.find('button:contains("Stop")')
        nStops = stopButtons.length
        if ( nStops ) {
            cy.wrap(stopButtons, {log: false}).each(
            ($button, index, $list) => {
                cy.wrap($button, {log: false}).click({ log: false })
            } 
            )
        } 
    })
    cy.waitUntil(
        () => cy.get('body', { log: false }).then( $body => $body.find('button:contains("Stop")').length < 1),
        {log: false}
    )

    log.set({ message: "Start "+nStarts+", Stop "+nStops })
    log.snapshot("after");
    log.end();

})

Cypress.Commands.add('empiricaCreateBatch', (condition) => {
    const log = Cypress.log({
        name: "empiricaCreateBatch",
        displayName: "🐘 Create Batch",
        message: condition,
        autoEnd: false,
      });

    cy.empiricaLoginAdmin()
    log.snapshot("before");

    //enter new batch drawer
    cy.get('button', { log: false })
      .contains('New Batch', { log: false })
      .click({ log: false })

    cy.contains('Create a new Batch with Simple', { timeout: 500, log: false  } )
      .should('be.visible', { log: false });

    cy.get('select', { log: false })
      .select(condition, { log: false });

    cy.contains('game', { timeout: 500, log: false })
      .should('be.visible', { log: false }); // wait for the condition to be loaded
    cy.get('button[type="submit"]', { log: false }).click({ log: false })

    //return from new batch drawer
    cy.waitUntil(() => cy.get('form', { log: false }).should('not.be.visible', { log: false }), { log: false });
    //check that game is ready to start
    cy.get('tr', { log: false })
      .last({ log: false })
      .contains("Created", { log: false })
    cy.get('tr', { log: false })
      .last({ log: false })
      .contains(condition, { log: false })
    cy.get('tr', { log: false })
      .last({ log: false })
      .contains("Start", { log: false })

    log.snapshot("after");
    log.end(); 
})

Cypress.Commands.add('empiricaLoginPlayer', ({playerKey, enableVideoCall=false}) => {
  // if not already logged in, logs in
  // TODO: someday, do this step programmatically

  const log = Cypress.log({
    name: "empiricaLoginPlayer",
    displayName: "🐘 Login Player",
    message: playerKey,
    autoEnd: false,
  });

  cy.viewport(2000, 1000, { log: false })
  if (enableVideoCall) {
    cy.visit(`/?playerKey=${playerKey}&videoCall=true`, { log: false });
  } else {
    cy.visit(`/?playerKey=${playerKey}`, { log: false });
  }

  cy.wait(300, { log: false })
  log.snapshot("before");


  //consent
  cy.contains("consent", { timeout: 5000, log: false });
  cy.contains("you may engage in video, audio, or text chat", { log: false });  // check IRB language present
  cy.contains("We may share recordings under a confidentiality agreement", { log: false });  // check IRB language present
  cy.contains("deliberation-study@wharton.upenn.edu", { log: false });  // check contact info present
  cy.get("button", { log: false }).contains("I AGREE", { log: false }).click({ log: false });

  // Login
  cy.contains("Enter your", { timeout: 5000, log: false, matchCase: false });
  cy.get("input", { log: false }).click({ log: false }).type(playerKey, { log: false });
  cy.get("button", { log: false }).contains("Enter", { log: false }).click({ log: false });

  cy.waitUntil(
      () => cy.get('body', { log: false }).then( $body => $body.find('Enter your').length < 1),
      {log: false}
  )

  log.snapshot("after");
  log.end();
})

Cypress.Commands.add('unixExec', cmd => {
  if (Cypress.platform !== 'win32') {
    cy.exec(cmd);
  }
})

Cypress.Commands.add('unixRun', (func, alt) => {
  if (Cypress.platform !== 'win32') {
    func();
  } else if (alt) {
    alt();
  }
})

Cypress.Commands.add('empiricaLoginMultiPlayers', (playerKeys) => {
  // if not already logged in, logs in
  // TODO: someday, do this step programmatically

  const log = Cypress.log({
    name: "empiricaLoginMultiPlayers",
    displayName: "🐘 Login Players",
    message: playerKeys,
    autoEnd: false,
  });

  cy.viewport(2000, 1000, { log: false })
  let url = "/?"
  cy.visit(`/?playerKey=${playerKeys[0]}&secondaryPlayerKey=${playerKeys[1]}&multiplayer=true`, { log: false });
  cy.wait(300, { log: false })
  log.snapshot("before");


  //consent
  cy.get("[test-player-id='player1']").contains("consent", { timeout: 5000, log: false });
  cy.get("[test-player-id='player1']").contains("you may engage in video, audio, or text chat", { log: false });  // check IRB language present
  cy.get("[test-player-id='player1']").contains("We may share recordings under a confidentiality agreement", { log: false });  // check IRB language present
  cy.get("[test-player-id='player1']").contains("deliberation-study@wharton.upenn.edu", { log: false });  // check contact info present
  cy.get("[test-player-id='player1']").find("button", { log: false }).contains("I AGREE", { log: false }).click({ log: false });
  cy.scrollTo('bottom');
  cy.get("[test-player-id='player2']").find("button", { log: false }).contains("I AGREE", { log: false }).click({ log: false });

  // Login
  cy.get("[test-player-id='player1']").contains("Enter your", { timeout: 5000, log: false, matchCase: false });
  cy.get("[test-player-id='player1']").find("input[id='playerID']", { log: false }).click({ log: false }).type(playerKeys[0], { log: false });
  cy.get("[test-player-id='player1']").find("button", { log: false }).contains("Enter", { log: false }).click({ log: false });
  cy.get("[test-player-id='player2']").find("input[id='playerID']", { log: false }).click({ log: false }).type(playerKeys[1], { log: false });
  cy.get("[test-player-id='player2']").find("button", { log: false }).contains("Enter", { log: false }).click({ log: false });

  cy.waitUntil(
      () => cy.get('body', { log: false }).then( $body => $body.find('Enter your').length < 1),
      {log: false}
  )

  log.snapshot("after");
  log.end();
})
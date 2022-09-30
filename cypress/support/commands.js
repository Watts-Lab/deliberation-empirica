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
import "cypress-wait-until";

Cypress.Commands.add("empiricaLoginAdmin", () => {
  // if not already logged in, logs in
  // TODO: someday, do this step programmatically

  cy.viewport(2000, 1000, { log: false });
  cy.visit("/admin/", { log: false });

  cy.wait(300, { log: false });

  cy.get("body", { log: false }).then(($body) => {
    if ($body.find('button:contains("Sign in")').length > 0) {
      cy.wrap($body).get('[id="username"]').type("admin");
      cy.wrap($body).get('[id="password"]').type("testpw"); // from empirica.toml
      cy.wrap($body.find('button:contains("Sign in")')).click();
    }
  });

  cy.waitUntil(
    () =>
      cy
        .get("body", { log: false })
        .then(($body) => $body.find('button:contains("Sign in")').length < 1),
    { log: false }
  );

  // wait for page load
  cy.contains("Batches are groups of Games", {
    timeout: 5000,
    log: false,
  }).should("be.visible");
});

Cypress.Commands.add("empiricaClearBatches", () => {
  // TODO: someday, do this step programmatically
  // do it via the API that the admin UI itself is
  // calling
  const log = Cypress.log({
    name: "empiricaClearBatches",
    displayName: "🐘 Clear Batches",
    autoEnd: false,
  });

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  // start all existing unstarted batches
  let nStarts = 0;
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('button:contains("Start")');
    nStarts = startButtons.length;
    if (nStarts) {
      cy.wrap(startButtons, { log: false }).each(($button) => {
        cy.wrap($button, { log: false }).click({ log: false });
      });
    }
  });
  cy.waitUntil(
    () =>
      cy
        .get("body", { log: false })
        .then(($body) => $body.find('button:contains(" Start")').length < 1),
    { log: false }
  );

  // stop all existing unstarted batches
  let nStops = 0;
  cy.get("body", { log: false }).then(($body) => {
    const stopButtons = $body.find('button:contains("Stop")');
    nStops = stopButtons.length;
    if (nStops) {
      cy.wrap(stopButtons, { log: false }).each(($button) => {
        cy.wrap($button, { log: false }).click({ log: false });
        cy.on("window:confirm", () => true); // handle confirmation popup
      });
    }
  });
  cy.waitUntil(
    () =>
      cy
        .get("body", { log: false })
        .then(($body) => $body.find('button:contains("Stop")').length < 1),
    { log: false }
  );

  log.set({ message: `Start ${nStarts}, Stop ${nStops}` });
  log.snapshot("after");
  log.end();
});

Cypress.Commands.add("empiricaCreateBatch", (condition) => {
  const log = Cypress.log({
    name: "empiricaCreateBatch",
    displayName: "🐘 Create Batch",
    message: condition,
    autoEnd: false,
  });

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  // enter new batch drawer
  cy.get("button", { log: false })
    .contains("New Batch", { log: false })
    .click({ log: false });

  cy.contains("Create a new Batch with Simple", {
    timeout: 500,
    log: false,
  }).should("be.visible", { log: false });

  cy.get("select", { log: false }).select(condition, { log: false });

  // wait for the condition to be loaded before submitting
  cy.contains("game", { timeout: 500, log: false }).should("be.visible", {
    log: false,
  });
  cy.get('button[type="submit"]', { log: false }).click({ log: false });

  // return from new batch drawer
  cy.waitUntil(
    () =>
      cy.get("form", { log: false }).should("not.be.visible", { log: false }),
    { log: false }
  );
  // check that game is ready to start
  cy.get("li", { log: false, timeout: 4000 })
    .last({ log: false })
    .contains("Created", { log: false });
  cy.get("li", { log: false })
    .last({ log: false })
    .contains(condition, { log: false });
  cy.get("li", { log: false })
    .last({ log: false })
    .contains("Start", { log: false });

  log.snapshot("after");
  log.end();
});

Cypress.Commands.add("empiricaStartBatch", (condition) => {
  const log = Cypress.log({
    name: "empiricaStartBatch",
    displayName: "🐘 Start Batch",
    message: condition,
    autoEnd: false,
  });

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  // Check that there is a batch to start and it has the right condition
  cy.get("li", { log: false, timeout: 12000 })
    .contains(" Start", { log: false })
    .parentsUntil("li", { log: false })
    .contains(condition)
    .parentsUntil("li", { log: false })
    .contains("Start", { log: false })
    .click({ log: "Start Button" });

  // Check started
  cy.get("li", { log: false, timeout: 12000 })
    .contains(" Stop", { log: false })
    .parentsUntil("li", { log: false })
    .contains(condition, { log: false });

  log.snapshot("after");
  log.end();
});

Cypress.Commands.add("unixExec", (cmd) => {
  if (Cypress.platform !== "win32") {
    cy.exec(cmd);
  }
});

Cypress.Commands.add("unixRun", (func, alt) => {
  if (Cypress.platform !== "win32") {
    func();
  } else if (alt) {
    alt();
  }
});

Cypress.Commands.add(
  "empiricaLoginPlayers",
  ({ playerKeys, enableVideoCall = false }) => {
    // Logs in if not already logged in.
    // playerKeys is ideally an array. Can handle single values.
    // TODO: someday, do this step programmatically

    const log = Cypress.log({
      name: "empiricaLoginMultiPlayers",
      displayName: "🐘 Login Players",
      message: playerKeys,
      autoEnd: false,
    });

    if (!Array.isArray(playerKeys)) {
      // eslint-disable-next-line no-param-reassign
      playerKeys = Array(playerKeys);
    }

    cy.viewport(2000, 1000, { log: false });

    const urlParams = [];
    playerKeys.forEach((playerKey) => urlParams.push(`playerKey=${playerKey}`));
    let url = `/?${urlParams.join("&")}`;
    if (enableVideoCall) {
      url += "&videoCall=true";
    }
    cy.visit(url, { log: false });
    cy.wait(300, { log: false });
    log.snapshot("before");

    // consent
    playerKeys.forEach((playerKey) => {
      cy.get(`[test-player-id='${playerKey}']`, { log: false }).then(
        ($player) => {
          // Consent
          cy.wrap($player, { log: false }).contains("consent", {
            timeout: 5000,
            log: false,
          });

          // Check IRB language present
          cy.wrap($player, { log: false }).contains(
            "you may engage in video, audio, or text chat",
            { log: false }
          );
          cy.wrap($player, { log: false }).contains(
            "We may share recordings under a confidentiality agreement",
            { log: false }
          );

          // Check contact info present
          cy.wrap($player, { log: false }).contains(
            "deliberation-study@wharton.upenn.edu",
            { log: false }
          );

          // Submit
          cy.wrap($player, { log: false })
            .find("button", { log: false })
            .contains("I AGREE", { log: false })
            .click({ log: false });

          // Login
          cy.wrap($player, { log: false }).contains("Enter your", {
            timeout: 5000,
            log: false,
            matchCase: false,
          });
          cy.wrap($player, { log: false })
            .find("input", { log: false })
            .click({ log: false })
            .type(playerKey, { log: false });
          cy.wrap($player, { log: false })
            .find("button", { log: false })
            .contains("Enter", { log: false })
            .click({ log: false });
        }
      );
    });

    cy.waitUntil(
      () =>
        cy
          .get("body", { log: false })
          .then(($body) => $body.find("Enter your").length < 1),
      { log: false }
    );

    log.snapshot("after");
    log.end();
  }
);

// TODO: build this again when we have data export, instead of reading the tajriba.json file
Cypress.Commands.add("empiricaDataContains", (contents) => {
  // contents needs to be a list
  const log = Cypress.log({
    name: "empiricaDataContains",
    displayName: "🐘 Data Contains",
    message: contents,
    autoEnd: false,
  });

  log.snapshot("before");

  const notFound = [];
  cy.unixRun(() => {
    cy.exec("cp ../.empirica/local/tajriba.json tmp_tajriba.txt").then(
      () => {
        cy.readFile("tmp_tajriba.txt", {log: false}).then(($text) => {
          contents.forEach((item)=>{
            if (!$text.includes(item)){ notFound.push(item) }
          })
        })
      }
    );
  });

  cy.wrap(notFound, { timeout: 500, log: false })
    .should("have.length", 0)

  log.snapshot("after");
  log.end();
});
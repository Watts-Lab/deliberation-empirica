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
// eslint-disable-next-line import/no-extraneous-dependencies
import "cypress-iframe";

// Cypress.Commands.add("disableSameSiteCookieRestrictions", () => {
//   cy.intercept("*", (req) => {
//     req.on("response", (res) => {
//       if (!res.headers["set-cookie"]) {
//         return;
//       }

//       const disableSameSite = (headerContent) =>
//         headerContent.replace(/samesite=(lax|strict)/gi, "samesite=none");

//       if (Array.isArray(res.headers["set-cookie"])) {
//         res.headers["set-cookie"] =
//           res.headers["set-cookie"].map(disableSameSite);
//       } else {
//         res.headers["set-cookie"] = disableSameSite(res.headers["set-cookie"]);
//       }
//     });
//   });
// });

Cypress.Commands.add("empiricaLoginAdmin", () => {
  // if not already logged in, logs in
  // TODO: someday, do this step programmatically

  cy.viewport(2000, 1000, { log: false });
  cy.visit("/admin/", { log: false });

  cy.wait(300, { log: false });

  cy.get("body", { log: false }).then(($body) => {
    if ($body.find('button:contains("Sign in")').length > 0) {
      cy.log("Logging in Admin");
      cy.wrap($body).get('[id="username"]').type("admin");
      cy.wrap($body).get('[id="password"]').type("testpw"); // from empirica.toml
      cy.wrap($body.find('button:contains("Sign in")')).click();
    } else {
      cy.log("Admin already logged in");
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

  cy.wait(3000); // wait for all the batches to load one at a time.

  // start any existing unstarted batches
  let nStarts = 0;
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('[data-test="startButton"]');
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
        .then(($body) => $body.find('[data-test="startButton"]').length < 1),
    { log: false }
  );

  // stop any existing unstarted batches
  let nStops = 0;
  cy.get("body", { log: false }).then(($body) => {
    const stopButtons = $body.find('[data-test="stopButton"]');
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
        .then(($body) => $body.find('[data-test="stopButton"]').length < 1),
    { log: false }
  );
  log.set({ message: `Start ${nStarts}, Stop ${nStops}` });
  log.snapshot("after");
  log.end();
});

// Todo: Update this to allow multiple conditions in the same batch
Cypress.Commands.add("empiricaCreateBatch", (condition) => {
  const log = Cypress.log({
    name: "empiricaCreateBatch",
    displayName: "🐘 Create Batch",
    message: condition,
    autoEnd: false,
  });

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  // count the number of existing batches
  let nStartsBefore;
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('[data-test="startButton"]');
    nStartsBefore = startButtons.length;
  });

  // enter new batch drawer
  cy.get('button[data-test="newBatchButton"]', { log: false }).click({
    log: false,
  });

  cy.contains("Create a new Batch with Simple", {
    timeout: 500,
    log: false,
  }).should("be.visible", { log: false });

  cy.get('select[data-test="treatmentSelect"]', { log: false }).select(
    condition,
    { log: false }
  );

  // wait for the condition to be loaded before submitting
  cy.get('[data-test="gameCountInput"]').should("exist", {
    log: false,
  });

  cy.get('[data-test="createBatchButton"]', { log: false }).click({
    log: false,
  });

  // return from new batch drawer
  cy.waitUntil(
    () =>
      cy.get("form", { log: false }).should("not.be.visible", { log: false }),
    { log: false }
  );

  // check that game is ready to start
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('[data-test="startButton"]');
    expect(startButtons.length).to.be.greaterThan(nStartsBefore);
  });

  log.snapshot("after");
  log.end();
});

// Todo: Update this to allow multiple conditions in the same batch
Cypress.Commands.add("empiricaCreateCustomBatch", (configJson, kwargs) => {
  const log = Cypress.log({
    name: "empiricaCreateBatch",
    displayName: "🐘 Create Batch",
    message: configJson,
    autoEnd: false,
  });
  const skipReadyCheck = kwargs?.skipReadyCheck || false;

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  // count the number of existing batches
  let nStartsBefore;
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('[data-test="startButton"]');
    nStartsBefore = startButtons.length;
  });

  // enter new batch drawer
  cy.get('button[data-test="newBatchButton"]', { log: false }).click({
    log: false,
  });

  cy.get('button[data-test="customAssignmentButton"]', { log: false }).click({
    log: false,
  });

  cy.get('textarea[data-test="configurationTextArea"]', { log: false })
    .type("{selectAll}") // overwrite existing contents
    .type(configJson, { delay: 0, parseSpecialCharSequences: false });

  cy.get('[data-test="createBatchButton"]', { log: false }).click({
    log: false,
  });

  // return from new batch drawer
  cy.waitUntil(
    () =>
      cy
        .get("form", { log: false, timeout: 6000 })
        .should("not.be.visible", { log: false }),
    { log: false }
  );

  if (!skipReadyCheck) {
    // check that game is ready to start
    cy.wait(3000);
    cy.get("body", { log: false }).then(($body) => {
      const startButtons = $body.find('[data-test="startButton"]');
      expect(startButtons.length).to.be.greaterThan(nStartsBefore);
    });
  }

  log.snapshot("after");
  log.end();
});

Cypress.Commands.add("empiricaStartBatch", (nBatches) => {
  const log = Cypress.log({
    name: "empiricaStartBatch",
    displayName: "🐘 Start Batch",
    message: nBatches,
    autoEnd: false,
  });

  cy.empiricaLoginAdmin();
  log.snapshot("before");

  cy.waitUntil(
    () =>
      cy
        .get("body", { log: false })
        .then(
          ($body) => $body.find(`[data-test="startButton"]`).length === nBatches
        ),
    { log: false }
  );

  let nStarts = 0;
  cy.get("body", { log: false }).then(($body) => {
    const startButtons = $body.find('[data-test="startButton"]');
    nStarts = startButtons.length;
    if (nStarts) {
      cy.wrap(startButtons, { log: false }).each(($button) => {
        cy.wrap($button, { log: false }).click({ log: false });
      });
    }
  });

  cy.get(`[data-test="stopButton"]`).its("length").should("eq", nBatches);

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
    cy.exec(
      'find ../ -name "tajriba.json" -exec cp {} "tmp_tajriba.txt" ";"'
    ).then(() => {
      cy.readFile("tmp_tajriba.txt", { log: false }).then(($text) => {
        contents.forEach((item) => {
          if (!$text.includes(item)) {
            notFound.push(item);
            cy.log(`Didn't find: ${item}`);
          }
        });
      });
    });
  });

  cy.wrap(notFound, { timeout: 500, log: false }).should("have.length", 0);

  log.snapshot("after");
  log.end();
});

// TODO: build this again when we have data export, instead of reading the tajriba.json file
Cypress.Commands.add(
  "empiricaPaymentFileContains",
  ({ paymentFilename, contents }) => {
    // contents needs to be a list
    const log = Cypress.log({
      name: "empiricaPaymentFileContains",
      displayName: `🐘 Payment File ${paymentFilename} Contains`,
      message: contents,
      autoEnd: false,
    });

    log.snapshot("before");

    const notFound = [];
    cy.unixRun(() => {
      cy.exec(
        `find ../ -name "${paymentFilename}" -exec cp {} "payfile.txt" ";"`
      ).then(() => {
        cy.readFile("payfile.txt", { log: false }).then(($text) => {
          contents.forEach((item) => {
            if (!$text.includes(item)) {
              notFound.push(item);
              cy.log(`Didn't find: ${item}`);
            }
          });
        });
      });
    });

    cy.wrap(notFound, { timeout: 500, log: false }).should("have.length", 0);

    log.snapshot("after");
    log.end();
  }
);

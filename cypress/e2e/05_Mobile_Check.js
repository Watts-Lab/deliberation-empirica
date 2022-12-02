// Mobile_Check.js
// This test aims to test what a user will encounter if they
// attempt to complete the experiment on a mobile device

const configJson = `{
  "treatmentFile": "treatments.test.yaml",
  "dispatchWait": 3,
  "useTreatments": [
    "cypress1_simple"
  ]
}`;

describe(
  "Disallow mobile connections",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();
      cy.empiricaCreateCustomBatch(configJson);
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("redirects to mobile error screen", () => {
      const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;
      const playerKeys = [playerKey];
      cy.empiricaLoginPlayers({ playerKeys });
      cy.viewport("iphone-x");

      cy.visit(`http://localhost:3000/?playerKey=${playerKey}`, {
        onBeforeLoad: (win) => {
          Object.defineProperty(win.navigator, "userAgent", {
            value:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1",
          });
        },
      });

      cy.contains("ERROR: Mobile Device Detected");
    });
  }
);

// No_Experiments_Available.js
// This tests that the user is not presented with a game option
// if there are no games available.

describe(
  "No experiments available",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      cy.empiricaClearBatches();
    });

    it("has no games available", () => {
      const playerKey = `test_${Math.floor(Math.random() * 1e13)}`;

      cy.visit(`http://localhost:3000/?playerKey=${playerKey}`);

      cy.contains("There are no studies available");
      cy.wait(5000);
      cy.contains("consent").should("not.exist");
      cy.contains("I AGREE").should("not.exist");
    });
  }
);

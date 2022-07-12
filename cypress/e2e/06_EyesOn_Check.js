// EyesOn_Check.js
// This test aims to test that the EyesOn Component behaves as expected
describe("eyeson_check", () => {
  const playerKey = "test_" + Math.floor(Math.random() * 1e13);

  before(() => {
    cy.empiricaClearBatches();
    cy.empiricaCreateBatch("cypress1vid");

    //Start batch
    cy.get("tr", { log: false })
      .last({ log: false })
      .contains("Start", { log: false })
      .click({ log: "Start Button" });
    //Check started
    cy.waitUntil(() =>
      cy
        .get("tr")
        .last()
        .then(($tr) => $tr.find('button:contains("Stop")').length == 1)
    );
  });

  it("connects properly and receives all events", () => {
    cy.empiricaLoginPlayer(playerKey)
      .then(() => {
        start = dayjs();
        cy.log(`start: ${start}`);
      });

    cy.log("Advance through preamble");

    //Instructions
    cy.contains("About this study:", { timeout: 5000 });

    // Understanding check
    cy.contains(
      "Answer the following questions to verify your understanding of the instructions.",
      { timeout: 5000 }
    );
    cy.get("label")
      .contains(
        "Partcipate in and answer questions about a discussion with others"
      )
      .click();
    cy.get("label").contains("True").click();
    cy.get("label")
      .contains("To be anonmously published in academic venues")
      .click();
    cy.get("label")
      .contains(
        "Our research team and select researchers under confidentiality agreements"
      )
      .click();
    cy.get("label").contains("15-35 minutes").click();
    cy.get("button").contains("Next").click();

    // Name Input
    cy.contains("please enter your first name", { timeout: 5000 });
    cy.get("input")
      .click()
      .type(playerKey + "_name");
    cy.get("button").contains("Next").click();

    // Video Check
    cy.window().then(win => {
      cy.wrap(cy.spy(win.console, 'log')).as('spyLog');
    })
    cy.contains("Check your webcam", { timeout: 5000 });
    cy.get('[data-test="enableIframe"]').check({force: true})
    cy.contains("Preparing the Meeting Room...", { timeout: 3000 });
    cy.get('button["class=join-button"[', { timeout: 3000 });
    cy.contains("video", { timeout: 15000 });
    cy.get('@spyLog').should('be.calledWith', 'accept');
    cy.get('@spyLog').should('be.calledWith', 'recording_update');
    cy.get('@spyLog').should('be.calledWith', 'podium');
  });
});

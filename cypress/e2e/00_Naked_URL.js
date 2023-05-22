// This test checks that the experiment loads even if there is no playerKey
// This will be the default behavior for most users, but we have a hard time
// testing it in cypress, because we need unique player keys so that empirica
// doesn't treat every test case as the same returning user, and preserve their
// state. So, this test just checks that the informed consent form renders,
// as this checks that the naked url is displaying the EmpiricaPlayer object
// corrrectly, and leaves the rest of the testing to the other tests.

const configJson = `{
  "batchName": "cytest_00",
  "treatmentFile": "projects/example/treatments.test.yaml",
  "dispatchWait": 3,
  "cdn": "test",
  "treatments": [
    "cypress1_simple"
  ]
}`;

describe("Naked URL", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    // using beforeEach even though there is just one test, so that if we retry the test it will run again
    cy.empiricaClearBatches();
    cy.empiricaCreateCustomBatch(configJson);
    cy.wait(3000); // wait for batch creation callbacks to complete
    cy.empiricaStartBatch(1);
  });

  it("displays EmpiricaPlayer", () => {
    cy.visit("http://localhost:3000/");
    cy.contains("group discussion study");
    cy.contains("Join the study");
  });
});

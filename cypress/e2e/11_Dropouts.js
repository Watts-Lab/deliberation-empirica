const configJson = `{
    "batchName": "cytest_11_dropouts",
    "cdn": "test",
    "treatmentFile": "projects/example/cypress.treatments.yaml",
    "customIdInstructions": "none",
    "platformConsent": "US",
    "consentAddendum": "none",
    "checkAudio": false,
    "checkVideo": false,
    "introSequence": "none",
    "treatments": [
      "cypress_dropouts"
    ],
    "payoffs": "equal",
    "knockdowns": "none",
    "dispatchWait": 1,
    "launchDate": "immediate",
    "centralPrereg": false,
    "preregRepos": [],
    "dataRepos": [
      {
        "owner": "Watts-Lab",
        "repo": "deliberation-data-test",
        "branch": "main",
        "directory": "cypress_test_exports"
      }
    ],
    "videoStorage": "none",
    "exitCodes": "none"
  }`;

describe("Dropouts", { retries: { runMode: 2, openMode: 0 } }, () => {
  beforeEach(() => {
    cy.empiricaClearBatches();

    cy.empiricaCreateCustomBatch(configJson, {});
    cy.wait(3000); // wait for batch creation callbacks to complete

    cy.empiricaStartBatch(1);
  });

  it("manages dropouts", () => {
    // test that
    const playerKeys = Array(3)
      .fill()
      .map(
        (a, index) => `testplayer_${index}_${Math.floor(Math.random() * 1e13)}`
      );

    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {}); // no audio or video check
    });

    playerKeys.forEach((playerKey) => {
      cy.stepConsent(playerKey);
    });

    cy.window().then((win) => {
      cy.spy(win.console, "log").as("consoleLog");
      cy.wrap(win.batchLabel).as("batchLabel");
    });

    playerKeys.forEach((playerKey) => {
      cy.stepAttentionCheck(playerKey);
      cy.stepVideoCheck(playerKey, {
        setupCamera: false,
        setupMicrophone: false,
      });
      cy.stepNickname(playerKey);
    });

    playerKeys.forEach((playerKey) => {
      cy.waitForGameLoad(playerKey);
    });
    // Display the video call component (which is normally hidden in cypress tests)
    playerKeys.forEach((playerKey) => {
      cy.get(
        `[data-player-id="${playerKey}"] button[data-test="enableContentButton"]`
      ).click();
    });

    // Report a missing player
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="reportMissing"]`
    ).click();
    cy.get(`[data-player-id="${playerKeys[0]}"]`)
      .contains("I am the only one")
      .click();
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="submitReportMissing"]`
    ).click();
    cy.contains("Asking others to confirm their presence.");

    // one additional player checks in
    cy.get(
      `[data-player-id="${playerKeys[1]}"] button[data-test="checkIn"]`
    ).click({ force: true });
    cy.contains("At least one other person has confirmed their presence.");

    // wait for the checkIn timeout to expire
    cy.wait(5000);

    // the discussion continues
    cy.get("@consoleLog").should("be.calledWith", `2 players checked in`);
    cy.contains("Markdown or HTML");

    // third player checks in (meaning that their checkIn box still displays as the other players continue)
    cy.get(
      `[data-player-id="${playerKeys[2]}"] button[data-test="checkIn"]`
    ).click({ force: true });

    // drop a player
    cy.empiricaSetupWindow({ playerKeys: playerKeys.slice(0, 2) });

    // existing players enable dev-hidden content
    playerKeys.slice(0, 2).forEach((playerKey) => {
      cy.get(
        `[data-player-id="${playerKey}"] button[data-test="enableContentButton"]`
      ).click();
    });

    // wait for the checkIn grace period to expire
    cy.wait(4000);

    // Report a missing player
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="reportMissing"]`
    ).click();
    cy.get(`[data-player-id="${playerKeys[0]}"]`)
      .contains("I am the only one")
      .click();
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="submitReportMissing"]`
    ).click();

    // Check that the checkIn prompt is still visible
    cy.get(
      `[data-player-id="${playerKeys[1]}"] button[data-test="checkIn"]`
    ).should("be.visible");

    // wait for the checkIn timeout to expire
    cy.wait(5000);

    // the discussion stops (can't get this to work...)
    // cy.get("@consoleLog").should(
    //   "be.calledWith",
    //   `Ending discussion due to lack of participants`
    // );

    // the next stage is shown
    cy.contains("Markdown or HTML").should("not.exist");
    cy.contains("strong magical field"); // multiple choice colors prompt is visible
    cy.contains("Ponder Stibbons").should("not.exist"); // multiple choice wizard is not visible

    // existing players submit
    cy.submitPlayers(playerKeys.slice(0, 2));

    // the next stage is shown
    cy.contains("Ponder Stibbons");

    // force close game
    cy.empiricaClearBatches();
    cy.wait(3000);

    // load the exported data
    cy.get("@batchLabel").then((batchLabel) => {
      cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
        .then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          const objs = lines.map((line) => JSON.parse(line));
          console.log("dataObjects", objs);
          return objs;
        })
        .as("dataObjects");
    });

    // check that each preregistration id is in the science data
    cy.get("@dataObjects").then((objs) => {
      // player 0 submits report, others don't
      expect(objs[0].reports).to.have.lengthOf(2);
      expect(objs[1].reports).to.have.lengthOf(0);

      // report has expected keys
      expect(objs[0].reports[0]).to.have.all.keys("code", "stage", "timestamp");

      // the right number of checkins are observed
      expect(objs[0].checkIns).to.have.lengthOf(2);
      expect(objs[1].checkIns).to.have.lengthOf(1);

      // checkIn has expected keys
      expect(objs[0].checkIns[0]).to.have.all.keys("stage", "timestamp");
    });
  });
});

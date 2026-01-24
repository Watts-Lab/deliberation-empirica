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

  it("clears timeout timer on stage end", () => {
    // Regression test for issue #1109: Missing participant timeout doesn't clear on stage end
    // This tests that a timeout timer started from a check-in request in stage 1
    // does NOT fire and prematurely end stage 2 when the stage transitions normally.
    const playerKeys = Array(3)
      .fill()
      .map(
        (a, index) => `testplayer_timeout_${index}_${Math.floor(Math.random() * 1e13)}`
      );

    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {}); // no audio or video check
    });

    playerKeys.forEach((playerKey) => {
      cy.stepConsent(playerKey);
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

    // Verify we're on stage 1 (discussion stage with "Markdown or HTML" prompt)
    cy.contains("Markdown or HTML");

    // Report a missing player, which starts a 5-second timeout timer
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

    // DON'T have players check in - we want to keep the timer pending
    // The reporter (player 0) auto-checks in when submitting the report
    // With only 1 check-in, passedCheckIn() returns false (needs >= 2)
    // This means the timer is NOT cleared and will fire in 5 seconds

    // Submit all players via the submit button (now available in stage 1)
    // Use force:true to click through the modal overlay
    playerKeys.forEach((playerKey) => {
      cy.get(`[data-player-id="${playerKey}"] [data-test="submitButton"]`)
        .click({ force: true });
    });

    // Verify we've moved to stage 2 (TestDisplay00 is always visible on stage 2)
    cy.contains("TestDisplay00");

    // Now wait for the original timeout period (5 seconds) to elapse
    // If the timer wasn't cleared, it would fire here and set discussionFailed=true,
    // which would cause the stage to submit and show unexpected content
    cy.wait(6000);

    // Verify we're STILL on stage 2 - the timeout did NOT prematurely end the stage
    // If the bug exists, the stage would have been force-submitted and we'd see stage 3 content
    cy.contains("TestDisplay00").should("exist");

    // Clean up
    cy.empiricaClearBatches();
  });

  it("hides report missing button when showReportMissing is false", () => {
    // Test uses the cypress_dropouts_no_report_button treatment
    // which has showReportMissing: false in the discussion config
    const configJsonNoButton = `{
      "batchName": "cytest_11_no_report_button",
      "cdn": "test",
      "treatmentFile": "projects/example/cypress.treatments.yaml",
      "customIdInstructions": "none",
      "platformConsent": "US",
      "consentAddendum": "none",
      "checkAudio": false,
      "checkVideo": false,
      "introSequence": "none",
      "treatments": [
        "cypress_dropouts_no_report_button"
      ],
      "payoffs": "equal",
      "knockdowns": "none",
      "dispatchWait": 1,
      "launchDate": "immediate",
      "centralPrereg": false,
      "preregRepos": [],
      "dataRepos": [],
      "videoStorage": "none",
      "exitCodes": "none"
    }`;

    cy.empiricaClearBatches();
    cy.empiricaCreateCustomBatch(configJsonNoButton, {});
    cy.wait(3000);
    cy.empiricaStartBatch(1);

    const playerKeys = Array(2)
      .fill()
      .map(
        (a, index) => `testplayer_noreport_${index}_${Math.floor(Math.random() * 1e13)}`
      );

    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {});
    });

    playerKeys.forEach((playerKey) => {
      cy.stepConsent(playerKey);
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

    // Display the video call component
    playerKeys.forEach((playerKey) => {
      cy.get(
        `[data-player-id="${playerKey}"] button[data-test="enableContentButton"]`
      ).click();
    });

    // Verify we're on the discussion stage
    cy.contains("Markdown or HTML");

    // Verify that other tray buttons exist (video call is working)
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="toggleVideo"]`
    ).should("exist");
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="toggleAudio"]`
    ).should("exist");

    // Verify that the reportMissing button does NOT exist
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="reportMissing"]`
    ).should("not.exist");

    // Clean up
    cy.empiricaClearBatches();
  });

  it("shows mic level indicator when unmuted and hides when muted", () => {
    // Test for issue #1114: Audio level indicator in microphone button
    const playerKeys = Array(2)
      .fill()
      .map(
        (a, index) => `testplayer_miclevel_${index}_${Math.floor(Math.random() * 1e13)}`
      );

    cy.empiricaSetupWindow({ playerKeys });
    cy.interceptIpApis();

    playerKeys.forEach((playerKey) => {
      cy.stepIntro(playerKey, {});
    });

    playerKeys.forEach((playerKey) => {
      cy.stepConsent(playerKey);
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

    // Display the video call component
    playerKeys.forEach((playerKey) => {
      cy.get(
        `[data-player-id="${playerKey}"] button[data-test="enableContentButton"]`
      ).click();
    });

    // Verify we're on the discussion stage
    cy.contains("Markdown or HTML");

    // Verify the mic level indicator exists when unmuted (default state)
    cy.get(
      `[data-player-id="${playerKeys[0]}"] [data-test="micLevelIndicator"]`
    ).should("exist");

    // Click the toggle audio button to mute
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="toggleAudio"]`
    ).click();

    // Verify the mic level indicator does NOT exist when muted
    cy.get(
      `[data-player-id="${playerKeys[0]}"] [data-test="micLevelIndicator"]`
    ).should("not.exist");

    // Click the toggle audio button again to unmute
    cy.get(
      `[data-player-id="${playerKeys[0]}"] button[data-test="toggleAudio"]`
    ).click();

    // Verify the mic level indicator exists again when unmuted
    cy.get(
      `[data-player-id="${playerKeys[0]}"] [data-test="micLevelIndicator"]`
    ).should("exist");

    // Clean up
    cy.empiricaClearBatches();
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

import dayjs from "dayjs";

describe(
  "Multiplayer Normal Paths Omnibus",
  { retries: { runMode: 2, openMode: 0 } },
  () => {
    beforeEach(() => {
      // using beforeEach even though there is just one test, so that if we retry the test it will run again
      cy.empiricaClearBatches();
      cy.exec("truncate -s 0 ../data/empirica.log"); // clear the server log file

      const configJson = `{
        "batchName": "cytest_01",
        "treatmentFile": "projects/example/treatments.test.yaml",
        "launchDate": "${dayjs()
          .add(25, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "dispatchWait": 1,
        "introSequence": "cypress_intro",
        "consentAddendum": "projects/example/consentAddendum.md",
        "cdn": "test",
        "treatments": [
          "cypress_omnibus"
        ],
        "videoStorageLocation": "deliberation-lab-recordings-test",
        "awsRegion": "us-east-1",
        "preregister": true,
        "dataRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "cypress_test_exports"
          },
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "cypress_test_exports2"
          }
        ],
        "preregRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "preregistration"
          }
        ]
      }`;

      cy.empiricaCreateCustomBatch(configJson, {});
      cy.wait(3000); // wait for batch creation callbacks to complete
      cy.empiricaStartBatch(1);
    });

    it("walks properly", () => {
      Cypress.Cookies.debug(true);

      // The third player here doesn't complete the intro steps,
      // so that we can test that the other players can still complete the game
      const playerKeys = [
        `testplayer_A_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_B_${Math.floor(Math.random() * 1e13)}`,
        `testplayer_Noncompleting_${Math.floor(Math.random() * 1e13)}`,
      ];

      const hitId = "cypressTestHIT";
      cy.empiricaSetupWindow({ playerKeys, hitId });

      // Affirmations and Login
      cy.stepIntro(playerKeys[0], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[1], { checks: ["webcam", "mic", "headphones"] });
      cy.stepIntro(playerKeys[2], { checks: ["webcam", "mic", "headphones"] });

      // Consent
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "addendum to the standard consent"
      );
      cy.stepConsent(playerKeys[0]);
      cy.stepConsent(playerKeys[1]);
      cy.stepConsent(playerKeys[2]);

      cy.window().then((win) => {
        cy.spy(win.console, "log").as("consoleLog");
        cy.wrap(win.batchLabel).as("batchLabel");
      });

      // Attention Check
      cy.stepAttentionCheck(playerKeys[0]);
      cy.stepAttentionCheck(playerKeys[1]);
      cy.stepAttentionCheck(playerKeys[2]);

      // Video check
      cy.stepVideoCheck(playerKeys[0], { headphonesRequired: true });
      cy.stepVideoCheck(playerKeys[1], { headphonesRequired: true });
      cy.stepVideoCheck(playerKeys[2], { headphonesRequired: true });

      // Nickname
      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);
      cy.stepNickname(playerKeys[2]); // noncompleting stops here

      // Political affiliation survey
      cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[1]);

      // Todo: Check that we get a warning if we try to leave the page
      // cy.on("window:confirm", (text) => {
      //   console.log("window.confirm", text);
      //   return false;
      // });

      // cy.visit("http://localhost:3000/admin");

      // Check that the order of multiple choice answers is randomized
      const originalOrder = [
        "Ponder Stibbons",
        "Albus Dumbledore",
        "Harry Dresden",
        "Eskarina Smith",
        "Ged/Sparrowhawk",
        "Gandalf",
        "Dr. Strange",
        "Merlin",
        "Thomas Edison",
      ];
      const actualOrder = [];
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[type="radio"]`
      ).each(($el) => {
        cy.wrap($el)
          .invoke("attr", "value")
          .then((curr) => {
            actualOrder.push(curr);
          });
      });

      const symmetricDifference = (arrayA, arrayB) => {
        const setA = new Set(arrayA);
        const setB = new Set(arrayB);
        const diffA = Array.from(setA).filter((x) => !setB.has(x));
        const diffB = Array.from(setB).filter((x) => !setA.has(x));
        return [...diffA, ...diffB];
      };

      cy.wrap(actualOrder).then((actualOrder) => {
        const actualSet = new Set(actualOrder); // convert to set to allow comparison without order
        const originalSet = new Set(originalOrder);
        const symDiff = symmetricDifference(actualOrder, originalOrder);
        if (symDiff.length > 0) {
          console.log("Expect set:", actualSet);
          console.log("to equal set:", originalSet);
          console.log("symmetricDifference", symDiff);
        }
        expect(actualSet).to.deep.equal(originalSet); // check that all expected questions are present
        expect(actualOrder).to.have.length(originalOrder.length); // check that there are no extra questions
        expect(actualOrder).not.to.deep.equal(originalOrder); // check that the order is randomized
      });

      // Test Prompts in Intro
      cy.playerCanNotSee(playerKeys[0], "TestDisplay00");
      cy.playerCanNotSee(playerKeys[1], "TestDisplay00");

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      cy.get(
        `[test-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/openResponse.md"]`
      ).type(`Intro Open Response for ${playerKeys[0]}`, { force: true });

      cy.get(
        `[test-player-id="${playerKeys[1]}"] textarea[data-test="projects/example/openResponse.md"]`
      ).type(`Intro Open Response for ${playerKeys[1]}`, { force: true });

      cy.playerCanSee(playerKeys[0], "TestDisplay00");
      cy.playerCanNotSee(playerKeys[1], "TestDisplay00");

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // Check countdown
      cy.stepCountdown(playerKeys[0]);

      // Check Lobby
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Waiting");

      // Complete second player to trigger dispatch
      cy.stepCountdown(playerKeys[1]);

      cy.waitForGameLoad(playerKeys[0]);
      cy.waitForGameLoad(playerKeys[1]);

      // ================= Game =================

      // Get player positions
      const playerKeyByPosition = {}; //
      cy.get(`input[data-test="playerPosition"]`)
        .each(($el, index) => {
          cy.wrap($el)
            .invoke("val")
            .then(($val) => {
              if ($val !== "") {
                playerKeyByPosition[$val] = playerKeys[index];
              }
            });
        })
        .then(() => {
          cy.wrap(playerKeyByPosition).as("playerKeyByPosition");
        });

      cy.get("@playerKeyByPosition").then((pos) => {
        expect(Object.keys(pos)).to.have.length(2);
        cy.log("playerKeyByPosition", pos);
      });

      // --------- Test Markdown Table ------------

      cy.get("@consoleLog").should(
        "be.calledWith",
        "Stage 0: Test Markdown Table"
      );

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Markdown Table");
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "th",
        "Header Left Column"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "td",
        "Body Row 3 Right"
      );

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ----------  Test Individual and shared prompt editing -----------
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Stage 1: Test simultaneous prompt editing"
      );

      // Test radio button order is preserved
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceNumbers.md"] label[data-test="option"]`
      ).then((items) => {
        expect(items[0]).to.contain.text("0");
        expect(items[1]).to.contain.text("0.5");
        expect(items[2]).to.contain.text("3");
        expect(items[3]).to.contain.text("4");
        expect(items[4]).to.contain.text("5.5");
        expect(items[5]).to.contain.text("six");
        expect(items[6]).to.contain.text("7");
        expect(items[7]).to.contain.text("8");
      });

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        // individually select the same response
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
        ).click();
        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
        ).click();

        // Select same response as a group
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
        ).click(); // select option 1 on player 0

        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
        ).should("be.checked"); // check that player 1 updates to match shared selection

        // Individually select different responses
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Octarine"]`
        ).click();

        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Octarine"]`
        ).should("not.be.checked"); // check that player 1 does not update, as this is an individual prompt

        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Plaid"]`
        ).click();

        // Individually submit different open responses of different lengths
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] textarea[data-test="projects/example/openResponse.md"]`
        ).type(`short`, { force: true });

        cy.get(
          `[test-player-id="${keyByPosition[1]}"] textarea[data-test="projects/example/openResponse.md"]`
        ).type(
          `This is an extremely long response with lots of words and letters and punctuation and suchlike, so as to demonstrate long texts.`,
          { force: true }
        );
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // -------- Test Conditional Renders --------
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Stage 2: Test Conditional Renders"
      );
      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        // Test displays at the beginning
        cy.playerCanSee(keyByPosition[0], "TestDisplay00");
        cy.playerCanSee(keyByPosition[1], "TestDisplay00");

        // Test hidden at the beginning
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay99");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay99");

        // Test unconditinal render
        console.log("keyByPosition", keyByPosition[0], keyByPosition[1]);
        cy.playerCanSee(keyByPosition[0], "TestDisplay01");
        cy.playerCanSee(keyByPosition[1], "TestDisplay01");

        // Test showToPosition
        cy.playerCanSee(keyByPosition[0], "TestDisplay02");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay02");

        // Test hideFromPosition
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay03");
        cy.playerCanSee(keyByPosition[1], "TestDisplay03");

        // Test response equal
        cy.playerCanSee(keyByPosition[0], "TestDisplay04");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay04");

        // Test response not equal
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay05");
        cy.playerCanSee(keyByPosition[1], "TestDisplay05");

        // Test string length at most
        cy.playerCanSee(keyByPosition[0], "TestDisplay06");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay06");

        // Test string length at least
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay07");
        cy.playerCanSee(keyByPosition[1], "TestDisplay07");

        // Test string does not include
        cy.playerCanSee(keyByPosition[0], "TestDisplay08");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay08");

        // Test string includes
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay09");
        cy.playerCanSee(keyByPosition[1], "TestDisplay09");

        // Test position shared
        cy.playerCanSee(keyByPosition[0], "TestDisplay10");
        cy.playerCanSee(keyByPosition[1], "TestDisplay10");

        // Test position "shared" failure
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay11");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay11");

        // Test position "all" success
        cy.playerCanSee(keyByPosition[0], "TestDisplay12");
        cy.playerCanSee(keyByPosition[1], "TestDisplay12");

        // Test position "all" failure
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay13");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay13");

        // Test position number success
        cy.playerCanSee(keyByPosition[0], "TestDisplay14");
        cy.playerCanSee(keyByPosition[1], "TestDisplay14");

        // Test position number failure
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay15");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay15");

        // Test one of list
        cy.playerCanSee(keyByPosition[0], "TestDisplay16");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay16");

        // Test not one of list
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay17");
        cy.playerCanSee(keyByPosition[1], "TestDisplay17");

        // Test regex match
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay18");
        cy.playerCanSee(keyByPosition[1], "TestDisplay18");

        // Test regex not match
        cy.playerCanSee(keyByPosition[0], "TestDisplay19");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay19");

        // Test multiple conditions
        cy.playerCanSee(keyByPosition[0], "TestDisplay20");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay20");

        // Test response exists
        cy.playerCanSee(keyByPosition[0], "TestDisplay21");
        cy.playerCanSee(keyByPosition[1], "TestDisplay21");

        // Test response exists hides when prompt not answered
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay22");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay22");

        // Test response notExists hides when prompt answered
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay23");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay23");

        // Test response notExists displays when prompt not answered
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay24");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay24");

        cy.wait(4500);

        // Test hidden at the end
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay00");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay00");

        // Test displays at the end
        cy.playerCanSee(keyByPosition[0], "TestDisplay99");
        cy.playerCanSee(keyByPosition[1], "TestDisplay99");
      });

      // Test that the first player to submit sees a "please wait" while waiting for the other
      cy.submitPlayers([playerKeys[0]]); // submit one player
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other participant"
      );
      cy.submitPlayers([playerKeys[1]]); // submit other player

      // ------------ example survey --------------
      cy.get("@consoleLog").should("be.calledWith", "Stage 3: Survey Library");
      cy.stepExampleSurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[1]);

      // Watch training video
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 4: Training Video"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please take a moment"
      );
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWithMatch",
        /Playing video from/
      );

      cy.stepWatchTraining(playerKeys[0]);
      cy.stepWatchTraining(playerKeys[1]);

      // ----------- Test display component by position ------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 5: Test displays earlier submission by position"
      );

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] [data-test="display_individualOpenResponse"]`
        ).contains("punctuation and suchlike");
        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="display_individualOpenResponse"]`
        ).contains("short");
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ----------- Test display component for current player ------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 6: Test displays earlier submission of current player"
      );

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        cy.get(
          `[test-player-id="${keyByPosition[0]}"] [data-test="display_individualOpenResponse"]`
        ).contains("short");
        cy.get(
          `[test-player-id="${keyByPosition[1]}"] [data-test="display_individualOpenResponse"]`
        ).contains("punctuation and suchlike");
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ---------- Test list sorter ------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 7: Test List Sorter"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Please drag the following list"
      ); // stage advance wait
      cy.get(`[test-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`, {
        timeout: 6000,
      }).contains("Harry Potter");
      cy.get(`[test-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`)
        .focus()
        .type(" ") // space bar says "going to move this item"
        .type("{downArrow}") // move down one
        .type(" ") // stop moving the item
        .blur();
      cy.wait(1000);
      cy.get(
        `[test-player-id="${playerKeys[0]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");
      cy.get(
        `[test-player-id="${playerKeys[1]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ---------------- Test Discussion ----------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Stage 8: Discussion"
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "strong magical field",
        { timeout: 7000 }
      );
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "the following wizards",
        { timeout: 10000 }
      );

      cy.get("@consoleLog").should("be.calledWith", "Playing Audio");

      // Exit steps
      cy.wait(5000);

      // Complete player 1
      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "Help us improve",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains("Finished");

      // wait for data to be saved (should be fast)
      cy.wait(3000);

      // get preregistration data
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(
          `../data/preregistrationData/batch_${batchLabel}.preregistration.jsonl`
        )
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            console.log("preregistrationObjects", objs);
            return objs;
          })
          .as("preregistrationObjects");
      });

      // get science data
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/scienceData/batch_${batchLabel}.jsonl`)
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            return objs;
          })
          .as("dataObjects");
      });

      // check that player 1's data is exported even though player 2 is not finished
      cy.get("@dataObjects").then((dataObjects) => {
        expect(dataObjects).to.have.length(1);
      });

      // force close player 2
      cy.empiricaClearBatches();
      cy.wait(3000);

      // load the data again
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/scienceData/batch_${batchLabel}.jsonl`)
          .then((txt) => {
            const lines = txt.split("\n").filter((line) => line.length > 0);
            const objs = lines.map((line) => JSON.parse(line));
            console.log("dataObjects", objs);
            return objs;
          })
          .as("dataObjects");
      });

      // check that each preregistration id is in the science data
      cy.get("@dataObjects").then((dataObjects) => {
        cy.get("@preregistrationObjects").then((preregistrationObjects) => {
          const dataSampleIds = dataObjects.map((dataObj) => dataObj.sampleId);
          const preregSampleIds = preregistrationObjects.map(
            (preregObj) => preregObj.sampleId
          );
          expect(dataSampleIds).to.include.members(preregSampleIds);
        });
      });

      cy.get("@dataObjects").then((objs) => {
        // check that prompt data is included for both individual and group prompts
        const promptKeys = Object.keys(objs[0].prompts);
        expect(promptKeys).to.include.members([
          "prompt_listSorterPrompt",
          "prompt_individualOpenResponse",
          "prompt_introOpenResponse",
        ]);

        // check that prompt correctly saves open response data
        expect(objs[0].prompts.prompt_introOpenResponse.value).to.contain(
          "testplayer_A"
        );
        expect(objs[1].prompts.prompt_introOpenResponse.value).to.contain(
          "testplayer_B"
        );

        // check that prompt correctly saves list sorter data
        expect(
          objs[0].prompts.prompt_listSorterPrompt.value
        ).to.have.ordered.members([
          "Hermione Granger",
          "Harry Potter",
          "Ron Weasley",
          "Albus Dumbledore",
          "Severus Snape",
          "Rubeus Hagrid",
          "Ginny Weasley",
          "Luna Lovegood",
          "Draco Malfoy",
          "Neville Longbottom",
        ]);

        // check that this order is shared between players
        expect(
          objs[1].prompts.prompt_listSorterPrompt.value
        ).to.have.ordered.members([
          "Hermione Granger",
          "Harry Potter",
          "Ron Weasley",
          "Albus Dumbledore",
          "Severus Snape",
          "Rubeus Hagrid",
          "Ginny Weasley",
          "Luna Lovegood",
          "Draco Malfoy",
          "Neville Longbottom",
        ]);

        // check that the container image tag is saved with the data
        expect(objs[0].containerTag).not.to.equal("missing");

        // check that the screen resolution and user agent are saved
        expect(objs[1].viewerInfo.width).to.be.greaterThan(0);
      });

      // check for server-side errors
      cy.readFile(`../data/empirica.log`).as("empiricaLogs");
      cy.get("@empiricaLogs").then((txt) => {
        const errorLines = txt
          .split("\n")
          .filter((line) => line.includes("[1mERR"));
        console.log("errorLines", errorLines);
        expect(errorLines).to.have.length(1);
        expect(errorLines[0]).to.include("Error test message from batch");
      });

      // check participant data saved
      cy.readFile(
        `../data/participantData/noWorkerIdGiven_${playerKeys[0]}.jsonl`
      )
        .then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          const objs = lines.map((line) => JSON.parse(line));
          console.log("participantDataObjs", objs);
          return objs;
        })
        .as("participantObjects");

      cy.get("@participantObjects").then((objs) => {
        // check that prompt data is included for both individual and group prompts
        expect(objs.filter((obj) => obj.key === "platformId")[0]?.val).to.equal(
          `noWorkerIdGiven_${playerKeys[0]}`
        );
        expect(objs.filter((obj) => obj.key === "deliberationId")).length(1);
      });

      // Check that players still see "thanks for participating" message
      cy.visit(`/?playerKey=${playerKeys[0]}`);
      cy.get(`[test-player-id="${playerKeys[0]}"]`).contains(
        "The experiment is now finished.",
        { timeout: 10000 }
      );
    });
  }
);

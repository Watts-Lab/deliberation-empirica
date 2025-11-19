/* eslint-disable no-restricted-syntax */
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
        "cdn": "test",
        "treatmentFile": "projects/example/cypress.treatments.yaml",
        "customIdInstructions": {"MyId":"projects/example/customIdInstructions.md", "default":"projects/example/defaultIdInstructions.md"},
        "platformConsent": "US",
        "consentAddendum": "projects/example/consentAddendum.md",
        "checkAudio": true,
        "checkVideo": true,
        "introSequence": "cypress_intro",
        "treatments": [
          "cypress_omnibus"
        ],
        "payoffs": "equal",
        "knockdowns": 0.9,
        "dispatchWait": 1,
        "launchDate": "${dayjs()
          .add(25, "second")
          .format("DD MMM YYYY HH:mm:ss Z")}",
        "centralPrereg": true,
        "preregRepos": [
          {
            "owner": "Watts-Lab",
            "repo": "deliberation-data-test",
            "branch": "main",
            "directory": "preregistration"
          }
        ],
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
        "videoStorage": {
          "bucket": "deliberation-lab-recordings-test",
          "region": "us-east-1"
        },
        "exitCodes": {
          "complete": "cypressComplete",
          "error": "cypressError",
          "lobbyTimeout": "cypressLobbyTimeout",
          "failedEquipmentCheck": "cypressFailedEquipmentCheck"
        }
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
      cy.empiricaSetupWindow({ playerKeys, hitId, MyId: "dummy" });
      cy.interceptIpApis();

      // Affirmations and Login
      for (const playerKey of playerKeys) {
        cy.stepPreIdChecks(playerKey, {
          checks: ["webcam", "mic", "headphones"],
        });
        cy.get(`[data-player-id="${playerKey}"]`).contains(
          "thisIsMyCustomCodeInstruction"
        );
        cy.get(`[data-player-id="${playerKey}"] [data-test="inputPaymentId"]`, {
          timeout: 6000,
        }).should("have.value", "dummy"); // check that the URL value pre-populates the ID field
        cy.wait(1000); // let react hooks settle out
        cy.stepIntro(playerKey);
      }

      // Consent
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
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

      // // Video check
      cy.stepVideoCheck(playerKeys[0], {});
      cy.stepVideoCheck(playerKeys[1], {});
      cy.stepVideoCheck(playerKeys[2], {});

      // Nickname
      cy.stepNickname(playerKeys[0]);
      cy.stepNickname(playerKeys[1]);
      cy.stepNickname(playerKeys[2]); // noncompleting stops here

      // Political affiliation survey
      cy.stepSurveyPoliticalPartyUS(playerKeys[0]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[1]);
      cy.stepSurveyPoliticalPartyUS(playerKeys[2]);

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
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[type="radio"]`
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

      // Test that re-rendering does not change shuffled options
      cy.wait(3000);
      const newOrder = [];
      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[type="radio"]`
      ).each(($el) => {
        cy.wrap($el)
          .invoke("attr", "value")
          .then((curr) => {
            newOrder.push(curr);
          });
      });

      cy.wrap(newOrder).then((newOrder) => {
        expect(newOrder).to.deep.equal(actualOrder);
      });

      // Test Prompts in Intro
      cy.playerCanNotSee(playerKeys[0], "TestDisplay00");
      cy.playerCanNotSee(playerKeys[1], "TestDisplay00");
      cy.playerCanNotSee(playerKeys[0], "TestDisplay01"); // timed display after 4 seconds
      cy.playerCanSee(playerKeys[0], "TestDisplay02"); // hidden after 4 seconds

      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="Markdown"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[1]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/openResponse.md"]`
      ).type(`Intro Open Response for ${playerKeys[0]}`, { force: true });

      cy.get(
        `[data-player-id="${playerKeys[1]}"] textarea[data-test="projects/example/openResponse.md"]`
      ).type(`Intro Open Response for ${playerKeys[1]}`, { force: true });

      cy.get(
        `[data-player-id="${playerKeys[2]}"] textarea[data-test="projects/example/openResponse.md"]`
      ).type(`Intro Open Response for ${playerKeys[2]}`, { force: true });

      cy.get(
        `[data-player-id="${playerKeys[2]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
      ).click();

      cy.get(
        `[data-player-id="${playerKeys[1]}"] [data-test="timer_start_0_end_10"]`
      );

      cy.wait(6000); // for testing timed render
      cy.playerCanSee(playerKeys[0], "TestDisplay00"); // conditional on multipleChoice equalling Markdown
      cy.playerCanNotSee(playerKeys[1], "TestDisplay00");
      cy.playerCanSee(playerKeys[0], "TestDisplay01"); // timed display after 4 seconds
      cy.playerCanNotSee(playerKeys[0], "TestDisplay02"); // hidden after 4 seconds

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // Check countdown
      cy.get(
        `[data-player-id="${playerKeys[0]}"] button[data-test="proceedButton"]`,
        {
          timeout: 20000,
        }
      );
      cy.wait(500);
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Played Ready Chime 1 times"
      );
      cy.wait(7000); // for testing chime interval
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Played Ready Chime 2 times"
      );

      cy.stepCountdown(playerKeys[0]);

      // Check Lobby
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains("Matching you");

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

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        cy.get(`[data-player-id="${keyByPosition[0]}"]`).contains(
          "Title-A-Position-0"
        );
      });

      // --------- Test Markdown Table and Image component------------

      cy.get("@consoleLog").should(
        "be.calledWith",
        "Starting game_0_Test_Markdown_and_Image_Formatting"
      );

      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains("Markdown Table");
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "th",
        "Header Left Column"
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "td",
        "Body Row 3 Right"
      );

      // test styling applied
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("Heading One")
        .should("have.css", "font-weight", "500")
        .should("have.css", "color", "rgb(26, 32, 44)");

      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("Heading Four")
        .should("have.css", "font-weight", "500")
        .should("have.css", "color", "rgb(45, 55, 72)");

      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("Paragraph text")
        .should("have.css", "font-weight", "400")
        .should("have.css", "color", "rgb(74, 85, 104)");

      cy.get("img").each(($img) => {
        cy.wrap($img).scrollIntoView().should("be.visible");
        expect($img[0].naturalWidth).to.be.greaterThan(0);
        expect($img[0].naturalHeight).to.be.greaterThan(0);
      });

      cy.wait(2000); // to get elapsed time for the submission
      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ----------  Test Individual and shared prompt editing -----------
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Starting game_1_Test_simultaneous_prompt_editing"
      );

      // Test radio button order is preserved
      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="projects/example/multipleChoiceNumbers.md"] label[data-test="option"]`
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
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceNumbers.md"] input[value="0.5"]`
        ).click();
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceNumbers.md"] input[value="0.5"]`
        ).click();

        // individually select the same response
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
        ).click();
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoice.md"] input[value="HTML"]`
        ).click();

        // Select same response as a group
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
        ).click(); // select option 1 on player 0

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceWizards.md"] input[value="Merlin"]`
        ).should("be.checked"); // check that player 1 updates to match shared selection

        // Individually select different responses
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Octarine"]`
        ).click();

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Octarine"]`
        ).should("not.be.checked"); // check that player 1 does not update, as this is an individual prompt

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColors.md"] input[value="Plaid"]`
        ).click();

        // Select different elements of multiselect
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceColorsMultiselect.md"] input[value="Octarine"]`,
          { timeout: 6000 }
        ).click();

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColorsMultiselect.md"] input[value="Octarine"]`,
          { timeout: 6000 }
        ).should("be.checked"); // check that player 1 sees player 0's selection

        cy.wait(2000);
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColorsMultiselect.md"] input[value="Plaid"]`,
          { timeout: 6000 }
        )
          .scrollIntoView()
          .check({ force: true });

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/multipleChoiceColorsMultiselect.md"] input[value="Plaid"]`,
          { timeout: 6000 }
        ).should("be.checked"); // check that player 1 sees player 1's selection

        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/multipleChoiceColorsMultiselect.md"] input[value="Plaid"]`,
          { timeout: 6000 }
        ).should("be.checked"); // check that player 0 sees player 1's selection

        // Individually submit different open responses of different lengths
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] textarea[data-test="projects/example/openResponse.md"]`
        ).type(`short`, { force: true });

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] textarea[data-test="projects/example/openResponse.md"]`
        ).type(
          `This is an extremely long response with lots of words and letters and punctuation and suchlike, so as to demonstrate long texts.`,
          { force: true }
        );

        // Test slider - check that input doesn't exist initially (no thumb)
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/sliderAvocado.md"] input[type="range"]`
        ).should("not.exist");

        // Check that instruction message is visible
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/sliderAvocado.md"]`
        ).contains("Click the bar to select a value, then drag to adjust.");

        // Click on the slider bar to set a value
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/sliderAvocado.md"]`
        ).click(200, 10);

        // Check that input now exists (thumb is visible)
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="projects/example/sliderAvocado.md"] input[type="range"]`
        ).should("exist");

        // Test slider for player 1
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/sliderAvocado.md"]`
        ).click(400, 10);

        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="projects/example/sliderAvocado.md"] input[type="range"]`
        ).should("exist");
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // -------- Test Conditional Renders --------
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Starting game_2_Test_Conditional_Renders"
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
        cy.playerCanSee(keyByPosition[0], "TestDisplay24");
        cy.playerCanSee(keyByPosition[1], "TestDisplay24");

        // Test percentAgreement when both submit same response
        cy.playerCanSee(keyByPosition[0], "TestDisplay25");
        cy.playerCanSee(keyByPosition[1], "TestDisplay25");

        // Test percentAgreement when both submit different responses
        cy.playerCanNotSee(keyByPosition[0], "TestDisplay26");
        cy.playerCanNotSee(keyByPosition[1], "TestDisplay26");

        // Test survey response condition
        cy.playerCanSee(keyByPosition[0], "TestDisplay27");
        cy.playerCanSee(keyByPosition[1], "TestDisplay27");

        // Test submit button timer from intro steps
        cy.playerCanSee(keyByPosition[0], "TestDisplay28");
        cy.playerCanSee(keyByPosition[1], "TestDisplay28");

        // Test submit button timer from game
        cy.playerCanSee(keyByPosition[0], "TestDisplay29");
        cy.playerCanSee(keyByPosition[1], "TestDisplay29");

        // Test url parameter exists
        cy.playerCanSee(keyByPosition[0], "TestDisplay30");
        cy.playerCanSee(keyByPosition[1], "TestDisplay30");

        // Test url parameter does not exist
        cy.playerCanSee(keyByPosition[0], "TestDisplay31");
        cy.playerCanSee(keyByPosition[1], "TestDisplay31");

        // Test connection info
        cy.playerCanSee(keyByPosition[0], "TestDisplay32");
        cy.playerCanSee(keyByPosition[1], "TestDisplay32");

        // Test browser info
        cy.playerCanSee(keyByPosition[0], "TestDisplay33");
        cy.playerCanSee(keyByPosition[1], "TestDisplay33");

        // Test using numeric type in value when reference is a string-encoded number
        cy.playerCanSee(keyByPosition[0], "TestDisplay34");
        cy.playerCanSee(keyByPosition[1], "TestDisplay34");

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
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Please wait for other participant"
      );
      cy.submitPlayers([playerKeys[1]]); // submit other player

      // ------------ example survey --------------
      cy.get("@consoleLog").should(
        "be.calledWith",
        "Starting game_3_Survey_Library"
      );
      cy.stepExampleSurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[1]);

      // Watch training video
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Starting game_4_Training_Video"
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
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
        "Starting game_5_Test_displays_earlier_submission_by_position"
      );

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="display_prompt.individualOpenResponse"]`
        ).contains("punctuation and suchlike");
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="display_prompt.individualOpenResponse"]`
        ).contains("short");
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ----------- Test display component for current player ------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Starting game_6_Test_displays_earlier_submission_of_current_player"
      );

      cy.get("@playerKeyByPosition").then((keyByPosition) => {
        cy.get(
          `[data-player-id="${keyByPosition[0]}"] [data-test="display_prompt.individualOpenResponse"]`
        ).contains("short");
        cy.get(
          `[data-player-id="${keyByPosition[1]}"] [data-test="display_prompt.individualOpenResponse"]`
        ).contains("punctuation and suchlike");
      });

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ---------- Test list sorter ------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Starting game_7_Test_List_Sorter"
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Please drag the following list"
      ); // stage advance wait
      cy.get(`[data-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`, {
        timeout: 6000,
      }).contains("Harry Potter");
      cy.get(`[data-player-id="${playerKeys[0]}"] [data-test="draggable-0"]`)
        .focus()
        .type(" ") // space bar says "going to move this item"
        .type("{downArrow}") // move down one
        .type(" ") // stop moving the item
        .blur();
      cy.wait(1000);
      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");
      cy.get(
        `[data-player-id="${playerKeys[1]}"] [data-test="draggable-1"]`
      ).contains("Harry Potter");

      cy.submitPlayers(playerKeys.slice(0, 2)); // submit both completing players

      // ---------------- Test Discussion ----------------
      cy.get("@consoleLog", { timeout: 6000 }).should(
        "be.calledWith",
        "Starting game_8_Discussion"
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "strong magical field",
        { timeout: 7000 }
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "the following wizards",
        { timeout: 10000 }
      );

      cy.get("@consoleLog").should("be.calledWith", "Playing Audio");

      // Exit steps
      cy.wait(5000);

      // Complete player 1
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("Please select the option that")
        .should("have.css", "font-weight", "500")
        .should("have.css", "color", "rgb(26, 32, 44)");

      cy.stepTeamViabilitySurvey(playerKeys[0]);
      cy.stepExampleSurvey(playerKeys[0]);

      // ----------- External follow-up tracked link ------------
      // This block verifies the tracked link element end-to-end:
      //   - URL parameter resolution (prompt + urlParams references)
      //   - The always-on helper text / icon
      //   - Blur/focus logging and submit-button gating
      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="trackedLink-followupLink"]`,
        { timeout: 10000 }
      ).as("trackedLinkBlock");

      cy.get("@trackedLinkBlock")
        .contains("Link opens in a new tab. Return to this tab to complete the study.")
        .should("be.visible");

      cy.get("@trackedLinkBlock")
        .find("a")
        .as("trackedLinkAnchor")
        .should("have.attr", "target", "_blank")
        .and("have.attr", "rel", "noreferrer noopener")
        .invoke("attr", "href")
        .then((href) => {
          const encodedNickname = encodeURIComponent(
            `nickname_${playerKeys[0]}`
          );
          expect(href).to.include("https://example.org/followup?");
          expect(href).to.include(`participant=${encodedNickname}`);
          expect(href).to.match(/playerKey=[^&]+/);
          expect(href.endsWith("flag=")).to.equal(true);
        });

      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .find('[data-test="submitButton"]')
        .should("not.exist");

      cy.get("@trackedLinkAnchor")
        .invoke("attr", "href", "#")
        .invoke("attr", "target", "_self")
        .click();

      cy.wait(50);
      cy.window().then((win) => {
        win.dispatchEvent(new Event("blur"));
      });
      cy.wait(120);
      cy.window().then((win) => {
        win.dispatchEvent(new Event("focus"));
      });

      cy.get(
        `[data-player-id="${playerKeys[0]}"] [data-test="submitButton"]`,
        { timeout: 5000 }
      ).should("exist");
      cy.submitPlayers([playerKeys[0]]);

      // ---------------- Test Character Counter ----------------

      // Test Character Counter - Min and Max Length
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Test Character Counter",
        { timeout: 10000 }
      );
      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testCharacterCount.md"]`
      )
        .clear()
        .type("Test");
      // Should show gray text when under minimum
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(4 / 50-200 chars)")
        .should("have.class", "text-gray-500");

      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testCharacterCount.md"]`
      )
        .clear()
        .type(
          "This is a test message that should be over fifty characters long to test the minimum length requirement."
        );
      // Should show green text when within valid range
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(104 / 50-200 chars)")
        .should("have.class", "text-green-600");

      cy.submitPlayers([playerKeys[0]]);

      // Test Character Counter - Min Length Only
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Test Character Counter - Minimum Length Only",
        { timeout: 10000 }
      );
      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testMinLengthOnly.md"]`
      )
        .clear()
        .type("Short");
      // Should show default gray color when under minimum
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(5 / 50+ characters required)")
        .should("have.class", "text-gray-500");

      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testMinLengthOnly.md"]`
      )
        .clear()
        .type(
          "This is a test message that should be over fifty characters long to test the minimum length requirement."
        );
      // Should show green text when minimum is met
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(104 / 50+ characters required)")
        .should("have.class", "text-green-600");

      cy.submitPlayers([playerKeys[0]]);

      // Test Character Counter - Max Length Only
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Test Character Counter - Maximum Length Only",
        { timeout: 10000 }
      );
      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testMaxLengthOnly.md"]`
      )
        .clear()
        .type(
          "This is a test message that should be under the maximum length limit."
        );
      // Should show default gray color when under maximum
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(69 / 100 chars max)")
        .should("have.class", "text-gray-500");

      // Try to type more than 100 characters - should be prevented
      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testMaxLengthOnly.md"]`
      )
        .clear()
        .type(
          "This is a test message that tries to exceed the maximum length limit by typing more than one hundred characters to test prevention."
        );
      // Should be limited to 100 characters exactly and show red color
      cy.get(`[data-player-id="${playerKeys[0]}"]`)
        .contains("(100 / 100 chars max)")
        .should("have.class", "text-red-600");
      cy.get(
        `[data-player-id="${playerKeys[0]}"] textarea[data-test="projects/example/testMaxLengthOnly.md"]`
      ).should(
        "have.value",
        "This is a test message that tries to exceed the maximum length limit by typing more than one hundred"
      );

      cy.submitPlayers([playerKeys[0]]);

      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "Help us improve",
        { timeout: 10000 }
      );

      cy.stepQCSurvey(playerKeys[0]);
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains("Finished");
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "cypressComplete",
        {
          timeout: 10000,
        }
      );

      // wait for data to be saved (should be fast)
      cy.wait(3000);

      // get preregistration data
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/batch_${batchLabel}.preregistration.jsonl`)
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
        cy.readFile(`../data/batch_${batchLabel}.scienceData.jsonl`)
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
          "prompt_sharedMultipleChoiceWizards",
        ]);

        // check that prompt correctly saves open response data
        expect(objs[0].prompts.prompt_introOpenResponse.value).to.contain(
          "testplayer_A"
        );
        expect(objs[1].prompts.prompt_introOpenResponse.value).to.contain(
          "testplayer_B"
        );
        expect(objs[2].prompts.prompt_introOpenResponse.value).to.contain(
          "testplayer_Noncompleting"
        );

        // check stage submission time info
        const stageSubmissions = Object.keys(objs[0].stageSubmissions);
        expect(stageSubmissions).to.include.members([
          "submitButton_introSubmitButton",
          "submitButton_markdownTableSubmitButton",
        ]);
        expect(
          objs[0].stageSubmissions.submitButton_introSubmitButton.time
        ).to.be.greaterThan(0);
        expect(
          objs[0].stageSubmissions.submitButton_markdownTableSubmitButton.time
        ).to.be.greaterThan(0);

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
        expect(objs[1].browserInfo.width).to.be.greaterThan(0);

        // check that the connection info is saved
        expect(objs[0].connectionInfo.country).to.equal("US");

        // check that we have data from the intro steps for all players that complete it
        expect(objs[0]).to.have.property("surveys");
        expect(objs[1]).to.have.property("surveys");
        expect(objs[2]).to.have.property("surveys");
        expect(
          objs[2].surveys.survey_politicalPartyUS.responses.party
        ).to.equal("Republican");

        const trackedLinkRecord =
          objs[0].trackedLinks?.trackedLink_followupLink;
        expect(trackedLinkRecord).to.exist;
        expect(trackedLinkRecord.url).to.equal(
          "https://example.org/followup"
        );
        expect(trackedLinkRecord.displayText).to.equal(
          "Complete the external signup form"
        );
        const trackedEvents = trackedLinkRecord.events.map(
          (event) => event.type
        );
        expect(trackedEvents).to.include.members(["click", "focus"]);
        expect(trackedEvents[0]).to.equal("click");
        expect(trackedLinkRecord.totalTimeAwaySeconds).to.be.greaterThan(0);
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

      // load participant data
      cy.readFile(`../data/participantData/${playerKeys[0]}.jsonl`)
        .then((txt) => {
          const lines = txt.split("\n").filter((line) => line.length > 0);
          const objs = lines.map((line) => JSON.parse(line));
          console.log("participantDataObjs", objs);
          return objs;
        })
        .as("participantObjects");

      cy.get("@participantObjects").then((objs) => {
        expect(objs.filter((obj) => obj.key === "platformId")[0]?.val).to.equal(
          `${playerKeys[0]}`
        );
        expect(objs.filter((obj) => obj.key === "deliberationId")).length(1);
      });

      // check postflight report
      cy.get("@batchLabel").then((batchLabel) => {
        cy.readFile(`../data/batch_${batchLabel}.postFlightReport.jsonl`)
          .then((txt) => {
            const obj = JSON.parse(txt);
            console.log("postFlightReportObjects", obj);
            return obj;
          })
          .as("postFlightReportObject");
      });

      cy.get("@postFlightReportObject").then((obj) => {
        // check that prompt data is included for both individual and group prompts
        expect(obj.timings.intro.median).to.be.greaterThan(0);
        expect(obj.timings.countdown.median).to.be.greaterThan(0);
        expect(obj.timings.lobby.median).to.be.greaterThan(0);
        expect(obj.timings.game.median).to.be.greaterThan(0);
        expect(obj.finalPayoffs).to.have.length(1);
      });

      // Check that players still see "thanks for participating" message
      cy.visit(`/?playerKey=${playerKeys[0]}`);
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "The experiment is now finished.",
        { timeout: 10000 }
      );
      cy.get(`[data-player-id="${playerKeys[0]}"]`).contains(
        "cypressComplete",
        {
          timeout: 10000,
        }
      );
    });
  }
);

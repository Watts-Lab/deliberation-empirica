# Conditional logic in treatment

You can use conditions

Conditions (generally) compare a reference measurement (e.g. response to a prompt, survey, URL parameter, etc) with a specified value, using one of a number of different comparators.

The following example could be used to display an element when the user has selected `response1` in a multiple choice prompt, AND have also typed at least 15 characters in an open response prompt.

```yaml
conditions:
  - reference: prompt.multipleChoicePromptA
    comparator: equals
    value: response1
  - reference: survey.politicalPartyUS.result.party
    comparator: equals
    value: Democrat
```

## Using multiple conditions together

All conditions are treated as necessary, i.e. they are combined using `AND` operations. If you need a conditional `OR`, i.e. any of a set of conditions is sufficient to display an item, you can create multiple elements with different conditions. This can make some complicated display logic tedious to implement, but if your conditions are too complex, it may be hard to credibly justify the generalizability of your findings anyways.

## `reference` sources

References can be one of the following:

#### Prompt

Prompts can be accessed by a name assigned to the prompt. For example, the prompt defined by:

```yaml
- name: Prompt stage
  elements:
    - type: prompt
      name: myPrompt
      file: projects/example/multipleChoice.md
```

can be accessed by:

```yaml
conditions:
  - reference: prompt.myPrompt
    comparator: equals
    value: response1
```

You must assign a name to a prompt in order to be able to use it in a condition (or display element) later.

#### Survey

Like prompts, surveys can be selected by their assigned names. Unlike prompts, surveys can have multiple outputs that you can select as the reference. See the survey definition for these values. For example, in the Ten Item Personality Inventory referenced below

```yaml
- name: Survey stage
  elements:
    - type: survey
      surveyName: TIPI
      name: preTIPI
```

there are [a number of personality dimensions](https://github.com/Watts-Lab/surveys/blob/main/surveys/TIPI/TIPI.score.js#L59) that can be used as a reference. We can access the computed normalized agreeableness score by selecting:

```yaml
conditions:
  - reference: survey.preTIPI.result.normAgreeableness
    comparator: isAtLeast
    value: 0.75
```

Raw survey data is generally stored in the `responses` object of the survey object, and computed scores are saved under `result`.

#### Submit Button

Submit buttons are a form of input like other inputs, and store their type and submission time.

```yaml
- name: Presurvey Stage
  elements:
    - etc.
    - type: submitButton
      name: presurveySubmit
```

This can be used in a condition:

````yaml
conditions:
  - reference: submitButton.presurveySubmit.stageTime
    comparator: isAtLeast
    value: 20
```

#### URL parameters

URL parameters can be accessed to assign participants to specific groups or show different content based on their role or other identifiers. This is especially useful for:

- Assigning confederates to specific positions
- Pairing participants with their advisors or teammates
- Showing role-specific instructions or elements

```yaml
conditions:
  - reference: urlParams.confederateName
    comparator: exists
  - reference: urlParams.role
    comparator: equals
    value: confederate
  - reference: urlParams.workerId
    comparator: equals
    value: worker123
```

URL parameters are captured when participants first visit the study URL (e.g., `https://yourstudy.com/?role=confederate&workerId=conf001`) and can be used both for group assignment and for displaying elements during game stages.

#### Connection Info

Information about the connection that the participant is using (see [metadata](metadata.md) for more info):

```yaml
conditions:
  - reference: connectionInfo.isKnownVpn
    comparator: equals
    value: false
  - reference: connectionInfo.country
    comparator: equals
    value: US
```

#### Discussion Info

Information about the discussion can be accessed

- `discussion.discussionFailed` indicates whether the discussion was ended early because a participant reported other participants missing, and those participants did not check in.
- `discussion.cumulativeSpeakingTime` time in which the participant is recognized as the primary speaker, in seconds

```yaml
conditions:
  - reference: discussion.discussionFailed
    comparator: equals
    value: true
  - reference: discussion.cumulativeSpeakingTime
    comparator: isGreaterThan
    value: 60
```

## Using conditions to control display logic

To conditionally show a display element, include a `conditions` block in the yaml for the display element.

```yaml
    - type: submitButton
        buttonText: Continue
        conditions:
            - reference: prompt.individualMultipleChoice
              comparator: equal
              value: HTML
```

### The `position` modifier

When using conditions to show or hide display elements, it is possible to use the reference measurements from individuals other than the current player. To do so, we use the `position` modifier on the condition. For example:

```yaml
- type: submitButton
  buttonText: Continue
  conditions:
    - position: all
      promptName: individualMultipleChoice
      comparator: equals
      value: HTML
```

The position modifier can take the following values:

#### position index [0,1,2,etc.]

The assigned position of the player whose reference measurement is used.

#### `player`

This is the default value used when the position modifier is not included, and uses the reference measurement given by the current player.

#### `shared`

This is used when the reference prompt is a value that is shared by all members of the group, for example a multiple choice button that anyone can select and modify.

#### `all`

This is used to require that every player submit a value that meets the condition.

#### `percentAgreement` (0...100)

This is used to check for a certain level of consensus on any response. For example, if 10 players answer a multiple choice question, and the modal response is `B`, then the condition is met if at least `value` percent of the players have chosen `B`. (For strings, this is a case-insensitive match)

## Using conditions to assign players to groups

You can also use conditions to assign players to groups, using the `groupComposition` keyword at the top level of the treatment description.

For example, in the following example, a response to the `teamSelection` prompt in the intro sequence is used to construct groups where one player selected the Red team, and the other the Blue team:

```yaml

introSequences:
  - name: team choice
    desc: Allow players to choose a team
    introSteps:
      - name: Team selection
        elements:
          - type: prompt
            name: teamSelection
            file: projects/example/teamSelectionQuestion.md

- name: myTreatment
    playerCount: 2
    groupComposition:
      - desc: Blue team
        position: 0
        conditions:
          - reference: prompt.teamSelection
            comparator: equals
            value: Blue

      - desc: Red team
        position: 1
        conditions:
          - reference: prompt.teamSelection
            comparator: equals
            value: Red
```

You can also use URL parameters to assign players to groups and positions. This is useful for pre-existing groups or roles:

```yaml
- name: confederateStudy
  playerCount: 3
  groupComposition:
    - desc: Confederate
      position: 0
      conditions:
        - reference: urlParams.role
          comparator: equals
          value: confederate

    - desc: Participant 1
      position: 1
      conditions:
        - reference: urlParams.role
          comparator: equals
          value: participant

    - desc: Participant 2
      position: 2
      conditions:
        - reference: urlParams.role
          comparator: equals
          value: participant
```

For a student-advisor study where participants need to be paired with their advisor:

```yaml
- name: advisorStudy
  playerCount: 2
  groupComposition:
    - desc: Student
      position: 0
      conditions:
        - reference: urlParams.role
          comparator: equals
          value: student
        - reference: urlParams.advisorId
          comparator: exists

    - desc: Advisor
      position: 1
      conditions:
        - reference: urlParams.role
          comparator: equals
          value: advisor
        - reference: urlParams.advisorId
          comparator: exists
```

When using prompt responses to assign participants to conditions, you can only use a player's own responses. As a result, there is no `position` modifier available.

## Referencing measurements

In order to use the result of a prompt in a condition, that prompt should be given a unique name. For example, the name for the first prompt below is used in the condition for displaying the second:

```yaml
elements:
  - type: prompt
    name: myMultipleChoicePrompt
    file: projects/example/multipleChoice.md
  - type: prompt
    file: projects/example/conditionalDisplay.md
    conditions:
      - promptName: myMultipleChoicePrompt
        comparator: equals
        value: Option1
```

# Comparators

The following comparators can be used to build conditions.

### `exists`

Checks that the item being compared is not `undefined`. In this case, `value` is meaningless.

### `doesNotExist`

Checks that the item being compared is `undefined`. In this case, `value` is meaningless.

### `equals`

Checks for [strict equality](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality) between the referred measurement and the supplied `value`.

### `doesNotEqual`

Checks for the absence of [strict equality](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality) between the referred measurement and the supplied `value`.

### `isAbove`

Strict greater than `value`.
Reference and value must both be numeric.

### `isBelow`

Strict less than `value`.
Reference and value must both be numeric.

### `isAtLeast`

Greater than or equal to `value`.
Reference and value must both be numeric.

### `isAtMost`

Less than or equal to `value`.
Reference and value must both be numeric.

### `hasLengthAtLeast`

String length is greater than or equal to `value`.
Reference must be string type, and value must be numeric.

### `hasLengthAtMost`

String length is less than or equal to `value`.
Reference must be string type, and value must be numeric.

### `includes`

Reference string contains `value` as a substring.
Reference and value must be string type.

### `doesNotInclude`

Reference string does not contains `value` as a substring.
Reference and value must be string type.

### `matches`

Reference string matches a regular expression contained in `value`.
Reference must be string type, value must be parsable as a regular expression.

### `doesNotMatch`

Reference string does not match a regular expression contained in `value`.
Reference must be string type, value must be parsable as a regular expression.

### `isOneOf`

Reference value [is a member of array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes) `value`.
`value` must be array type, and type of reference and array elements must match.

### `isNotOneOf`

Reference value [is not a member of array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes) `value`.
`value` must be array type, and type of reference and array elements must match.

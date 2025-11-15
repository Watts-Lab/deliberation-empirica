# Conditional logic in treatment

You can use conditions to either define required features of participants for assigning them to treatments and positions, or for controlling whether to show a particular display element.

Conditions (generally) compare a reference measurement (e.g. response to a prompt, survey, URL parameter, etc) with a specified value, using one of a number of different comparators.

The following example could be used to display an element when the user has selected `response1` in a multiple choice prompt, AND have also typed at least 15 characters in an open response prompt.

```yaml
conditions:
  - reference: prompt.multipleChoicePromptExample
    comparator: equals
    value: response1
  - reference: prompt.openResponsePromptExample
    comparator: hasLengthAtLeast
    value: 15
```

A full description of the types of elements that can be included in the `reference` field is available in [Reference Syntax](reference-syntax.md), and a list of comparators is below.

## Using multiple conditions together

All conditions are treated as necessary, i.e. they are combined using `AND` operations. If you need a conditional `OR`, i.e. any of a set of conditions is sufficient to display an item, you can create multiple elements with different conditions. This can make some complicated display logic tedious to implement, but if your conditions are too complex, it might be worth revisiting what you're trying to do.

## Using conditions to control display logic

To conditionally show a display element, include a `conditions` block in the yaml for the display element.

```yaml
- type: submitButton
  buttonText: Continue
  conditions:
    - reference: prompt.individualMultipleChoice
      comparator: equals
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

See [Reference Syntax](reference-syntax.md#position-based-references) for the full explanation of `position` values and consensus logic.

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

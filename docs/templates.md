# YAML Templating Syntax

This guide explains how to use the templating system within your YAML treatment files to reuse blocks of structure or entire treatments, while modifying them in small ways.

## Basic Concepts

- **Templates:** Reusable blocks of YAML defined under the `templates` key. Each template has a unique `templateName` for identification and an optional `templateDesc` for a brief description.
- **Fields:** Placeholders within templates denoted by `${fieldName}`. These are replaced with actual values when the template is used. Field keys can only include letters (a-z, A-Z), digits (0-9), and underscores (\_).
- **Template Context:** An object under `treatments` or nested within other objects that references a template using the `template` key and provides values for its fields via the `fields` key.
- **Broadcast:** A mechanism for generating multiple variations of a template by systematically substituting different values for specific fields. It's defined as a nested object within a template context.

## Template Structure

```yaml
templates:
  - templateName: myTemplate
    templateDesc: A description of what this template does.
    key1: This is some static content.
    key2: ${dynamicValue} # Field to be replaced
    nestedObject:
      subkey1: ${anotherValue} # Also to be replaced
      subkey2: More static content
```

This defines a template named `myTemplate`. The values for `key2` and the nested `subkey1` will be provided when this template is used.

## Template Context

```yaml
- template: myTemplate # Reference the template by name
  fields: # Provide values for fields
    dynamicValue: Hello
    anotherValue: World
```

This template context uses the `myTemplate` template and specifies values for its fields. The resulting YAML would look like this:

```yaml
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: Hello
  nestedObject:
    subkey1: World
    subkey2: More static content
```

### Broadcasting

```yaml
- template: myTemplate
  broadcast:
    d0:
      - dynamicValue: "Hello"
      - dynamicValue: "Bonjour"
      - dynamicValue: "Hola"
```

The `broadcast` field in this example generates three instances of `myTemplate`, each with a different greeting:

```yaml
# Instance 1
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Hello" # Quotes prevent the `Greeting:` from being interpreted as a YAML identifier
  nestedObject:
    subkey1: World
    subkey2: More static content

  # Instance 2
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Bonjour"
  nestedObject:
    subkey1: World
    subkey2: More static content

  # Instance 3
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Hola"
  nestedObject:
    subkey1: World
    subkey2: More static content
```

### Dynamic Field Creation within `fields`

In the `fields` object of the template context, we can define keys that are not directly present in the template. These keys are then populated by the values within the `broadcast` object, or in a higher-level template. Each broadcast dimension also provides an index key `d#` (e.g. `d0`, `d1`, `d2`, etc.) associated with it, which contains an instance's index along the broadcast dimension. This allows for the creation of dynamic field values that are unique to each instance of the template.

For example:

```yaml
- template: myTemplate
  fields:
    dynamicValue: "Instance ${d0}: ${greeting}"
  broadcast:
    d0:
      - greeting: "Hello"
      - greeting: "Bonjour"
      - greeting: "Hola"
```

would result in:

```yaml
# Instance 1
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Instance 0: Hello" # Quotes are maintained
  nestedObject:
    subkey1: World
    subkey2: More static content

# Instance 2
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Instance 1: Bonjour" # Quotes are maintained
  nestedObject:
    subkey1: World
    subkey2: More static content

# Instance 3
- templateName: myTemplate
  templateDesc: A description of what this template does.
  key1: This is some static content.
  key2: "Instance 2: Hola" # Quotes are maintained
  nestedObject:
    subkey1: World
    subkey2: More static content
```

### Using Templates within Templates (Nesting)

You can embed a template context within another template:

```yaml
- templateName: outerTemplate
  innerSection:
    template: innerTemplate
    fields:
      someValue: ${outerValue}

- templateName: innerTemplate
  message: ${someValue} is awesome!
```

In this case, the following template context:

```yaml
treatments:
...(other stuff here)
  - template: outerTemplate
    fields:
      outerValue: "Everything"

```

Is equivalent to:

```yaml
treatments:
...(other stuff here)
 - templateName: outerTemplate
   innerSection:
     templateName: innerTemplate
     message: "Everything is Awesome!"

```

### Complex Types

Fields can be strings, numbers, objects, or arrays. You can even use complex objects and arrays within your templates.

```yaml
templates:
  - templateName: complexTemplate
    myArray:
      - ${item1}
      - ${item2}
    myObject:
      key1: ${value1}
      key2: ${value2}
```

## Important Notes

- **Field Resolution:** Field values are resolved recursively, allowing for dynamic values to be generated from other templates.
- **Error Handling:** Be sure all required fields are provided, or your template will fail to expand. The system will alert you if any fields are left unresolved.

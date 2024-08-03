/* eslint-disable no-restricted-syntax */

import { templateContextSchema } from "./validateTreatmentFile.ts";

export function substituteFields({ templateContent, fields }) {
  // Deep clone the template to avoid mutating the original
  let expandedTemplate = JSON.parse(JSON.stringify(templateContent));

  for (const [key, value] of Object.entries(fields)) {
    let stringifiedTemplate = JSON.stringify(expandedTemplate);
    const stringifiedValue = JSON.stringify(value);

    // replace all instances of `"${key}"` with serialized value
    // this handles objects and arrays, etc.
    const objectReplacementRegex = new RegExp(`"\\$\\{${key}\\}"`, "g");
    stringifiedTemplate = stringifiedTemplate.replace(
      objectReplacementRegex,
      stringifiedValue
    );

    // if the value is just a string or number, we can also replace instances of ${key} within other strings
    if (typeof value === "string") {
      // replace all instances of `${key}` embedded in strings with other text with a serialized value
      const stringReplacementRegex = new RegExp(`\\$\\{${key}\\}`, "g");
      stringifiedTemplate = stringifiedTemplate.replace(
        stringReplacementRegex,
        value
      );
    }
    // Todo: throw error message if we're trying to substitute an object within a string

    // Parse after each replacement to surface any errors
    expandedTemplate = JSON.parse(stringifiedTemplate);
  }
  return expandedTemplate;
}

export function expandTemplate({ templates, context }) {
  // Step 1: Fill in any templates within the context itself
  const newContext = JSON.parse(JSON.stringify(context));
  // you can use templates within fields and broadcast, but not within the template reference
  if (newContext.fields) {
    // eslint-disable-next-line no-use-before-define
    newContext.fields = recursivelyFillTemplates({
      obj: newContext.fields,
      templates,
    });
  }
  if (newContext.broadcast) {
    // eslint-disable-next-line no-use-before-define
    newContext.broadcast = recursivelyFillTemplates({
      obj: newContext.broadcast,
      templates,
    });
  }
  // console.log("newContext", newContext);

  // Find the matching template
  const template = templates.find(
    (t) => t.templateName === newContext.template
  );
  if (!template) {
    throw new Error(`Template ${newContext.template} not found`);
  }
  // console.log("template", template);
  // Deep clone the template content to avoid mutating the original
  let expandedTemplate = JSON.parse(JSON.stringify(template.templateContent));

  // Step 3: Apply given fields if any
  if (newContext.fields) {
    expandedTemplate = substituteFields({
      templateContent: expandedTemplate,
      fields: newContext.fields,
    });
  }

  // The template, even after the original given fields are filled, is still a template that we can fill with broadcast values

  // Step 4: Handle broadcast fields if any

  // Define recursive function to flatten and expand the broadcast axes
  function flattenBroadcast(dimensions) {
    const dimensionIndices = Object.keys(dimensions);
    const dimensionNumbers = dimensionIndices.map((i) => parseInt(i.slice(1)));
    const lowestDimension = Math.min(...dimensionNumbers);

    const currentDimension = dimensions[`d${lowestDimension}`];
    const remainingDimensions = JSON.parse(JSON.stringify(dimensions));
    delete remainingDimensions[`d${lowestDimension}`];

    let partialFields = [{}];
    if (Object.keys(remainingDimensions).length > 0) {
      partialFields = flattenBroadcast(remainingDimensions);
    }

    const flatFields = [];
    for (const [index, entry] of currentDimension.entries()) {
      for (const partialField of partialFields) {
        const newField = { ...entry, ...partialField };
        newField[`d${lowestDimension}`] = `${index}`; // convert to string
        flatFields.push(newField);
      }
    }
    return flatFields;
  }

  if (newContext.broadcast) {
    const broadcastFieldsArray = flattenBroadcast(newContext.broadcast);
    const returnObjects = [];
    for (const broadcastFields of broadcastFieldsArray) {
      returnObjects.push(
        substituteFields({
          templateContent: expandedTemplate,
          fields: broadcastFields,
        })
      );
    }
    return returnObjects;
  }

  return expandedTemplate;
}

export function recursivelyFillTemplates({ obj, templates }) {
  // obj is any object in the treatment file, whether it is a template context or not
  let newObj = JSON.parse(JSON.stringify(obj)); // deep clone
  // console.log("newObj", newObj);

  if (!Array.isArray(newObj) && typeof newObj === "object") {
    if (newObj && newObj.template) {
      // object is a template context
      const context = templateContextSchema.parse(newObj);
      newObj = expandTemplate({ templates, context });
      newObj = recursivelyFillTemplates({ obj: newObj, templates });
    } else {
      // eslint-disable-next-line guard-for-in
      for (const key in newObj) {
        if (newObj[key] == null) {
          // null or undefined
          console.log(`key ${key} is undefined in`, newObj);
        }
        newObj[key] = recursivelyFillTemplates({ obj: newObj[key], templates });
      }
    }
  } else if (Array.isArray(newObj)) {
    for (const [index, item] of newObj.entries()) {
      if (item.template) {
        const context = templateContextSchema.parse(item);
        const expandedItem = expandTemplate({ templates, context });
        if (Array.isArray(expandedItem)) {
          newObj.splice(index, 1, ...expandedItem);
        } else if (typeof expandedItem === "object") {
          newObj[index] = expandedItem;
        } else {
          throw new Error("Unexpected type in expanded item");
        }
      } else {
        newObj[index] = recursivelyFillTemplates({ obj: item, templates });
      }
    }
  }

  return newObj;
}

export function fillTemplates({ obj, templates }) {
  let newObj = recursivelyFillTemplates({ obj, templates });

  // Check that all fields are filled
  const doubleCheckRegex = /\$\{[a-zA-Z0-9_]+\}/g;
  const missingFields = JSON.stringify(newObj).match(doubleCheckRegex);
  if (missingFields) {
    console.log("error in ", JSON.stringify(newObj, null, 4));
    console.log("missing fields", missingFields);
    throw new Error(`Missing fields: ${missingFields.join(", ")}`);
  }

  // Check that there are no remaining templates
  const templatesRemainingRegex = /"template":/g;
  const templatesRemaining = JSON.stringify(newObj).match(
    templatesRemainingRegex
  );
  if (templatesRemaining) {
    newObj = recursivelyFillTemplates({ obj: newObj, templates });
  }

  // console.log("Filled templates: ", newObj);
  return newObj;
}

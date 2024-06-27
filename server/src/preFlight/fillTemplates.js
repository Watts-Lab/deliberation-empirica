/* eslint-disable no-restricted-syntax */

import { templateContextSchema } from "./validateTreatmentFile.ts";

export function substituteFields({ template, fields }) {
  // Deep clone the template to avoid mutating the original
  let expandedTemplate = JSON.parse(JSON.stringify(template));

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

    // Parse after each replacement to surface any errors
    expandedTemplate = JSON.parse(stringifiedTemplate);
  }
  return expandedTemplate;
}

export function expandTemplate({ templates, context }) {
  // Find the matching template
  const template = templates.find((t) => t.templateName === context.template);
  if (!template) {
    throw new Error(`Template ${context.template} not found`);
  }

  // Deep clone the template to avoid mutating the original
  let expandedTemplate = JSON.parse(JSON.stringify(template));

  // Step 3: Apply given fields if any
  if (context.fields) {
    expandedTemplate = substituteFields({
      template: expandedTemplate,
      fields: context.fields,
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

  if (context.broadcast) {
    const broadcastFieldsArray = flattenBroadcast(context.broadcast);
    const returnObjects = [];
    for (const broadcastFields of broadcastFieldsArray) {
      returnObjects.push(
        substituteFields({
          template: expandedTemplate,
          fields: broadcastFields,
        })
      );
    }
    return returnObjects;
  }

  return expandedTemplate;
}

export function recursivelyFillTemplates({ obj, templates }) {
  // obj is any object in the treatment file
  let newObj = JSON.parse(JSON.stringify(obj)); // deep clone

  if (!Array.isArray(newObj) && typeof newObj === "object") {
    if (newObj.template) {
      // object is a template context
      const context = templateContextSchema.parse(newObj);
      newObj = expandTemplate({ templates, context });
      newObj = recursivelyFillTemplates({ obj: newObj, templates });
    } else {
      // eslint-disable-next-line guard-for-in
      for (const key in newObj) {
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

  // Check that all fields are filled
  const doubleCheckRegex = /\$\{[a-zA-Z0-9_]+\}/g;
  const missingFields = JSON.stringify(newObj).match(doubleCheckRegex);
  if (missingFields) {
    console.log("error in ", JSON.stringify(newObj, null, 4));
    console.log("missing fields", missingFields);
    throw new Error(`Missing fields: ${missingFields.join(", ")}`);
  }

  // throw error message if we're trying to substitute an object within a string

  return newObj;
}

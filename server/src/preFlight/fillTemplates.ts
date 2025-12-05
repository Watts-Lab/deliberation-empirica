/* eslint-disable no-restricted-syntax */
import * as yaml from "js-yaml";
import { templateContextSchema } from "./validateTreatmentFile";

// ----- Types -----

export type JsonLike = unknown;

export type TemplateDef = {
  templateName: string;
  templateContent: JsonLike;
  [k: string]: unknown; // allow extra keys
};

// If you want a strict type, replace `any` with the zod-inferred type
export type TemplateContext = any;

// ----- Pure field substitution -----

export function substituteFields({
  templateContent,
  fields,
}: {
  templateContent: JsonLike;
  fields: Record<string, unknown>;
}): JsonLike {
  let expandedTemplate: JsonLike = JSON.parse(JSON.stringify(templateContent));

  for (const [key, value] of Object.entries(fields)) {
    let stringifiedTemplate = JSON.stringify(expandedTemplate);
    const stringifiedValue = JSON.stringify(value);

    // Replace values like "${key}"
    const objectReplacementRegex = new RegExp(`"\\$\\{${key}\\}"`, "g");
    stringifiedTemplate = stringifiedTemplate.replace(
      objectReplacementRegex,
      stringifiedValue
    );

    // Replace inline string occurrences of ${key}
    if (typeof value === "string") {
      const stringReplacementRegex = new RegExp(`\\$\\{${key}\\}`, "g");
      stringifiedTemplate = stringifiedTemplate.replace(
        stringReplacementRegex,
        value
      );
    }

    expandedTemplate = JSON.parse(stringifiedTemplate);
  }

  return expandedTemplate;
}

// ----- Template expansion -----

export function expandTemplate({
  templates,
  context,
}: {
  templates: TemplateDef[];
  context: TemplateContext;
}): JsonLike {
  const newContext: any = JSON.parse(JSON.stringify(context));

  // Step 1: fill templates inside context.fields or context.broadcast
  if (newContext.fields) {
    newContext.fields = recursivelyFillTemplates({
      obj: newContext.fields,
      templates,
    });
  }

  if (newContext.broadcast) {
    newContext.broadcast = recursivelyFillTemplates({
      obj: newContext.broadcast,
      templates,
    });
  }

  // Step 2: find template
  const template = templates.find(
    (t) => t.templateName === newContext.template
  );
  if (!template) {
    throw new Error(`Template "${newContext.template}" not found`);
  }

  let expandedTemplate: any = JSON.parse(
    JSON.stringify(template.templateContent)
  );

  // Step 3: apply fields
  if (newContext.fields) {
    expandedTemplate = substituteFields({
      templateContent: expandedTemplate,
      fields: newContext.fields as Record<string, unknown>,
    });
  }

  // Step 4: broadcast handling
  function flattenBroadcast(
    dimensions: Record<string, Array<Record<string, unknown>>>
  ): Array<Record<string, unknown>> {
    const dimensionIndices = Object.keys(dimensions);
    const dimensionNumbers = dimensionIndices.map((i) =>
      parseInt(i.slice(1), 10)
    );
    const lowestDimension = Math.min(...dimensionNumbers);

    const currentDimension = dimensions[`d${lowestDimension}`];
    const remainingDimensions: typeof dimensions = JSON.parse(
      JSON.stringify(dimensions)
    );
    delete remainingDimensions[`d${lowestDimension}`];

    let partialFields: Array<Record<string, unknown>> = [{}];
    if (Object.keys(remainingDimensions).length > 0) {
      partialFields = flattenBroadcast(remainingDimensions);
    }

    const flatFields: Array<Record<string, unknown>> = [];
    for (const [index, entry] of currentDimension.entries()) {
      for (const partialField of partialFields) {
        const newField = { ...entry, ...partialField };
        newField[`d${lowestDimension}`] = `${index}`;
        flatFields.push(newField);
      }
    }
    return flatFields;
  }

  if (newContext.broadcast) {
    const broadcastFieldsArray = flattenBroadcast(
      newContext.broadcast as Record<string, Array<Record<string, unknown>>>
    );

    const returnObjects: any[] = [];
    for (const broadcastFields of broadcastFieldsArray) {
      const newObj = substituteFields({
        templateContent: expandedTemplate,
        fields: broadcastFields,
      });

      if (Array.isArray(newObj)) {
        returnObjects.push(...newObj);
      } else if (typeof newObj === "object" && newObj !== null) {
        returnObjects.push(newObj);
      } else {
        throw new Error("Unexpected type in broadcast fields");
      }
    }
    return returnObjects;
  }

  return expandedTemplate;
}

// ----- Recursive filler -----

export function recursivelyFillTemplates({
  obj,
  templates,
}: {
  obj: JsonLike;
  templates: TemplateDef[];
}): JsonLike {
  let newObj: any;

  try {
    newObj = JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.log("Error parsing", obj);
    throw e;
  }

  if (!Array.isArray(newObj) && typeof newObj === "object" && newObj !== null) {
    // Template context?
    if (newObj && (newObj as any).template) {
      const context: TemplateContext = templateContextSchema.parse(newObj);
      newObj = expandTemplate({ templates, context });
      return recursivelyFillTemplates({ obj: newObj, templates });
    }

    // Recurse into object keys
    for (const key in newObj as Record<string, unknown>) {
      if (newObj[key] == null) {
        console.log(`key ${key} is undefined in`, newObj);
      }
      newObj[key] = recursivelyFillTemplates({
        obj: newObj[key],
        templates,
      });
    }
  } else if (Array.isArray(newObj)) {
    // Recurse into arrays
    for (const [index, item] of (newObj as any[]).entries()) {
      if (item && (item as any).template) {
        const context: TemplateContext = templateContextSchema.parse(item);
        const expandedItem = expandTemplate({ templates, context });

        if (Array.isArray(expandedItem)) {
          newObj.splice(index, 1, ...expandedItem);
        } else if (typeof expandedItem === "object" && expandedItem !== null) {
          newObj[index] = expandedItem;
        } else {
          throw new Error("Unexpected type in expanded item");
        }
      } else {
        newObj[index] = recursivelyFillTemplates({
          obj: item,
          templates,
        });
      }
    }
  }

  return newObj;
}

// ----- Top-level fillTemplates -----

export function fillTemplates({
  obj,
  templates,
}: {
  obj: JsonLike;
  templates: TemplateDef[];
}): JsonLike {
  let newObj = recursivelyFillTemplates({ obj, templates });

  // Re-fix partially filled templates until none remain
  const templatesRemainingRegex = /"template":/g;
  let templatesRemaining = JSON.stringify(newObj).match(
    templatesRemainingRegex
  );

  while (templatesRemaining) {
    console.log("Found unfilled template, trying again.");
    newObj = recursivelyFillTemplates({ obj: newObj, templates });
    templatesRemaining = JSON.stringify(newObj).match(
      templatesRemainingRegex
    );
  }

  // Check for missing fields
  const doubleCheckRegex = /\$\{[a-zA-Z0-9_]+\}/g;
  const missingFields = JSON.stringify(newObj).match(doubleCheckRegex);
  if (missingFields) {
    console.log("error in ", JSON.stringify(newObj, null, 4));
    console.log("missing fields", missingFields);
    throw new Error(`Missing fields: ${missingFields.join(", ")}`);
  }

  return newObj;
}

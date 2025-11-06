/* eslint-disable no-restricted-syntax */
import * as vscode from "vscode";
import * as yaml from "js-yaml";
import { templateContextSchema } from "./validateTreatmentFile";
// if you use zod for the schema, you can uncomment these two lines to get a stricter type:
// import type { z } from "zod";
// type TemplateContext = z.infer<typeof templateContextSchema>;

type JsonLike = unknown;

type TemplateDef = {
  templateName: string;
  templateContent: JsonLike;
  // allow extra keys without constraining shape
  [k: string]: unknown;
};

// If you want a strict type, replace `any` with the zod-inferred `TemplateContext` above.
type TemplateContext = any;

export function substituteFields({
  templateContent,
  fields,
}: {
  templateContent: JsonLike;
  // fields is usually a flat map, but we allow any values
  fields: Record<string, unknown>;
}): JsonLike {
  // Deep clone the template to avoid mutating the original
  let expandedTemplate: JsonLike = JSON.parse(JSON.stringify(templateContent));

  // console.log("populating fields", fields);
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

export function expandTemplate({
  templates,
  context,
}: {
  templates: TemplateDef[];
  context: TemplateContext;
}): JsonLike {
  // Step 1: Fill in any templates within the context itself
  const newContext: any = JSON.parse(JSON.stringify(context));
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
    // eslint-disable-next-line no-console
    console.log(
      "Found templates:",
      templates.map((t) => t.templateName)
    );
    throw new Error(`Template "${newContext.template}" not found`);
  }
  // console.log("template", template);
  // Deep clone the template content to avoid mutating the original
  let expandedTemplate: any = JSON.parse(JSON.stringify(template.templateContent));

  // Step 3: Apply given fields if any
  if (newContext.fields) {
    expandedTemplate = substituteFields({
      templateContent: expandedTemplate,
      fields: newContext.fields as Record<string, unknown>,
    });
  }

  // The template, even after the original given fields are filled, is still a template that we can fill with broadcast values

  // Step 4: Handle broadcast fields if any

  // Define recursive function to flatten and expand the broadcast axes
  function flattenBroadcast(
    dimensions: Record<string, Array<Record<string, unknown>>>
  ): Array<Record<string, unknown>> {
    const dimensionIndices = Object.keys(dimensions);
    const dimensionNumbers = dimensionIndices.map((i) => parseInt(i.slice(1), 10));
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
        const newField: Record<string, unknown> = { ...entry, ...partialField };
        newField[`d${lowestDimension}`] = `${index}`; // convert to string
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

export function recursivelyFillTemplates({
  obj,
  templates,
}: {
  obj: JsonLike;
  templates: TemplateDef[];
}): JsonLike {
  // obj is any object in the treatment file, whether it is a template context or not
  let newObj: any;
  try {
    newObj = JSON.parse(JSON.stringify(obj)); // deep clone
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("Error parsing", obj);
    throw e;
  }
  // console.log("newObj", newObj);

  if (!Array.isArray(newObj) && typeof newObj === "object" && newObj !== null) {
    // if we get to a node in the tree that is an object, it can either be a template
    // context (ie, a reference to a template that needs to be filled), or a regular
    // object that may contain other template contexts that need to be filled
    // in this case, recursively navigate through the keys of the object
    if (newObj && (newObj as any).template) {
      // object is a template context
      const context: TemplateContext = templateContextSchema.parse(newObj);
      newObj = expandTemplate({ templates, context });
      newObj = recursivelyFillTemplates({ obj: newObj, templates });
    } else {
      // eslint-disable-next-line guard-for-in
      for (const key in newObj as Record<string, unknown>) {
        if (newObj[key] == null) {
          // eslint-disable-next-line no-console
          console.log(`key ${key} is undefined in`, newObj);
        }
        newObj[key] = recursivelyFillTemplates({ obj: newObj[key], templates });
      }
    }
  } else if (Array.isArray(newObj)) {
    // if the node is itself an array, we need to iterate through each item in the array.
    // if the item is a template context, we need to expand it and replace it with the expanded object
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
        newObj[index] = recursivelyFillTemplates({ obj: item, templates });
      }
    }
  }

  return newObj;
}

export function fillTemplates({
  obj,
  templates,
}: {
  obj: JsonLike;
  templates: TemplateDef[];
}): JsonLike {
  let newObj = recursivelyFillTemplates({ obj, templates });

  // Check that there are no remaining templates
  const templatesRemainingRegex = /"template":/g;
  let templatesRemaining = JSON.stringify(newObj).match(templatesRemainingRegex);
  while (templatesRemaining) {
    // eslint-disable-next-line no-console
    console.log("Found unfilled template, trying again.");
    newObj = recursivelyFillTemplates({ obj: newObj, templates });

    templatesRemaining = JSON.stringify(newObj).match(templatesRemainingRegex);
  }

  // Check that all fields are filled
  const doubleCheckRegex = /\$\{[a-zA-Z0-9_]+\}/g;
  const missingFields = JSON.stringify(newObj).match(doubleCheckRegex);
  if (missingFields) {
    // eslint-disable-next-line no-console
    console.log("error in ", JSON.stringify(newObj, null, 4));
    // eslint-disable-next-line no-console
    console.log("missing fields", missingFields);
    throw new Error(`Missing fields: ${missingFields.join(", ")}`);
  }

  // console.log("Filled templates: ", newObj);
  return newObj;
}

export const EXP_SCHEME = "deliberation-expanded";
const MAX_LINES = 10_000;

export class ExpandedTemplatesProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private _srcByPreview = new Map<string, vscode.Uri>();

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const qp = new URLSearchParams(uri.query);
    const srcStr = qp.get("src");
    if (!srcStr) return "# Error: missing source URI\n";

    const src = vscode.Uri.parse(srcStr);
    this._srcByPreview.set(uri.toString(), src);

    try {
      const raw = await vscode.workspace.fs.readFile(src);
      const text = new TextDecoder("utf-8").decode(raw);
      const obj = yaml.load(text) as any;

      // Pull templates from the file; tweak if your templates array lives elsewhere.
      const templates: any[] =
        Array.isArray(obj?.templates) ? obj.templates :
        Array.isArray(obj?.templateLibrary) ? obj.templateLibrary : [];

      // Lenient expansion
      let expanded: any;
      let warning: string | undefined;

      try {
        expanded = fillTemplates({ obj, templates });
      } catch (e: any) {
        warning = String(e?.message ?? e);
        // Partial expansion
        let tmp = recursivelyFillTemplates({ obj, templates });
        const tag = /"template":/g;
        while (JSON.stringify(tmp).match(tag)) {
          tmp = recursivelyFillTemplates({ obj: tmp, templates });
        }
        expanded = tmp;
      }

      // Always remove the templates section from the preview output whether
      // expansion succeeded or we fell back to the partial expansion above.
      if (expanded && typeof expanded === "object") {
        delete (expanded as any).templates;
        delete (expanded as any).templateLibrary;
      }

      const dumped = yaml.dump(expanded, { noRefs: true, sortKeys: false, lineWidth: 100 });

      const body = applyTruncation(dumped, MAX_LINES);
      const header =
        `# Preview (read-only): Expanded templates\n` +
        `# Source: ${src.fsPath}\n` +
        (warning ? `# Warning: ${warning}\n` : "") +
        (body.truncated ? `# Note: output truncated to ${MAX_LINES} lines\n` : "") +
        `\n`;

      return header + body.text;
    } catch (err: any) {
      return `# Error generating expanded YAML\n# ${err?.message ?? String(err)}\n`;
    }
  }

  refreshForSource(source: vscode.Uri) {
    for (const [previewKey, src] of this._srcByPreview.entries()) {
      if (src.toString() === source.toString()) {
        this._onDidChange.fire(vscode.Uri.parse(previewKey));
      }
    }
  }
}

function applyTruncation(s: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = s.split(/\r?\n/);
  if (lines.length <= maxLines) return { text: s, truncated: false };
  const slice = lines.slice(0, maxLines);
  slice.push("# … truncated …");
  return { text: slice.join("\n"), truncated: true };
}
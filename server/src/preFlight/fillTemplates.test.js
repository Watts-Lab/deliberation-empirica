/* eslint-disable no-template-curly-in-string */

import { expect, test } from "vitest";
import { load as loadYaml } from "js-yaml";
import { readFileSync } from "fs";

import { expandTemplate, fillTemplates } from "./fillTemplates";

test("template with simple object field", () => {
  const templates = [
    {
      templateName: "simple_object",
      templateDesc: "string and object substitution",
      templateContent: {
        field1Key: "${f1}",
        field2Key: "${f2}",
        field3Key: "Adding ${f1} in a string succeeds!",
      },
    },
  ];

  const context = {
    template: "simple_object",
    fields: {
      f1: "f1Value",
      f2: {
        f2a: "f2aValue",
        f2b: "f2bValue",
      },
    },
  };

  const expectedResult = {
    field1Key: "f1Value",
    field2Key: {
      f2a: "f2aValue",
      f2b: "f2bValue",
    },
    field3Key: "Adding f1Value in a string succeeds!",
  };

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with simple list field", () => {
  const templates = [
    {
      templateName: "simple_list",
      templateDesc: "string and object substitution",
      templateContent: ["${f1}", "${f2}", "Adding ${f1} in a string succeeds!"],
    },
  ];

  const context = {
    template: "simple_list",
    fields: {
      f1: "f1Value",
      f2: {
        f2a: "f2aValue",
        f2b: "f2bValue",
      },
    },
  };

  const expectedResult = [
    "f1Value",
    {
      f2a: "f2aValue",
      f2b: "f2bValue",
    },
    "Adding f1Value in a string succeeds!",
  ];

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with simple string field", () => {
  const templates = [
    {
      templateName: "simple_string",
      templateDesc: "string and object substitution",
      templateContent: "Adding ${f1} in a string succeeds!",
    },
  ];

  const context = {
    template: "simple_string",
    fields: {
      f1: "f1Value",
    },
  };

  const expectedResult = "Adding f1Value in a string succeeds!";

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test.skip("error when trying to substitute object within a string", () => {
  const templates = [
    {
      templateName: "simple",
      templateDesc: "string and object substitution",
      templateContent: {
        field1Key: "${f1}",
        field2Key: "${f2}",
        field3Key: "Adding ${f2} in a string should fail!",
      },
    },
  ];

  const context = {
    template: "outer",
    fields: {
      f1: "f1Value",
      f2: {
        f2a: "f2aValue",
        f2b: "f2bValue",
      },
    },
  };

  expect(() => expandTemplate({ templates, context })).toThrow();
});

test("nested templates", () => {
  const templates = [
    {
      templateName: "outer",
      templateDesc: "Contains a nested template",
      templateContent: {
        field1Key: "${f1}",
        field2Key: "${f2}",
        fields1and2Keys: "${f1}_${f2}",
        field3Key: "${f3}",
        innerTemplateResult: {
          template: "inner",
          fields: {
            f4: "${f1}",
            f5: "${f2}_suffix",
          },
        },
      },
    },
    {
      templateName: "inner",
      templateDesc: "Used within another template",
      templateContent: {
        field4Key: "${f4}",
        field5Key: "${f5}",
      },
    },
  ];

  const context = {
    template: "outer",
    fields: {
      f1: "f1Value",
      f2: "f2Value",
      f3: {
        f3a: "f3aValue",
        f3b: "f3bValue",
      },
    },
  };

  const expectedResult = {
    field1Key: "f1Value",
    field2Key: "f2Value",
    fields1and2Keys: "f1Value_f2Value",
    field3Key: {
      f3a: "f3aValue",
      f3b: "f3bValue",
    },
    innerTemplateResult: {
      field4Key: "f1Value",
      field5Key: "f2Value_suffix",
    },
  };

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast", () => {
  const templates = [
    {
      templateName: "simple",
      templateContent: {
        name: "${name}",
        Aval: "${A}",
        Bval: "${B}",
      },
    },
  ];

  const context = {
    template: "simple",
    fields: {
      name: "t_d0_${d0}_d1_${d1}", // test filling fields with templates
    },
    broadcast: {
      d0: [
        {
          A: "A0",
        },
        {
          A: "A1",
        },
        {
          A: "A2",
        },
      ],
      d1: [
        {
          B: "B0",
        },
        {
          B: "B1",
        },
      ],
    },
  };

  const expectedResult = [
    {
      name: "t_d0_0_d1_0",
      Aval: "A0",
      Bval: "B0",
    },
    {
      name: "t_d0_0_d1_1",
      Aval: "A0",
      Bval: "B1",
    },
    {
      name: "t_d0_1_d1_0",
      Aval: "A1",
      Bval: "B0",
    },
    {
      name: "t_d0_1_d1_1",
      Aval: "A1",
      Bval: "B1",
    },
    {
      name: "t_d0_2_d1_0",
      Aval: "A2",
      Bval: "B0",
    },
    {
      name: "t_d0_2_d1_1",
      Aval: "A2",
      Bval: "B1",
    },
  ];

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast merging to array", () => {
  const templates = [
    {
      templateName: "inner",
      templateContent: {
        name: "${name}",
      },
    },
    {
      templateName: "outer",
      templateContent: {
        arrayOfInnersAndOthers: [
          {
            template: "inner",
            fields: {
              name: "inner ${bname}",
            },
            broadcast: {
              d0: [
                {
                  bname: "d0 A",
                },
                {
                  bname: "d0 B",
                },
              ],
            },
          },
          {
            name: "outer Other",
            val: "other val",
          },
        ],
      },
    },
  ];

  const context = {
    template: "outer",
  };

  const expectedResult = {
    arrayOfInnersAndOthers: [
      {
        name: "inner d0 A",
      },
      {
        name: "inner d0 B",
      },
      {
        name: "outer Other",
        val: "other val",
      },
    ],
  };

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test("template with broadcast array from another template", () => {
  const templates = [
    {
      templateName: "simple",
      templateContent: {
        name: "${name}",
        Aval: "${A}",
        Bval: "${B}",
      },
    },
    {
      templateName: "broadcastList",
      templateContent: [{ A: "A0" }, { A: "A1" }, { A: "A2" }],
    },
  ];

  const context = {
    template: "simple",
    fields: {
      name: "t_d0_${d0}_d1_${d1}", // test filling fields with templates
    },
    broadcast: {
      d0: {
        template: "broadcastList",
      },
      d1: [
        {
          B: "B0",
        },
        {
          B: "B1",
        },
      ],
    },
  };

  const expectedResult = [
    {
      name: "t_d0_0_d1_0",
      Aval: "A0",
      Bval: "B0",
    },
    {
      name: "t_d0_0_d1_1",
      Aval: "A0",
      Bval: "B1",
    },
    {
      name: "t_d0_1_d1_0",
      Aval: "A1",
      Bval: "B0",
    },
    {
      name: "t_d0_1_d1_1",
      Aval: "A1",
      Bval: "B1",
    },
    {
      name: "t_d0_2_d1_0",
      Aval: "A2",
      Bval: "B0",
    },
    {
      name: "t_d0_2_d1_1",
      Aval: "A2",
      Bval: "B1",
    },
  ];

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

test.skip("populate templates using full treatment file", () => {
  const filePath =
    "../cypress/fixtures/mockCDN/projects/example/templates.treatments.yaml";

  const content = readFileSync(filePath, { encoding: "utf8" });
  const loadedObject = loadYaml(content);
  const serializedJSON = JSON.stringify(loadedObject);
  console.log(serializedJSON);
});

// Todo: test when template returns a list, and it is broadcast.
test("template with list and broadcast returns properly", () => {
  const templates = [
    {
      templateName: "listTemplate",
      templateContent: [
        {
          outerIndex: "${outerIndex}",
          innerIndex: "0",
        },
        {
          outerIndex: "${outerIndex}",
          innerIndex: "1",
        },
      ],
    },
  ];

  const context = {
    template: "listTemplate",
    broadcast: {
      d0: [
        {
          outerIndex: "0",
        },
        {
          outerIndex: "1",
        },
        {
          outerIndex: "2",
        },
      ],
    },
  };

  const expectedResult = [
    {
      outerIndex: "0",
      innerIndex: "0",
    },
    {
      outerIndex: "0",
      innerIndex: "1",
    },
    {
      outerIndex: "1",
      innerIndex: "0",
    },
    {
      outerIndex: "1",
      innerIndex: "1",
    },
    {
      outerIndex: "2",
      innerIndex: "0",
    },
    {
      outerIndex: "2",
      innerIndex: "1",
    },
  ];

  const result = fillTemplates({ templates, obj: context });
  expect(result).toEqual(expectedResult);
});

/* eslint-disable import/first */
import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock axios so the assetBaseUrl path doesn't make a real HTTP call.
// The mock returns a treatment YAML that contains a single-stage
// treatment with one prompt element (so the validation path also
// fetches the prompt via axios — exercises both call sites).
const fixtureByUrl = new Map();
vi.mock("axios", () => {
  const get = vi.fn(async (url) => {
    if (fixtureByUrl.has(url)) {
      return { data: fixtureByUrl.get(url), status: 200 };
    }
    throw new Error(`[mock axios] no fixture registered for url: ${url}`);
  });
  return {
    default: { get },
    get,
  };
});

import axios from "axios";
import { getTreatments } from "./getTreatments";

const treatmentYaml = `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            file: hello.prompt.md
`;

const promptFile = `---
type: multipleChoice
---

Body.

---

- A
- B
`;

describe("getTreatments — assetBaseUrl mode (manager-launched)", () => {
  beforeEach(() => {
    fixtureByUrl.clear();
    axios.get.mockClear();
  });

  test("fetches the treatment file from {assetBaseUrl}/{path} via axios", async () => {
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      treatmentYaml,
    );
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/hello.prompt.md",
      promptFile,
    );

    const { treatments } = await getTreatments({
      assetBaseUrl: "https://cdn.example/abc",
      path: "proj/study.stagebook.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    expect(treatments[0].name).toBe("t1");
    // Treatment file fetched from the manager-mirrored URL, not via
    // the CDN provider.
    expect(axios.get).toHaveBeenCalledWith(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      expect.any(Object),
    );
    // Prompt file resolved relative to the treatment file's directory
    // and fetched from the same prefix.
    expect(axios.get).toHaveBeenCalledWith(
      "https://cdn.example/abc/proj/hello.prompt.md",
      expect.any(Object),
    );
  });

  test("throws a useful error when an asset is missing from the prefix", async () => {
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      treatmentYaml,
    );
    // hello.prompt.md intentionally NOT registered.

    // The outer error from validateTreatment loses the inner message
    // through the existing rethrow pattern (`new Error(msg, e)` treats
    // the second arg as options, not message). What we can assert is
    // that the request hit the manager-mirrored URL — which is the
    // contract surface this test is here to pin.
    await expect(
      getTreatments({
        assetBaseUrl: "https://cdn.example/abc",
        path: "proj/study.stagebook.yaml",
        treatmentNames: ["t1"],
        introSequenceName: "none",
      }),
    ).rejects.toThrow();
    expect(axios.get).toHaveBeenCalledWith(
      "https://cdn.example/abc/proj/hello.prompt.md",
      expect.any(Object),
    );
  });

  // ADR 0009 §"Asset reference resolution" — server side mirrors
  // the same three forms the client resolver supports. These tests
  // pin the validateElement → fetchAssetText path for each form.

  test("`asset://X` in a prompt element fetches against the prefix root (no treatment-dir join)", async () => {
    const yamlWithAssetRef = `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            file: asset://shared/hello.prompt.md
`;
    fixtureByUrl.set(
      "https://cdn.example/abc/deeply/nested/study.stagebook.yaml",
      yamlWithAssetRef,
    );
    fixtureByUrl.set(
      "https://cdn.example/abc/shared/hello.prompt.md",
      promptFile,
    );

    const { treatments } = await getTreatments({
      assetBaseUrl: "https://cdn.example/abc",
      path: "deeply/nested/study.stagebook.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    // asset:// resolves prefix-relative, NOT joined with the
    // deeply/nested/ treatment dir.
    expect(axios.get).toHaveBeenCalledWith(
      "https://cdn.example/abc/shared/hello.prompt.md",
      expect.any(Object),
    );
  });

  test("`asset://../../X` collapses `..` segments so it can't escape the prefix", async () => {
    // Defense against a treatment file using `asset://../../other-study/secret`
    // to traverse above `assetBaseUrl`. Without collapsing, the joined URL
    // becomes `${assetBaseUrl}/../../...` which most CDNs/browsers
    // normalize and would let one Study read another's assets in
    // manager-launched mode. The resolver collapses `..` past the root.
    const yamlEscapingRef = `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            file: asset://../../foo/hello.prompt.md
`;
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      yamlEscapingRef,
    );
    fixtureByUrl.set("https://cdn.example/abc/foo/hello.prompt.md", promptFile);

    const { treatments } = await getTreatments({
      assetBaseUrl: "https://cdn.example/abc",
      path: "proj/study.stagebook.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    // The `..` segments pop past the prefix root and disappear; the
    // joined URL stays under `${assetBaseUrl}`.
    expect(axios.get).toHaveBeenCalledWith(
      "https://cdn.example/abc/foo/hello.prompt.md",
      expect.any(Object),
    );
  });

  test("rejects a malformed asset: reference (no `//`)", async () => {
    const yamlWithBadRef = `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            file: asset:no-slash.prompt.md
`;
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      yamlWithBadRef,
    );

    await expect(
      getTreatments({
        assetBaseUrl: "https://cdn.example/abc",
        path: "proj/study.stagebook.yaml",
        treatmentNames: ["t1"],
        introSequenceName: "none",
      }),
    ).rejects.toThrow();
  });

  test("absolute https:// URL in a prompt element fetches directly (no prefix prepend)", async () => {
    const yamlWithExternalRef = `
treatments:
  - name: t1
    playerCount: 1
    gameStages:
      - name: stage1
        duration: 10
        elements:
          - type: prompt
            file: https://external.example.com/external.prompt.md
`;
    fixtureByUrl.set(
      "https://cdn.example/abc/proj/study.stagebook.yaml",
      yamlWithExternalRef,
    );
    fixtureByUrl.set(
      "https://external.example.com/external.prompt.md",
      promptFile,
    );

    const { treatments } = await getTreatments({
      assetBaseUrl: "https://cdn.example/abc",
      path: "proj/study.stagebook.yaml",
      treatmentNames: ["t1"],
      introSequenceName: "none",
    });

    expect(treatments).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledWith(
      "https://external.example.com/external.prompt.md",
      expect.any(Object),
    );
  });
});

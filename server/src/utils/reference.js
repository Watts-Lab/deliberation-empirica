const getNestedValueByPath = (obj, path) =>
  path.reduce((acc, key) => acc?.[key], obj);

export function getReference({ reference, player }) {
  const type = reference.split(".")[0];
  let name;
  let path;
  let referenceKey;

  if (["survey", "submitButton", "qualtrics"].includes(type)) {
    [, name, ...path] = reference.split(".");
    referenceKey = `${type}_${name}`;
  } else if (type === "prompt") {
    // eslint-disable-next-line prefer-destructuring
    name = reference.split(".")[1];
    referenceKey = `${type}_${name}`;
    path = ["value"]; // shortcut for prompt value, so you don't have to include it in the reference string
  } else if (type === "trackedLink") {
    [, name, ...path] = reference.split(".");
    referenceKey = `trackedLink_${name}`;
  } else if (["urlParams", "connectionInfo", "browserInfo"].includes(type)) {
    [, ...path] = reference.split(".");
    referenceKey = type;
  } else if (
    ["participantInfo", "discussion", "lobby", "dispatch"].includes(type)
  ) {
    [, name, ...path] = reference.split(".");
    referenceKey = name;
  } else {
    throw new Error(`Invalid reference type: ${type}`);
  }

  let referenceValue;
  try {
    const referenceObject = player.get(referenceKey);
    referenceValue = getNestedValueByPath(referenceObject, path);
  } catch (e) {
    throw new Error(`Error getting reference value for ${reference}:`, e);
  }

  return referenceValue;
}

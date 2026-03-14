/**
 * Shared URL parameter utilities used by Qualtrics and TrackedLink.
 */

export const serializeParamValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return value.toString();
};

export const pickFirstDefined = (values) =>
  values?.find((val) => val !== undefined && val !== null);

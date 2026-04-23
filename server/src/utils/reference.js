import { getReferenceKeyAndPath, getNestedValueByPath } from "stagebook";

export function getReference({ reference, player }) {
  const { referenceKey, path } = getReferenceKeyAndPath(reference);
  const referenceObject = player.get(referenceKey);
  return getNestedValueByPath(referenceObject, path);
}

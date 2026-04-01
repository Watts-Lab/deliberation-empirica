// eslint-disable-next-line import/no-extraneous-dependencies
import { getReferenceKeyAndPath, getNestedValueByPath } from "@deliberation-lab/score";

export function getReference({ reference, player }) {
  const { referenceKey, path } = getReferenceKeyAndPath(reference);
  const referenceObject = player.get(referenceKey);
  return getNestedValueByPath(referenceObject, path);
}

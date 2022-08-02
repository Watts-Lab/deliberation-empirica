// this is normalized 0 - 1 and corrects reverse coding in the falling apart question
export function scoreFunc(responses) {
  const minScore = 1 * 6;
  const maxScore = 5 * 6;

  const rawScore = (parseInt(responses['team-viability']['capable unit'])
    + parseInt(responses['team-viability']['future success'])
    + 6 - parseInt(responses['team-viability']['falling apart'])
    + parseInt(responses['team-viability']['welcome reunion'])
    + parseInt(responses['team-viability']['persist despite obstacles'])
    + parseInt(responses['team-viability']['succeed dispite dislike'])
  );

  const result = {
    rawScore,
    normScore: (rawScore - minScore) / (maxScore - minScore),
  };

  return result;
}

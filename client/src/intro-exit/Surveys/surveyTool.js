function surveyScore(result) {
    const maxScore = 70
    const minScore = 14
 
    var rawScore = 0; 
    for (var i in result) {
        rawScore += parseInt(result[i])
    }
    // rawScore = sum(result.items)  // or something that actually works
    const normScore = (rawScore - minScore)/(maxScore-minScore)
 
    let scoreResult = {
        rawScore: rawScore,
        normScore: normScore
     };

     return scoreResult;
} 

export default function surveyTool(survey_blob, n_people, responses) {
    const score = surveyScore(Object.values((Object.values(responses)[0])))
    console.log(score)

    let record = {
        survey_blob: survey_blob,
        responses: responses,
        result: score,
        playerSource: "MTurk",
        numberOfPlayers: n_people
    };

    return record
}
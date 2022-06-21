// this is normalized 0 - 1 and corrects reverse coding in the falling apart question

export default function scoreFunc(responses) {
    const score = (parseInt(responses["team-viability"]["as a unit"])
        + parseInt(responses["team-viability"]["in the future"]) 
        + 6 - parseInt(responses["team-viability"]["falling apart"])
        + parseInt(responses["team-viability"]["welcome the opportunity"])
        + parseInt(responses["team-viability"]["persist"]) 
        + parseInt(responses["team-viability"]["do not like one another"])
        ); 
    const scaledScore = (score - 6)/ 24; 
    return scaledScore;
}
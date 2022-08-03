import { Loading, usePlayer, usePlayers, useRound, useStage } from '@empirica/player';
import React from 'react';
import { Discussion } from './pages/Discussion';
import { Topic } from './components/Topic';
import { TopicSurvey } from './pages/TopicSurvey';
import { TrainingVideo } from './pages/TrainingVideo';

export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const stage = useStage();
  const round = useRound();

  if (player.stage.get('submit')) {
    if (players.length === 1) {
      return <Loading />;
    }
    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other player(s).
      </div>
    );
  }

  if (stage.get('name') === 'Topic Survey') {
    return (
      <div className="flex flex-col items-center">
        <TopicSurvey />
      </div>
    );
  }
  if (stage.get('name') === 'TrainingVideo') {
    return <TrainingVideo />;
  }
  if (stage.get('name') === 'Icebreaker') {
    // TODO: put interventions in their own repo, and load them separately
    // Questions based loosely on:
    // Balietti, Stefano, Lise Getoor, Daniel G. Goldstein, and Duncan J. Watts. 2021.
    // “Reducing Opinion Polarization: Effects of Exposure to Similar People with Differing Political Views.”
    // Proceedings of the National Academy of Sciences of the United States of America
    // 118 (52). https://doi.org/10.1073/pnas.2112552118.
    const prompt = (
      <div>
        <h2 className="text-lg leading-7 font-medium text-gray-1000">
          Please identify several non-obvious things you have in common with others in your group.
        </h2>
        <p>For example:</p>
        <ul>
          <li>- your favorite color</li>
          <li>- places you have lived or visited</li>
          <li>- what sports you play or enjoy watching</li>
          <li>- what genre of books or movies you enjoy</li>
          <li>- how many siblings or children you have</li>
          <li>- etc...</li>
        </ul>
      </div>
    );
    return <Discussion prompt={prompt} />;
  }
  if (stage.get('name') === 'Discuss') {
    const prompt = (
      <div>
        <h2 className="text-md leading-6 text-gray-500">Please answer the following question as a group. </h2>
        <h3 className="text-sm leading-6 text-gray-500">(This is a shared question and the selected answer will update when anyone clicks.) </h3>
        <Topic topic={round.get('topic')} responseOwner={stage} submitButton={false} />
      </div>
    );
    return <Discussion prompt={prompt} />;
  }
}

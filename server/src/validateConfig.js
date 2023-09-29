// validate the batch configuration
//
// Todo:
// validate the github repos
// add embargo dates
// add completion code as parameter

export function validateConfig(config) {
  if (!config.batchName) {
    throw new Error(`No "batchName" specified in config`);
  }

  if (!config.treatmentFile) {
    throw new Error(`No "treatmentFile" specified in config`);
  }

  if (!config.treatments) {
    throw new Error(`No "treatments" specified in config`);
  }

  if (!config.launchDate) {
    console.log(`No "launchDate" specified in config, will not show countdown`);
  }

  if (!config.introSequence) {
    console.log(
      `No "introSequence" specified in config, will proceed to game after setup`
    );
  }

  if (!config.preregRepos) {
    console.log(
      `No "preregRepos" specified in config, this is optional. If you set preregister, then preregistration will still happen in the public deliberation-lab repository.`
    );
  }

  if (!config.dataRepos) {
    console.log(
      `No "dataRepos" specified in config, this is optional. If you set preregister, then data will still be pushed to the private deliberation-lab repository.`
    );
  }

  if (!config.preregister) {
    console.log(
      `No "preregister" specified in config, this is optional. If you set preregister, then data will be pushed to the private deliberation-lab repository.`
    );
  }

  if (config.checkVideo === undefined) {
    console.log(`No "checkVideo" specified in config, default to True.`);
  }

  if (config.checkAudio === undefined) {
    console.log(`No "checkAudio" specified in config, default to True.`);
  }

  if (
    config.checkVideo !== undefined &&
    typeof config.checkVideo !== "boolean"
  ) {
    throw new Error(`"checkVideo" must be true or false when specified`);
  }

  if (
    config.checkAudio !== undefined &&
    typeof config.checkAudio !== "boolean"
  ) {
    throw new Error(`"checkAudio" must be true or false when specified`);
  }

  if (!config.preregister && !config.dataRepos) {
    throw new Error(
      `Data will not be saved! Either specify a data repo or set preregister to true`
    );
  }

  if (!config.cdn) {
    console.log(`No "cdn" specified in config, defaulting to production cdn`);
  }

  if (config.launchDate) {
    try {
      const launchDate = Date.parse(config.launchDate);
      if (launchDate < Date.now()) {
        console.log("Launch date is in the past");
      }
    } catch (e) {
      throw new Error(`Failed to parse "launchDate"`, e);
    }
  }

  if (config.videoStorageLocation === undefined) {
    throw new Error(`No "videoStorageLocation" specified in config`);
  }

  if (config.videoStorageLocation === false) {
    console.log(`"videoStorageLocation" is "false", not saving video`);
  }

  // Todo: validate awsRegion as one of the list of valid regions

  const checkVideo = config?.checkVideo ?? true; // default to true if not specified
  const checkAudio = (config?.checkAudio ?? true) || checkVideo; // default to true if not specified, force true if checkVideo is true

  if ((checkVideo || checkAudio) && !config.videoStorageLocation) {
    throw new Error(
      `No "videoStorageLocation" specified in config, but you are using a video or audio description`
    );
  }
  // throw an error if videoStorageLocation is not set and checkVideo and checkAudio are not both false
  console.log("Config is valid: ", config);
}

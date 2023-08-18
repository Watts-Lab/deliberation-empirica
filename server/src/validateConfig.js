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

  if (!config.videoStorageLocation) {
    throw new Error(`No "videoStorageLocation" specified in config`);
  }
}

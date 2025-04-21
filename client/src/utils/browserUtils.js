export const detectBrowser = () => {
  const { userAgent } = navigator;
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) return "Chrome";
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return "Safari";
  if (/edg/i.test(userAgent)) return "Edge";
  return "Unknown";
};

export const checkMediaPermissions = async () => {
  try {
    const cameraPermission = await navigator.permissions.query({
      name: "camera",
    });
    const microphonePermission = await navigator.permissions.query({
      name: "microphone",
    });

    if (
      cameraPermission.state === "prompt" ||
      microphonePermission.state === "prompt"
    ) {
      return "prompt";
    }
    if (
      cameraPermission.state === "denied" ||
      microphonePermission.state === "denied"
    ) {
      return "denied";
    }
    if (
      cameraPermission.state === "granted" &&
      microphonePermission.state === "granted"
    ) {
      return "granted";
    }
    return "unknown";
  } catch (error) {
    console.error("Error checking media permissions", error);
    return "unknown";
  }
};

export const hasUserInteracted = async () => {
  // Check if the user has interacted with the page
  // If not, we won't be able to autoplay, or get camera/mic permissions

  try {
    const testAudio = new Audio("1sec_silence.mp3");
    await testAudio.play(); // If this succeeds, autoplay is allowed
    console.log("Autoplay is allowed");
    return true;
  } catch (error) {
    console.log("Autoplay is blocked");
    return false; // If it fails, autoplay is blocked (meaning no prior interaction)
  }
};

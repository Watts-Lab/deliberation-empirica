import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { Button } from "./Button";

// Context to allow child components to control whether idle is allowed
const IdleContext = createContext({
  allowIdle: false,
  setAllowIdle: () => {
    console.error("setAllowIdle used outside of IdleProvider");
  },
});

// Hook
const useIdle = (timeout) => {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef(null);

  const resetTimer = () => {
    setIsIdle(false);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      console.log("Player Idle");
      setIsIdle(true);
    }, timeout);
  };

  useEffect(() => {
    const activityEvents = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "focus",
      "blur",
      "touchstart",
      "touchmove",
    ];

    activityEvents.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );
    resetTimer();

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
      clearTimeout(timeoutRef.current);
    };
  }, [timeout]);

  return isIdle;
};

export function IdleProvider({
  children,
  timeout = 60000,
  chimeInterval = 30000,
}) {
  const [allowIdle, setAllowIdle] = useState(false);
  const [modalVisible, setModalVisible] = useState(false); // Controls modal visibility
  const isIdle = useIdle(timeout);
  const chimeTimerRef = useRef(null);

  const playChime = () => {
    const audio = new Audio("/counter_bell.mp3");
    audio.play().catch((error) => {
      console.error("Error playing chime:", error);
    });
  };

  useEffect(() => {
    if (isIdle && !allowIdle) {
      // Play the initial chime
      playChime();
      setModalVisible(true);

      // Start the timer for periodic chimes
      chimeTimerRef.current = setInterval(() => playChime(), chimeInterval);
    } else if (chimeTimerRef.current) {
      // Clear the timer if the user is no longer idle or idle is allowed
      clearInterval(chimeTimerRef.current);
      chimeTimerRef.current = null;
    }

    // Cleanup the timer when dependencies change or component unmounts
    return () => {
      if (chimeTimerRef.current) {
        clearInterval(chimeTimerRef.current);
        chimeTimerRef.current = null;
      }
    };
  }, [isIdle, allowIdle, chimeInterval]);

  // Memoize the context value to avoid unnecessary renders
  const contextValue = useMemo(
    () => ({ allowIdle, setAllowIdle }),
    [allowIdle]
  );

  const handleModalClose = () => {
    setModalVisible(false);
    console.log("Player returned to activity");
  };

  return (
    <IdleContext.Provider value={contextValue}>
      {children}
      {modalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-lg w-96 text-center">
            <h2>You seem idle... 😕</h2>
            <p className="mb-2">
              This is a multiplayer activity, and we don't want to keep others
              waiting.
            </p>
            <div className="flex justify-center">
              <Button handleClick={handleModalClose}>
                Return to the activity
              </Button>
            </div>
            <p>
              If you cannot participate, please close the window and return the
              study.
            </p>
          </div>
        </div>
      )}
    </IdleContext.Provider>
  );
}

export const useIdleContext = () => useContext(IdleContext);

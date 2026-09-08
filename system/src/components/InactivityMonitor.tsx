import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const DEFAULT_IDLE_LIMIT_MS = 20 * 60 * 1000;
const DEFAULT_WARNING_COUNTDOWN_S = 60;

export default function InactivityMonitor() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = useState(false);
  const [idleLimitMs, setIdleLimitMs] = useState(DEFAULT_IDLE_LIMIT_MS);
  const [warningCountdownS, setWarningCountdownS] = useState(DEFAULT_WARNING_COUNTDOWN_S);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WARNING_COUNTDOWN_S);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getSessionConfig()
      .then((r) => {
        setIdleLimitMs(r.inactivity_timeout_minutes * 60 * 1000);
        setWarningCountdownS(r.inactivity_warning_seconds);
      })
      .catch(() => {});
  }, [user]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(warningCountdownS);
    }, idleLimitMs);
  }, [idleLimitMs, warningCountdownS]);

  const handleLogout = useCallback(async () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setWarning(false);
    setSecondsLeft(warningCountdownS);
    await logout();
    navigate("/login");
  }, [logout, navigate, warningCountdownS]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    function handleActivity() {
      setWarning((currentlyWarning) => {
        if (!currentlyWarning) resetIdleTimer();
        return currentlyWarning;
      });
    }
    events.forEach((e) => window.addEventListener(e, handleActivity));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, resetIdleTimer]);

  useEffect(() => {
    if (!warning) return;
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          handleLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [warning, handleLogout]);

  function stayLoggedIn() {
    setWarning(false);
    resetIdleTimer();
  }

  if (!user || !warning) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface rounded-xl border border-border/10 p-6 max-w-sm w-full shadow-lg text-center">
        <h3 className="font-display text-lg font-semibold text-heading mb-2">Still there?</h3>
        <p className="text-sm text-body mb-5">
          You've been inactive for a while. For security, you'll be logged out in {secondsLeft} second
          {secondsLeft !== 1 ? "s" : ""} unless you stay signed in.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={handleLogout} className="text-sm text-body px-4 py-2 rounded-md hover:bg-surface-alt">
            Log out now
          </button>
          <button
            onClick={stayLoggedIn}
            className="text-sm font-medium text-white bg-brand-orange px-5 py-2 rounded-md hover:opacity-90"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  );
}

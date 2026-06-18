import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// 30 minutes of inactivity before auto-logout
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
// Show warning 60 seconds before timeout
const WARNING_BEFORE = 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [expiryCountdown, setExpiryCountdown] = useState(60);

  // Refs to keep timer callbacks fresh
  const inactivityRef = useRef(null);
  const warningIntervalRef = useRef(null);
  const logoutRef = useRef(null);

  const logout = useCallback(() => {
    // Clean up any lingering timers
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    setShowExpiryWarning(false);

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  // Keep a ref to the latest logout function
  logoutRef.current = logout;

  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }
    setShowExpiryWarning(false);

    // Start the inactivity countdown
    inactivityRef.current = setTimeout(() => {
      setShowExpiryWarning(true);

      // Start the 60-second warning countdown
      let remaining = 60;
      setExpiryCountdown(remaining);

      warningIntervalRef.current = setInterval(() => {
        remaining--;
        setExpiryCountdown(remaining);

        if (remaining <= 0) {
          if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
          if (logoutRef.current) {
            logoutRef.current();
            toast.error('Session expired due to inactivity', { id: 'session-expired' });
          }
        }
      }, 1000);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
  }, []);

  // Set up activity listeners when user is logged in
  useEffect(() => {
    if (!user) {
      // Clean up if not logged in
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      setShowExpiryWarning(false);
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'wheel'];
    const handleActivity = () => resetInactivityTimer();

    // Attach event listeners
    activityEvents.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    // Start the timer
    resetInactivityTimer();

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    };
  }, [user, resetInactivityTimer]);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { user: userData, token } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}!`);
    return userData;
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isDoctor = user?.role === 'DOCTOR';
  const isReceptionist = user?.role === 'RECEPTIONIST';

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, isAuthenticated, isAdmin, isDoctor, isReceptionist }}
    >
      {/* Inactivity warning banner */}
      {showExpiryWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3 text-sm text-amber-800 shadow-sm">
          <span>⏰</span>
          <span>
            Your session will expire in{' '}
            <strong>{expiryCountdown} second{expiryCountdown !== 1 ? 's' : ''}</strong>{' '}
            due to inactivity.
          </span>
          <button
            onClick={() => resetInactivityTimer()}
            className="ml-2 px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
          >
            Stay logged in
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

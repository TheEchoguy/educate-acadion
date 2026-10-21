/**
 * Tab-Isolated Session Storage Manager for ACADION
 * Ensures that multiple tabs/windows can be open concurrently with different user logins
 * (e.g. Teacher in Tab 1, Student in Tab 2) without their sessions colliding.
 */

export const getSessionItem = (key) => {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
};

export const setSessionItem = (key, value) => {
  if (value === null || value === undefined) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    // Remove from shared localStorage to prevent cross-tab session clobbering
    localStorage.removeItem(key);
  }
};

export const removeSessionItem = (key) => {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};

export const clearSession = () => {
  sessionStorage.clear();
  localStorage.clear();
};

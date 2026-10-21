import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("token") || localStorage.getItem("token");
    const storedRole = sessionStorage.getItem("role") || localStorage.getItem("role");

    if (storedToken) {
      setToken(storedToken);
      setRole(storedRole);
    }
  }, []);

  const login = (jwtToken, userRole) => {
    sessionStorage.setItem("token", jwtToken);
    sessionStorage.setItem("role", userRole);
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setToken(jwtToken);
    setRole(userRole);
  };

  const logout = () => {
    sessionStorage.clear();
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, role, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
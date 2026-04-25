// src/lib/auth.ts
import { createContext, useContext, useState } from 'react';

// Create a User Context for authentication
const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  return useContext(UserContext);
};

export const isAuthenticated = () => {
  const { user } = useUser();
  return !!user;
};

export const getUser = () => {
  const { user } = useUser();
  return user;
};

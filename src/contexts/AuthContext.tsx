import { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups } from '@/types/user';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  // Users
  allUsers: User[];
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  // Groups
  allGroups: UserGroup[];
  addGroup: (group: Omit<UserGroup, 'id' | 'createdAt'>) => void;
  updateGroup: (groupId: string, updates: Partial<UserGroup>) => void;
  deleteGroup: (groupId: string) => void;
  // Helper to get user rights from their group
  getUserRights: (user: User) => UserRights;
  getGroupById: (groupId: string) => UserGroup | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(hardcodedUsers);
  const [groups, setGroups] = useState<UserGroup[]>(hardcodedUserGroups);

  const login = (username: string, password: string): boolean => {
    const foundUser = users.find(
      (u) => u.username === username && u.password === password
    );
    if (foundUser) {
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  // User management
  const addUser = (newUser: Omit<User, 'id' | 'createdAt'>) => {
    const user: User = {
      ...newUser,
      id: `user-${Date.now()}`,
      createdAt: new Date(),
    };
    setUsers((prev) => [...prev, user]);
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    );
    if (user?.id === userId) {
      setUser((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const deleteUser = (userId: string) => {
    if (userId === user?.id) return; // Can't delete yourself
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  // Group management
  const addGroup = (newGroup: Omit<UserGroup, 'id' | 'createdAt'>) => {
    const group: UserGroup = {
      ...newGroup,
      id: `group-${Date.now()}`,
      createdAt: new Date(),
    };
    setGroups((prev) => [...prev, group]);
  };

  const updateGroup = (groupId: string, updates: Partial<UserGroup>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
    );
  };

  const deleteGroup = (groupId: string) => {
    // Check if any users are in this group
    const usersInGroup = users.filter((u) => u.groupId === groupId);
    if (usersInGroup.length > 0) return; // Can't delete group with users
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const getGroupById = (groupId: string) => {
    return groups.find((g) => g.id === groupId);
  };

  const getUserRights = (targetUser: User): UserRights => {
    const group = getGroupById(targetUser.groupId);
    if (!group) {
      // Return all 'no' if group not found
      return {
        posAccess: 'no',
        processRefunds: 'no',
        applyDiscounts: 'no',
        viewInventory: 'no',
        stockAdjustment: 'no',
        stockTake: 'no',
        addProduct: 'no',
        editProduct: 'no',
        deleteProduct: 'no',
        viewReports: 'no',
        exportData: 'no',
        manageUsers: 'no',
        manageSettings: 'no',
      };
    }
    return group.rights;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        allUsers: users,
        addUser,
        updateUser,
        deleteUser,
        allGroups: groups,
        addGroup,
        updateGroup,
        deleteGroup,
        getUserRights,
        getGroupById,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

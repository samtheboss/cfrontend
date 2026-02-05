import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups } from '@/types/user';
import { apiFetch } from '@/lib/api';
import { isTokenExpired, getTokenExpirationTime } from '@/lib/auth';

interface LoginResponse {
  message: string;
  token: string | null;
  data: {
    id: number;
    username: string;
    fullName: string;
    role: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
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

const mapBackendUserToFrontend = (backendUser: any): User => {
  return {
    id: String(backendUser.id),
    username: backendUser.username,
    password: '', // Don't store password in frontend state
    name: backendUser.fullName,
    email: `${backendUser.username}@example.com`, // Placeholder since backend doesn't have email yet
    groupId: backendUser.role === 'ADMIN' ? 'group-admin' : 'group-inventory',
    locationId: backendUser.locationId,
    createdAt: new Date(),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>(hardcodedUserGroups);
  interface ApiResponse<T> {
    title: string;
    message: string;
    data: T;
  }

  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const response = await apiFetch<ApiResponse<any[]>>('/api/auth/users12');
      const mappedUsers = response.data.map(mapBackendUserToFrontend);
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  useEffect(() => {
    let logoutTimer: NodeJS.Timeout;

    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        if (isTokenExpired(token)) {
          logout();
          setIsLoading(false);
          return;
        }

        try {
          setUser(JSON.parse(storedUser));
          await fetchUsers();

          // Set timer for proactive logout
          const expTime = getTokenExpirationTime(token);
          if (expTime) {
            const timeUntilExpiry = expTime - Date.now();
            if (timeUntilExpiry > 0) {
              logoutTimer = setTimeout(() => {
                logout();
                window.location.href = '/signin';
              }, timeUntilExpiry);
            }
          }
        } catch (e) {
          logout();
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (response.token && response.data) {
        const frontendUser = mapBackendUserToFrontend(response.data);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(frontendUser));
        setUser(frontendUser);
        await fetchUsers();

        // Trigger a reload or manually set the timer here if needed
        // For simplicity, we can just allow the page reload/navigation to trigger the useEffect above
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUsers([]);
  };

  // User management
  const addUser = async (newUser: Omit<User, 'id' | 'createdAt'>) => {
    try {
      await apiFetch<any>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          fullName: newUser.name,
          role: newUser.groupId === 'group-admin' ? 'ADMIN' : 'USER',
        }),
      });
      await fetchUsers();
    } catch (error) {
      console.error('Failed to add user:', error);
      throw error;
    }
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    );
    if (user?.id === userId) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
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
        isLoading,
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

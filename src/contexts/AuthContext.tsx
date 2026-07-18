import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups, defaultRights } from '@/types/user';
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
  getLandingPage: (user: User) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapBackendUserToFrontend = (backendUser: any): User => {
  return {
    id: String(backendUser.id),
    username: backendUser.username,
    password: '', // Don't store password in frontend state
    name: backendUser.fullName,
    email: backendUser.email,
    phoneNumber: backendUser.phoneNumber,
    groupId: backendUser.userGroupId || (backendUser.role === 'ADMIN' ? 'group-admin' : 'group-inventory'),
    locationId: backendUser.locationId,
    role: backendUser.role || 'USER',
    createdAt: new Date(),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  // Initialize groups state
  const [groups, setGroups] = useState<UserGroup[]>(hardcodedUserGroups);

  interface ApiResponse<T> {
    title: string;
    message: string;
    data: T;
  }

  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const response = await apiFetch<ApiResponse<any[]>>('/api/auth/users');
      const mappedUsers = response.data.map(mapBackendUserToFrontend);
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      // Fallback to empty if API fails
      setUsers([]);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await apiFetch<ApiResponse<UserGroup[]>>('/api/user-groups');
      if (response.data && Array.isArray(response.data)) {
        setGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      // Fallback to hardcoded groups if API fails (e.g., endpoint doesn't exist yet)
      setGroups(hardcodedUserGroups);
    }
  };

  useEffect(() => {
    let logoutTimer: ReturnType<typeof setTimeout>;

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
          await Promise.all([fetchUsers(), fetchGroups()]);

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

        // Refetch everything to ensure we have the latest rights
        await Promise.all([fetchUsers(), fetchGroups()]);

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
    setGroups(hardcodedUserGroups);
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
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          role: newUser.groupId === 'group-admin' ? 'ADMIN' : 'USER',
          // Backend should ideally take groupId directly now
          userGroupId: newUser.groupId
        }),
      });
      await fetchUsers();
    } catch (error) {
      console.error('Failed to add user:', error);
      throw error;
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...updates } : u))
    );
    if (user?.id === userId) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }

    // API Call
    try {
      const backendUpdates: any = { ...updates };
      if (updates.name !== undefined) backendUpdates.fullName = updates.name;
      if (updates.groupId !== undefined) backendUpdates.userGroupId = updates.groupId;

      await apiFetch(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(backendUpdates)
      });
    } catch (error) {
      console.error('Failed to update user on backend', error);
      // Revert if needed, or just let the next fetch fix it
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === user?.id) return;

    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  };

  // Group management
  const addGroup = async (newGroup: Omit<UserGroup, 'id' | 'createdAt'>) => {
    try {
      const response = await apiFetch<ApiResponse<UserGroup>>('/api/user-groups', {
        method: 'POST',
        body: JSON.stringify(newGroup),
      });

      // If backend returns the created group
      if (response.data) {
        setGroups((prev) => [...prev, response.data]);
      } else {
        // Fallback if backend doesn't return data (shouldn't happen in good API)
        await fetchGroups();
      }
    } catch (error) {
      console.error('Failed to add group:', error);
      throw error;
    }
  };

  const updateGroup = async (groupId: string, updates: Partial<UserGroup>) => {
    // Optimistic update for UI responsiveness
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
    );

    try {
      await apiFetch(`/api/user-groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Failed to update group:', error);
      // Re-fetch to revert changes if failed
      await fetchGroups();
      throw error;
    }
  };

  const deleteGroup = async (groupId: string) => {
    const usersInGroup = users.filter((u) => u.groupId === groupId && u.role !== 'CUSTOMER');
    if (usersInGroup.length > 0) return;

    try {
      await apiFetch(`/api/user-groups/${groupId}`, { method: 'DELETE' });
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (error) {
      console.error('Failed to delete group:', error);
      throw error;
    }
  };

  const getGroupById = (groupId: string) => {
    return groups.find((g) => g.id === groupId);
  };

  const getUserRights = (targetUser: User): UserRights => {
    // Override for 'admin' username to always have full access
    if (targetUser.username.toLowerCase() === 'admin') {
      return {
        viewDashboard: 'yes',
        exportDashboard: 'yes',
        viewCustomers: 'yes',
        createCustomer: 'yes',
        editCustomer: 'yes',
        deleteCustomer: 'yes',
        viewUsers: 'yes',
        createUser: 'yes',
        editUser: 'yes',
        deleteUser: 'yes',
        manageUserRoles: 'yes',
        viewProducts: 'yes',
        createProduct: 'yes',
        editProduct: 'yes',
        deleteProduct: 'yes',
        viewPayments: 'yes',
        processPayments: 'yes',
        viewOrders: 'yes',
        createOrder: 'yes',
        editOrder: 'yes',
        deleteOrder: 'yes',
        reprintReceipt: 'yes',
        paymentAccess: 'yes',
        viewInventory: 'yes',
        stockAdjustment: 'yes',
        stockTake: 'yes',
        manageRecipes: 'yes',
        managePurchasing: 'yes',
        viewReports: 'yes',
        viewSettings: 'yes',
        editSettings: 'yes',
        viewAccommodation: 'yes',
        manageAccommodation: 'yes',
        managePromotions: 'yes',
      };
    }

    const group = getGroupById(targetUser.groupId);
    // Return group rights or safe defaults
    return { ...defaultRights, ...(group?.rights || {}) };
  };

  const getLandingPage = (targetUser: User): string => {
    const rights = getUserRights(targetUser);

    // List of rights that grant access to distinct UI modules in the Dashboard Hub
    const uiModuleRights = [
      rights.viewDashboard,
      rights.viewAccommodation,
      rights.viewCustomers,
      rights.viewInventory,
      rights.stockTake,
      rights.stockAdjustment,
      rights.managePurchasing,
      rights.manageRecipes,
      rights.viewSettings,
      rights.viewUsers,
      rights.viewReports,
      rights.managePromotions,
      rights.viewProducts,
    ];

    const hasOtherModules = uiModuleRights.some(r => r !== 'no');

    // If the user ONLY has access to orders (POS) and no other modules,
    // take them straight to the POS screen so they bypass the hub.
    if (rights.viewOrders !== 'no' && !hasOtherModules) {
      return '/pos';
    }

    return '/';
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
        getLandingPage,
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

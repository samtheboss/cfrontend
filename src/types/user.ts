export type RightValue = 'yes' | 'no' | 'supervised';

export interface UserRights {
  // POS & Sales
  posAccess: RightValue;
  processRefunds: RightValue;
  applyDiscounts: RightValue;

  // Inventory
  viewInventory: RightValue;
  stockAdjustment: RightValue;
  stockTake: RightValue;

  // Products
  addProduct: RightValue;
  editProduct: RightValue;
  deleteProduct: RightValue;

  // Reports
  viewReports: RightValue;
  exportData: RightValue;

  // Admin
  manageUsers: RightValue;
  manageSettings: RightValue;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  rights: UserRights;
  createdAt: Date;
}

export interface User {
  id: string;
  username: string;
  password: string; // In real app, this would be hashed
  name: string;
  email: string;
  groupId: string; // Reference to user group
  locationId?: string; // Main location
  assignedLocations?: string[]; // Allowed locations
  createdAt: Date;
}

// Default rights (all no)
export const defaultRights: UserRights = {
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

// Hardcoded user groups
export const hardcodedUserGroups: UserGroup[] = [
  {
    id: 'group-admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    rights: {
      posAccess: 'yes',
      processRefunds: 'yes',
      applyDiscounts: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      addProduct: 'yes',
      editProduct: 'yes',
      deleteProduct: 'yes',
      viewReports: 'yes',
      exportData: 'yes',
      manageUsers: 'yes',
      manageSettings: 'yes',
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-manager',
    name: 'Store Manager',
    description: 'Manage inventory, sales, and staff operations',
    rights: {
      posAccess: 'yes',
      processRefunds: 'yes',
      applyDiscounts: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      addProduct: 'yes',
      editProduct: 'yes',
      deleteProduct: 'supervised',
      viewReports: 'yes',
      exportData: 'yes',
      manageUsers: 'supervised',
      manageSettings: 'supervised',
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-cashier',
    name: 'Cashier',
    description: 'Point of sale operations and basic inventory viewing',
    rights: {
      posAccess: 'yes',
      processRefunds: 'supervised',
      applyDiscounts: 'supervised',
      viewInventory: 'yes',
      stockAdjustment: 'no',
      stockTake: 'supervised',
      addProduct: 'no',
      editProduct: 'no',
      deleteProduct: 'no',
      viewReports: 'no',
      exportData: 'no',
      manageUsers: 'no',
      manageSettings: 'no',
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-inventory',
    name: 'Inventory Staff',
    description: 'Stock management and inventory operations',
    rights: {
      posAccess: 'no',
      processRefunds: 'no',
      applyDiscounts: 'no',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      addProduct: 'supervised',
      editProduct: 'yes',
      deleteProduct: 'no',
      viewReports: 'supervised',
      exportData: 'no',
      manageUsers: 'no',
      manageSettings: 'no',
    },
    createdAt: new Date('2024-01-01'),
  },
];

// Hardcoded users for development
export const hardcodedUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    email: 'admin@stockflow.com',
    groupId: 'group-admin',
    locationId: 'loc-1',
    assignedLocations: ['loc-1', 'loc-2'],
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    username: 'manager',
    password: 'manager123',
    name: 'Store Manager',
    email: 'manager@stockflow.com',
    groupId: 'group-manager',
    locationId: 'loc-1',
    assignedLocations: ['loc-1'],
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '3',
    username: 'cashier',
    password: 'cashier123',
    name: 'John Cashier',
    email: 'cashier@stockflow.com',
    groupId: 'group-cashier',
    locationId: 'loc-2',
    assignedLocations: ['loc-2'],
    createdAt: new Date('2024-02-01'),
  },
];

export const rightLabels: Record<keyof UserRights, string> = {
  posAccess: 'POS Access',
  processRefunds: 'Process Refunds',
  applyDiscounts: 'Apply Discounts',
  viewInventory: 'View Inventory',
  stockAdjustment: 'Stock Adjustment',
  stockTake: 'Stock Take',
  addProduct: 'Add Products',
  editProduct: 'Edit Products',
  deleteProduct: 'Delete Products',
  viewReports: 'View Reports',
  exportData: 'Export Data',
  manageUsers: 'Manage Users',
  manageSettings: 'Manage Settings',
};

export const rightCategories = {
  'POS & Sales': ['posAccess', 'processRefunds', 'applyDiscounts'] as (keyof UserRights)[],
  'Inventory': ['viewInventory', 'stockAdjustment', 'stockTake'] as (keyof UserRights)[],
  'Products': ['addProduct', 'editProduct', 'deleteProduct'] as (keyof UserRights)[],
  'Reports': ['viewReports', 'exportData'] as (keyof UserRights)[],
  'Administration': ['manageUsers', 'manageSettings'] as (keyof UserRights)[],
};

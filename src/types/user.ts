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

export interface User {
  id: string;
  username: string;
  password: string; // In real app, this would be hashed
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  rights: UserRights;
  createdAt: Date;
}

// Hardcoded users for development
export const hardcodedUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    email: 'admin@stockflow.com',
    role: 'admin',
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
    id: '2',
    username: 'manager',
    password: 'manager123',
    name: 'Store Manager',
    email: 'manager@stockflow.com',
    role: 'manager',
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
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '3',
    username: 'cashier',
    password: 'cashier123',
    name: 'John Cashier',
    email: 'cashier@stockflow.com',
    role: 'cashier',
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

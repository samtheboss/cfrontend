export type RightValue = 'yes' | 'no' | 'supervised';

export interface UserRights {
  // Dashboard
  viewDashboard: RightValue;
  exportDashboard: RightValue;

  // Customers (Window: VIEW_CUSTOMERS)
  viewCustomers: RightValue;
  createCustomer: RightValue;
  editCustomer: RightValue;
  deleteCustomer: RightValue;

  // Employees/Users (Window: VIEW_EMPLOYEES / USERS)
  viewUsers: RightValue;
  createUser: RightValue;
  editUser: RightValue;
  deleteUser: RightValue;
  manageUserRoles: RightValue; // USER_ROLES

  // Services / Products (Window: VIEW_SERVICES / PRODUCTS)
  viewProducts: RightValue;
  createProduct: RightValue;
  editProduct: RightValue;
  deleteProduct: RightValue;

  // Payments
  viewPayments: RightValue;
  processPayments: RightValue;

  // Orders / Sales (Window: ORDER_PROCESSING)
  viewOrders: RightValue; // POS Access
  createOrder: RightValue;
  editOrder: RightValue;
  deleteOrder: RightValue;
  reprintReceipt: RightValue;
  paymentAccess: RightValue; // Receive Order Payment

  // Inventory (Window: VIEW_INVENTORY - Not explicitly in list but implied for system)
  viewInventory: RightValue;
  stockAdjustment: RightValue;
  stockTake: RightValue;
  manageRecipes: RightValue;
  managePurchasing: RightValue;

  // Reports
  viewReports: RightValue;

  // Settings
  viewSettings: RightValue;
  editSettings: RightValue;
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
  phoneNumber?: string;
  groupId: string; // Reference to user group
  locationId?: string; // Main location
  assignedLocations?: string[]; // Allowed locations
  role: string;
  createdAt: Date;
}

// Default rights (all no)
export const defaultRights: UserRights = {
  viewDashboard: 'no',
  exportDashboard: 'no',
  viewCustomers: 'no',
  createCustomer: 'no',
  editCustomer: 'no',
  deleteCustomer: 'no',
  viewUsers: 'no',
  createUser: 'no',
  editUser: 'no',
  deleteUser: 'no',
  manageUserRoles: 'no',
  viewProducts: 'no',
  createProduct: 'no',
  editProduct: 'no',
  deleteProduct: 'no',
  viewPayments: 'no',
  processPayments: 'no',
  viewOrders: 'no',
  createOrder: 'no',
  editOrder: 'no',
  deleteOrder: 'no',
  reprintReceipt: 'no',
  paymentAccess: 'no',
  viewInventory: 'no',
  stockAdjustment: 'no',
  stockTake: 'no',
  manageRecipes: 'no',
  managePurchasing: 'no',
  viewReports: 'no',
  viewSettings: 'no',
  editSettings: 'no',
};

// Hardcoded user groups
export const hardcodedUserGroups: UserGroup[] = [
  {
    id: 'group-admin',
    name: 'Administrator',
    description: 'Full system access',
    rights: {
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
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-manager',
    name: 'Store Manager',
    description: 'Manage store operations',
    rights: {
      viewDashboard: 'yes',
      exportDashboard: 'yes',
      viewCustomers: 'yes',
      createCustomer: 'yes',
      editCustomer: 'yes',
      deleteCustomer: 'supervised',
      viewUsers: 'yes',
      createUser: 'yes',
      editUser: 'yes',
      deleteUser: 'no',
      manageUserRoles: 'no',
      viewProducts: 'yes',
      createProduct: 'yes',
      editProduct: 'yes',
      deleteProduct: 'supervised',
      viewPayments: 'yes',
      processPayments: 'yes',
      viewOrders: 'yes',
      createOrder: 'yes',
      editOrder: 'yes',
      deleteOrder: 'supervised',
      reprintReceipt: 'yes',
      paymentAccess: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      manageRecipes: 'yes',
      managePurchasing: 'yes',
      viewReports: 'yes',
      viewSettings: 'yes',
      editSettings: 'supervised',
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-cashier',
    name: 'Cashier',
    description: 'Process sales and payments',
    rights: {
      viewDashboard: 'yes',
      exportDashboard: 'no',
      viewCustomers: 'yes',
      createCustomer: 'yes',
      editCustomer: 'no',
      deleteCustomer: 'no',
      viewUsers: 'no',
      createUser: 'no',
      editUser: 'no',
      deleteUser: 'no',
      manageUserRoles: 'no',
      viewProducts: 'yes',
      createProduct: 'no',
      editProduct: 'no',
      deleteProduct: 'no',
      viewPayments: 'no',
      processPayments: 'yes',
      viewOrders: 'yes',
      createOrder: 'yes',
      editOrder: 'supervised',
      deleteOrder: 'no',
      reprintReceipt: 'yes',
      paymentAccess: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'no',
      stockTake: 'no',
      manageRecipes: 'no',
      managePurchasing: 'no',
      viewReports: 'no',
      viewSettings: 'no',
      editSettings: 'no',
    },
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'group-inventory',
    name: 'Inventory Staff',
    description: 'Manage stock and products',
    rights: {
      viewDashboard: 'yes',
      exportDashboard: 'no',
      viewCustomers: 'no',
      createCustomer: 'no',
      editCustomer: 'no',
      deleteCustomer: 'no',
      viewUsers: 'no',
      createUser: 'no',
      editUser: 'no',
      deleteUser: 'no',
      manageUserRoles: 'no',
      viewProducts: 'yes',
      createProduct: 'yes',
      editProduct: 'yes',
      deleteProduct: 'no',
      viewPayments: 'no',
      processPayments: 'no',
      viewOrders: 'no',
      createOrder: 'no',
      editOrder: 'no',
      deleteOrder: 'no',
      reprintReceipt: 'no',
      paymentAccess: 'no',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      manageRecipes: 'yes',
      managePurchasing: 'yes',
      viewReports: 'no',
      viewSettings: 'no',
      editSettings: 'no',
    },
    createdAt: new Date('2024-01-01'),
  }
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
    role: 'ADMIN',
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
    role: 'MANAGER',
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
    role: 'USER',
    createdAt: new Date('2024-02-01'),
  },
];

export const rightLabels: Record<keyof UserRights, string> = {
  viewDashboard: 'View Dashboard',
  exportDashboard: 'Export Dashboard Data',
  viewCustomers: 'View Customers',
  createCustomer: 'Add Customer',
  editCustomer: 'Edit Customer',
  deleteCustomer: 'Delete Customer',
  viewUsers: 'View Users/Employees',
  createUser: 'Add User',
  editUser: 'Edit User',
  deleteUser: 'Delete User',
  manageUserRoles: 'Manage User Roles',
  viewProducts: 'View Products/Services',
  createProduct: 'Add Product',
  editProduct: 'Edit Product',
  deleteProduct: 'Delete Product',
  viewPayments: 'View Payments Log',
  processPayments: 'Process Payment',
  viewOrders: 'View Orders / POS',
  createOrder: 'Create Order',
  editOrder: 'Edit Order',
  deleteOrder: 'Delete Order',
  reprintReceipt: 'Reprint Receipt',
  paymentAccess: 'Receive Order Payment',
  viewInventory: 'View Inventory',
  stockAdjustment: 'Stock Adjustment',
  stockTake: 'Stock Take',
  manageRecipes: 'Manage Recipes/Production',
  managePurchasing: 'Manage Purchasing/Suppliers',
  viewReports: 'View Reports',
  viewSettings: 'View Settings',
  editSettings: 'Modify Settings',
};

export const rightCategories: Record<string, (keyof UserRights)[]> = {
  'Dashboard': ['viewDashboard', 'exportDashboard'],
  'Orders & POS': ['viewOrders', 'createOrder', 'editOrder', 'deleteOrder', 'reprintReceipt', 'paymentAccess'],
  'Customers': ['viewCustomers', 'createCustomer', 'editCustomer', 'deleteCustomer'],
  'Products & Services': ['viewProducts', 'createProduct', 'editProduct', 'deleteProduct'],
  'Users & Employees': ['viewUsers', 'createUser', 'editUser', 'deleteUser', 'manageUserRoles'],
  'Inventory': ['viewInventory', 'stockAdjustment', 'stockTake', 'manageRecipes', 'managePurchasing'],
  'Payments': ['viewPayments', 'processPayments'],
  'Reports': ['viewReports'],
  'Settings': ['viewSettings', 'editSettings'],
};

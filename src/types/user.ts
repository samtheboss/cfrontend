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
  viewOnlineOrders: RightValue;
  viewAllOrders: RightValue;
  viewPastOrders: RightValue;
  createOrder: RightValue;
  editOrder: RightValue;
  deleteOrder: RightValue;
  returnOrder: RightValue;
  voidPrintedItem: RightValue; // Void an already-printed KOT line off an open bill (still needs supervisor approval)
  addToPrintedBill: RightValue; // Add items to an order whose customer bill was already printed ('supervised' = needs a supervisor password)
  reprintReceipt: RightValue;
  paymentAccess: RightValue; // Receive Order Payment

  // Table Orders (restaurant mode - Window: TABLE_ORDERS)
  viewTableOrders: RightValue;        // Open the Table Orders board
  editTableOrder: RightValue;         // Open a table order and add / change items
  receiveTableOrderPayment: RightValue; // Take payment against a table order
  transferTableOrder: RightValue;     // Move an order to another table
  mergeSplitTableOrders: RightValue;  // Merge tables / merge bills / split a bill

  // Invoicing & Customer Accounts (Windows: INVOICING / CUSTOMER_ACCOUNTS)
  viewInvoicing: RightValue;          // Open the Invoicing window
  createInvoice: RightValue;          // Create a cash sale or credit sale invoice
  invoiceReceivePayment: RightValue;  // Receive payment against a pending invoice
  invoiceReturn: RightValue;          // Process a return / credit note from Invoicing
  viewCustomerAccounts: RightValue;   // Open the Customer Accounts window
  manageCustomerLedger: RightValue;   // Post ledger entries (debit/credit note, opening balance)
  customerReceivePayment: RightValue; // Receive a payment / apply credit on a customer account
  viewRetailPrice: RightValue; // See Retail price in the invoicing item picker
  viewWholesalePrice: RightValue; // See Wholesale price in the invoicing item picker
  viewSpecialPrice: RightValue; // See Special price in the invoicing item picker
  viewTradePrice: RightValue; // See Trade price in the invoicing item picker
  viewCostPrice: RightValue; // See Cost price in the invoicing item picker
  viewItemStock: RightValue; // See stock levels in the invoicing item picker

  // Inventory (Window: VIEW_INVENTORY - Not explicitly in list but implied for system)
  viewInventory: RightValue;
  stockAdjustment: RightValue;
  stockTake: RightValue;
  manageRecipes: RightValue;
  managePurchasing: RightValue;

  // Reports
  viewReports: RightValue;

  // Accommodation
  viewAccommodation: RightValue;
  manageAccommodation: RightValue;

  // Properties / PMS
  viewProperties: RightValue;
  manageProperties: RightValue;

  // Promotions
  managePromotions: RightValue;

  // Settings
  viewSettings: RightValue;
  editSettings: RightValue;

  // Payment Override & Restrictions
  changePaymentAccount: RightValue;
  posReceiveCash: RightValue;
  posReceiveBank: RightValue;
  posReceiveMobile: RightValue;
  propertyReceiveCash: RightValue;
  propertyReceiveBank: RightValue;
  propertyReceiveMobile: RightValue;
  accommodationReceiveCash: RightValue;
  accommodationReceiveBank: RightValue;
  accommodationReceiveMobile: RightValue;
  expenseReceiveCash: RightValue;
  expenseReceiveBank: RightValue;
  expenseReceiveMobile: RightValue;
  purchaseReceiveCash: RightValue;
  purchaseReceiveBank: RightValue;
  purchaseReceiveMobile: RightValue;
  posReceiveComplimentary: RightValue;
  propertyReceiveComplimentary: RightValue;
  accommodationReceiveComplimentary: RightValue;
  expenseReceiveComplimentary: RightValue;
  purchaseReceiveComplimentary: RightValue;
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
  viewOnlineOrders: 'no',
  viewAllOrders: 'no',
  viewPastOrders: 'no',
  createOrder: 'no',
  editOrder: 'no',
  deleteOrder: 'no',
  returnOrder: 'no',
  voidPrintedItem: 'no',
  addToPrintedBill: 'no',
  reprintReceipt: 'no',
  paymentAccess: 'no',
  viewTableOrders: 'no',
  editTableOrder: 'no',
  receiveTableOrderPayment: 'no',
  transferTableOrder: 'no',
  mergeSplitTableOrders: 'no',
  viewInvoicing: 'no',
  createInvoice: 'no',
  invoiceReceivePayment: 'no',
  invoiceReturn: 'no',
  viewCustomerAccounts: 'no',
  manageCustomerLedger: 'no',
  customerReceivePayment: 'no',
  viewRetailPrice: 'no',
  viewWholesalePrice: 'no',
  viewSpecialPrice: 'no',
  viewTradePrice: 'no',
  viewCostPrice: 'no',
  viewItemStock: 'no',
  viewInventory: 'no',
  stockAdjustment: 'no',
  stockTake: 'no',
  manageRecipes: 'no',
  managePurchasing: 'no',
  viewReports: 'no',
  viewAccommodation: 'no',
  manageAccommodation: 'no',
  viewProperties: 'no',
  manageProperties: 'no',
  managePromotions: 'no',
  viewSettings: 'no',
  editSettings: 'no',
  changePaymentAccount: 'no',
  posReceiveCash: 'no',
  posReceiveBank: 'no',
  posReceiveMobile: 'no',
  propertyReceiveCash: 'no',
  propertyReceiveBank: 'no',
  propertyReceiveMobile: 'no',
  accommodationReceiveCash: 'no',
  accommodationReceiveBank: 'no',
  accommodationReceiveMobile: 'no',
  expenseReceiveCash: 'no',
  expenseReceiveBank: 'no',
  expenseReceiveMobile: 'no',
  purchaseReceiveCash: 'no',
  purchaseReceiveBank: 'no',
  purchaseReceiveMobile: 'no',
  posReceiveComplimentary: 'no',
  propertyReceiveComplimentary: 'no',
  accommodationReceiveComplimentary: 'no',
  expenseReceiveComplimentary: 'no',
  purchaseReceiveComplimentary: 'no',
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
      viewOnlineOrders: 'yes',
      viewAllOrders: 'yes',
      viewPastOrders: 'yes',
      createOrder: 'yes',
      editOrder: 'yes',
      deleteOrder: 'yes',
      returnOrder: 'yes',
      voidPrintedItem: 'yes',
      addToPrintedBill: 'yes',
      reprintReceipt: 'yes',
      paymentAccess: 'yes',
      viewTableOrders: 'yes',
      editTableOrder: 'yes',
      receiveTableOrderPayment: 'yes',
      transferTableOrder: 'yes',
      mergeSplitTableOrders: 'yes',
      viewInvoicing: 'yes',
      createInvoice: 'yes',
      invoiceReceivePayment: 'yes',
      invoiceReturn: 'yes',
      viewCustomerAccounts: 'yes',
      manageCustomerLedger: 'yes',
      customerReceivePayment: 'yes',
      viewRetailPrice: 'yes',
      viewWholesalePrice: 'yes',
      viewSpecialPrice: 'yes',
      viewTradePrice: 'yes',
      viewCostPrice: 'yes',
      viewItemStock: 'yes',
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
      viewProperties: 'yes',
      manageProperties: 'yes',
      managePromotions: 'yes',
      changePaymentAccount: 'yes',
      posReceiveCash: 'yes',
      posReceiveBank: 'yes',
      posReceiveMobile: 'yes',
      propertyReceiveCash: 'yes',
      propertyReceiveBank: 'yes',
      propertyReceiveMobile: 'yes',
      accommodationReceiveCash: 'yes',
      accommodationReceiveBank: 'yes',
      accommodationReceiveMobile: 'yes',
      expenseReceiveCash: 'yes',
      expenseReceiveBank: 'yes',
      expenseReceiveMobile: 'yes',
      purchaseReceiveCash: 'yes',
      purchaseReceiveBank: 'yes',
      purchaseReceiveMobile: 'yes',
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
      viewOnlineOrders: 'yes',
      viewAllOrders: 'yes',
      viewPastOrders: 'yes',
      createOrder: 'yes',
      editOrder: 'yes',
      deleteOrder: 'supervised',
      returnOrder: 'supervised',
      voidPrintedItem: 'yes',
      addToPrintedBill: 'yes',
      reprintReceipt: 'yes',
      paymentAccess: 'yes',
      viewTableOrders: 'yes',
      editTableOrder: 'yes',
      receiveTableOrderPayment: 'yes',
      transferTableOrder: 'yes',
      mergeSplitTableOrders: 'yes',
      viewInvoicing: 'yes',
      createInvoice: 'yes',
      invoiceReceivePayment: 'yes',
      invoiceReturn: 'yes',
      viewCustomerAccounts: 'yes',
      manageCustomerLedger: 'yes',
      customerReceivePayment: 'yes',
      viewRetailPrice: 'yes',
      viewWholesalePrice: 'yes',
      viewSpecialPrice: 'yes',
      viewTradePrice: 'yes',
      viewCostPrice: 'yes',
      viewItemStock: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      manageRecipes: 'yes',
      managePurchasing: 'yes',
      viewReports: 'yes',
      viewSettings: 'yes',
      editSettings: 'supervised',
      viewAccommodation: 'yes',
      manageAccommodation: 'yes',
      viewProperties: 'yes',
      manageProperties: 'yes',
      managePromotions: 'yes',
      changePaymentAccount: 'supervised',
      posReceiveCash: 'yes',
      posReceiveBank: 'yes',
      posReceiveMobile: 'yes',
      propertyReceiveCash: 'yes',
      propertyReceiveBank: 'yes',
      propertyReceiveMobile: 'yes',
      accommodationReceiveCash: 'yes',
      accommodationReceiveBank: 'yes',
      accommodationReceiveMobile: 'yes',
      expenseReceiveCash: 'yes',
      expenseReceiveBank: 'yes',
      expenseReceiveMobile: 'yes',
      purchaseReceiveCash: 'yes',
      purchaseReceiveBank: 'yes',
      purchaseReceiveMobile: 'yes',
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
      viewOnlineOrders: 'no',
      viewAllOrders: 'no',
      viewPastOrders: 'no',
      createOrder: 'yes',
      editOrder: 'supervised',
      deleteOrder: 'no',
      returnOrder: 'no',
      voidPrintedItem: 'no',
      addToPrintedBill: 'no',
      reprintReceipt: 'yes',
      paymentAccess: 'yes',
      viewTableOrders: 'yes',
      editTableOrder: 'yes',
      receiveTableOrderPayment: 'yes',
      transferTableOrder: 'no',
      mergeSplitTableOrders: 'no',
      viewInvoicing: 'yes',
      createInvoice: 'yes',
      invoiceReceivePayment: 'yes',
      invoiceReturn: 'no',
      viewCustomerAccounts: 'yes',
      manageCustomerLedger: 'no',
      customerReceivePayment: 'yes',
      viewRetailPrice: 'yes',
      viewWholesalePrice: 'yes',
      viewSpecialPrice: 'no',
      viewTradePrice: 'no',
      viewCostPrice: 'no',
      viewItemStock: 'no',
      viewInventory: 'yes',
      stockAdjustment: 'no',
      stockTake: 'no',
      manageRecipes: 'no',
      managePurchasing: 'no',
      viewReports: 'no',
      viewSettings: 'no',
      editSettings: 'no',
      viewAccommodation: 'no',
      manageAccommodation: 'no',
      viewProperties: 'no',
      manageProperties: 'no',
      managePromotions: 'no',
      changePaymentAccount: 'no',
      posReceiveCash: 'yes',
      posReceiveBank: 'yes',
      posReceiveMobile: 'yes',
      propertyReceiveCash: 'no',
      propertyReceiveBank: 'no',
      propertyReceiveMobile: 'no',
      accommodationReceiveCash: 'no',
      accommodationReceiveBank: 'no',
      accommodationReceiveMobile: 'no',
      expenseReceiveCash: 'no',
      expenseReceiveBank: 'no',
      expenseReceiveMobile: 'no',
      purchaseReceiveCash: 'no',
      purchaseReceiveBank: 'no',
      purchaseReceiveMobile: 'no',
      posReceiveComplimentary: 'yes',
      propertyReceiveComplimentary: 'no',
      accommodationReceiveComplimentary: 'no',
      expenseReceiveComplimentary: 'no',
      purchaseReceiveComplimentary: 'no',
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
      viewOnlineOrders: 'no',
      viewAllOrders: 'no',
      viewPastOrders: 'no',
      createOrder: 'no',
      editOrder: 'no',
      deleteOrder: 'no',
      returnOrder: 'no',
      voidPrintedItem: 'no',
      addToPrintedBill: 'no',
      reprintReceipt: 'no',
      paymentAccess: 'no',
      viewTableOrders: 'no',
      editTableOrder: 'no',
      receiveTableOrderPayment: 'no',
      transferTableOrder: 'no',
      mergeSplitTableOrders: 'no',
      viewInvoicing: 'no',
      createInvoice: 'no',
      invoiceReceivePayment: 'no',
      invoiceReturn: 'no',
      viewCustomerAccounts: 'no',
      manageCustomerLedger: 'no',
      customerReceivePayment: 'no',
      viewRetailPrice: 'no',
      viewWholesalePrice: 'no',
      viewSpecialPrice: 'no',
      viewTradePrice: 'no',
      viewCostPrice: 'no',
      viewItemStock: 'yes',
      viewInventory: 'yes',
      stockAdjustment: 'yes',
      stockTake: 'yes',
      manageRecipes: 'yes',
      managePurchasing: 'yes',
      viewReports: 'no',
      viewSettings: 'no',
      editSettings: 'no',
      viewAccommodation: 'no',
      manageAccommodation: 'no',
      viewProperties: 'no',
      manageProperties: 'no',
      managePromotions: 'no',
      changePaymentAccount: 'no',
      posReceiveCash: 'no',
      posReceiveBank: 'no',
      posReceiveMobile: 'no',
      propertyReceiveCash: 'no',
      propertyReceiveBank: 'no',
      propertyReceiveMobile: 'no',
      accommodationReceiveCash: 'no',
      accommodationReceiveBank: 'no',
      accommodationReceiveMobile: 'no',
      expenseReceiveCash: 'no',
      expenseReceiveBank: 'no',
      expenseReceiveMobile: 'no',
      purchaseReceiveCash: 'no',
      purchaseReceiveBank: 'no',
      purchaseReceiveMobile: 'no',
      posReceiveComplimentary: 'no',
      propertyReceiveComplimentary: 'no',
      accommodationReceiveComplimentary: 'no',
      expenseReceiveComplimentary: 'no',
      purchaseReceiveComplimentary: 'no',
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
  viewOnlineOrders: 'View Online Orders',
  viewAllOrders: 'View All Users Orders',
  viewPastOrders: 'View Past Orders',
  createOrder: 'Create Order',
  editOrder: 'Edit Order',
  deleteOrder: 'Delete Order',
  returnOrder: 'Return Order',
  voidPrintedItem: 'Void Printed KOT Item',
  addToPrintedBill: 'Add Items to a Printed Bill',
  reprintReceipt: 'Reprint Receipt',
  paymentAccess: 'Receive Order Payment',
  viewTableOrders: 'Table Orders: View Board',
  editTableOrder: 'Table Orders: Add / Edit Items',
  receiveTableOrderPayment: 'Table Orders: Receive Payment',
  transferTableOrder: 'Table Orders: Transfer Table',
  mergeSplitTableOrders: 'Table Orders: Merge & Split',
  viewInvoicing: 'Invoicing: Open Window',
  createInvoice: 'Invoicing: Create Cash Sale / Invoice',
  invoiceReceivePayment: 'Invoicing: Receive Payment',
  invoiceReturn: 'Invoicing: Process Return / Credit Note',
  viewCustomerAccounts: 'Customer Accounts: Open Window',
  manageCustomerLedger: 'Customer Accounts: Post Ledger Entries',
  customerReceivePayment: 'Customer Accounts: Receive Payment',
  viewRetailPrice: 'View Retail Price',
  viewWholesalePrice: 'View Wholesale Price',
  viewSpecialPrice: 'View Special Price',
  viewTradePrice: 'View Trade Price',
  viewCostPrice: 'View Cost Price',
  viewItemStock: 'View Item Stock Levels',
  viewInventory: 'View Inventory',
  stockAdjustment: 'Stock Adjustment',
  stockTake: 'Stock Take',
  manageRecipes: 'Manage Recipes/Production',
  managePurchasing: 'Manage Purchasing/Suppliers',
  viewReports: 'View Reports',
  viewAccommodation: 'View Accommodation',
  manageAccommodation: 'Manage Accommodation',
  viewProperties: 'View Properties/PMS',
  manageProperties: 'Manage Properties/PMS',
  managePromotions: 'Manage Promotions',
  viewSettings: 'View Settings',
  editSettings: 'Modify Settings',
  changePaymentAccount: 'Change Payment Account Override',
  posReceiveCash: 'POS: Receive Cash',
  posReceiveBank: 'POS: Receive Bank/Card',
  posReceiveMobile: 'POS: Receive Mobile Money',
  propertyReceiveCash: 'Property: Receive Cash',
  propertyReceiveBank: 'Property: Receive Bank/Card',
  propertyReceiveMobile: 'Property: Receive Mobile Money',
  accommodationReceiveCash: 'Accommodation: Receive Cash',
  accommodationReceiveBank: 'Accommodation: Receive Bank/Card',
  accommodationReceiveMobile: 'Accommodation: Receive Mobile Money',
  expenseReceiveCash: 'Expenses: Pay Cash',
  expenseReceiveBank: 'Expenses: Pay Bank/Card',
  expenseReceiveMobile: 'Expenses: Pay Mobile Money',
  purchaseReceiveCash: 'Purchasing: Pay Cash',
  purchaseReceiveBank: 'Purchasing: Pay Bank/Card',
  purchaseReceiveMobile: 'Purchasing: Pay Mobile Money',
  posReceiveComplimentary: 'POS: Receive Complimentary',
  propertyReceiveComplimentary: 'Property: Receive Complimentary',
  accommodationReceiveComplimentary: 'Accommodation: Receive Complimentary',
  expenseReceiveComplimentary: 'Expenses: Pay Complimentary',
  purchaseReceiveComplimentary: 'Purchasing: Pay Complimentary',
};

export const rightDescriptions: Partial<Record<keyof UserRights, string>> = {
  viewDashboard: 'Access the main dashboard and summary metrics',
  exportDashboard: 'Download dashboard data to CSV/Excel',
  viewCustomers: 'View the list of all registered customers',
  createCustomer: 'Add new customers to the system',
  editCustomer: 'Modify existing customer information',
  deleteCustomer: 'Permanently remove a customer',
  viewUsers: 'View the list of staff and employees',
  createUser: 'Add new staff members to the system',
  editUser: 'Modify existing staff information',
  deleteUser: 'Remove a staff member from the system',
  manageUserRoles: 'Assign and modify user groups and permissions',
  viewProducts: 'View the catalog of products and services',
  createProduct: 'Add new products or services to the catalog',
  editProduct: 'Update prices and details of products',
  deleteProduct: 'Remove products from the catalog',
  viewPayments: 'View the history of all received payments',
  processPayments: 'Ability to accept and process payments',
  viewOrders: 'Access the Point of Sale and view orders',
  viewOnlineOrders: 'View orders placed online',
  viewAllOrders: 'View orders created by all users',
  viewPastOrders: 'Access historical order data',
  createOrder: 'Create new orders in the POS',
  editOrder: 'Modify existing active orders',
  deleteOrder: 'Cancel or delete an order',
  returnOrder: 'Process returns and refunds for orders',
  voidPrintedItem: 'Remove an already-printed KOT line from an open bill (restores stock, still requires a supervisor password)',
  addToPrintedBill: "Add items to an order after its customer bill was printed. 'no' blocks it, 'supervised' asks for a supervisor password. The bill is marked un-printed so it gets re-printed.",
  reprintReceipt: 'Print duplicate receipts for past orders',
  paymentAccess: 'Ability to finalize an order and receive payment',
  viewTableOrders: 'Open the Table Orders board and see open bills per table',
  editTableOrder: 'Open a table order in the POS and add or change items',
  receiveTableOrderPayment: 'Take full or partial payment against a table order',
  transferTableOrder: 'Move an open order from one table to another',
  mergeSplitTableOrders: 'Merge tables, combine several bills into one, or split a bill',
  viewInvoicing: 'Open the desktop Invoicing window for cash sales and credit invoices',
  createInvoice: 'Create a new cash sale or credit sale invoice',
  invoiceReceivePayment: 'Receive full or partial payment against a pending invoice',
  invoiceReturn: 'Process a return / credit note against an existing invoice',
  viewCustomerAccounts: 'Open the Customer Accounts window — balances, statements, ledger',
  manageCustomerLedger: 'Post manual ledger entries: debit notes, credit notes, opening balances',
  customerReceivePayment: 'Receive a payment or apply a credit note on a customer account',
  viewRetailPrice: 'See the Retail price column when selecting items in Invoicing',
  viewWholesalePrice: 'See the Wholesale price column when selecting items in Invoicing',
  viewSpecialPrice: 'See the Special price column when selecting items in Invoicing',
  viewTradePrice: 'See the Trade price column when selecting items in Invoicing',
  viewCostPrice: 'See the Cost price column when selecting items in Invoicing',
  viewItemStock: 'See stock levels when selecting items in Invoicing',
  viewInventory: 'View current stock levels and inventory',
  stockAdjustment: 'Adjust stock levels manually for discrepancies',
  stockTake: 'Perform full physical stock counting',
  manageRecipes: 'Create and modify manufacturing recipes',
  managePurchasing: 'Manage suppliers and purchase orders',
  viewReports: 'Access system reports and analytics',
  viewAccommodation: 'View hotel/accommodation bookings',
  manageAccommodation: 'Create and edit accommodation bookings',
  viewProperties: 'View properties in the rent collection module',
  manageProperties: 'Manage properties, tenants, and rent',
  managePromotions: 'Create and edit discounts and promotions',
  viewSettings: 'View system configuration',
  editSettings: 'Modify system configuration and preferences',
};

export const rightCategories: Record<string, (keyof UserRights)[]> = {
  'Dashboard': ['viewDashboard', 'exportDashboard'],
  'Orders & POS': ['viewOrders', 'viewOnlineOrders', 'viewAllOrders', 'viewPastOrders', 'createOrder', 'editOrder', 'deleteOrder', 'returnOrder', 'voidPrintedItem', 'addToPrintedBill', 'reprintReceipt', 'paymentAccess', 'viewRetailPrice', 'viewWholesalePrice', 'viewSpecialPrice', 'viewTradePrice', 'viewCostPrice', 'viewItemStock'],
  'Table Orders': ['viewTableOrders', 'editTableOrder', 'receiveTableOrderPayment', 'transferTableOrder', 'mergeSplitTableOrders'],
  'Invoicing & Accounts': ['viewInvoicing', 'createInvoice', 'invoiceReceivePayment', 'invoiceReturn', 'viewCustomerAccounts', 'manageCustomerLedger', 'customerReceivePayment'],
  'Customers': ['viewCustomers', 'createCustomer', 'editCustomer', 'deleteCustomer'],
  'Products & Services': ['viewProducts', 'createProduct', 'editProduct', 'deleteProduct'],
  'Users & Employees': ['viewUsers', 'createUser', 'editUser', 'deleteUser', 'manageUserRoles'],
  'Inventory': ['viewInventory', 'stockAdjustment', 'stockTake', 'manageRecipes', 'managePurchasing'],
  'Payments': ['viewPayments', 'processPayments', 'changePaymentAccount', 'posReceiveCash', 'posReceiveBank', 'posReceiveMobile', 'posReceiveComplimentary', 'propertyReceiveCash', 'propertyReceiveBank', 'propertyReceiveMobile', 'propertyReceiveComplimentary', 'accommodationReceiveCash', 'accommodationReceiveBank', 'accommodationReceiveMobile', 'accommodationReceiveComplimentary', 'expenseReceiveCash', 'expenseReceiveBank', 'expenseReceiveMobile', 'expenseReceiveComplimentary', 'purchaseReceiveCash', 'purchaseReceiveBank', 'purchaseReceiveMobile', 'purchaseReceiveComplimentary'],
  'Reports': ['viewReports'],
  'Accommodation': ['viewAccommodation', 'manageAccommodation'],
  'Property Management': ['viewProperties', 'manageProperties'],
  'Promotions': ['managePromotions'],
  'Settings': ['viewSettings', 'editSettings'],
};

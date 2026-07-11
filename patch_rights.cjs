const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/types/user.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Interface
content = content.replace(
  /  viewReports: RightValue;\r?\n/,
  "  viewReports: RightValue;\n\n  // Accommodation\n  viewAccommodation: RightValue;\n  manageAccommodation: RightValue;\n\n  // Promotions\n  managePromotions: RightValue;\n"
);

// 2. defaultRights
content = content.replace(
  /  viewReports: 'no',\r?\n/,
  "  viewReports: 'no',\n  viewAccommodation: 'no',\n  manageAccommodation: 'no',\n  managePromotions: 'no',\n"
);

// 3. hardcodedUserGroups admin
content = content.replace(
  /      viewReports: 'yes',\r?\n      viewSettings: 'yes',\r?\n      editSettings: 'yes',\r?\n    \},\r?\n    createdAt: new Date\('2024-01-01'\),/,
  "      viewReports: 'yes',\n      viewSettings: 'yes',\n      editSettings: 'yes',\n      viewAccommodation: 'yes',\n      manageAccommodation: 'yes',\n      managePromotions: 'yes',\n    },\n    createdAt: new Date('2024-01-01'),"
);

// manager
content = content.replace(
  /      viewReports: 'yes',\r?\n      viewSettings: 'yes',\r?\n      editSettings: 'supervised',\r?\n    \},\r?\n    createdAt: new Date\('2024-01-01'\),/,
  "      viewReports: 'yes',\n      viewSettings: 'yes',\n      editSettings: 'supervised',\n      viewAccommodation: 'yes',\n      manageAccommodation: 'yes',\n      managePromotions: 'yes',\n    },\n    createdAt: new Date('2024-01-01'),"
);

// cashier
content = content.replace(
  /      viewReports: 'no',\r?\n      viewSettings: 'no',\r?\n      editSettings: 'no',\r?\n    \},\r?\n    createdAt: new Date\('2024-01-01'\),/,
  "      viewReports: 'no',\n      viewSettings: 'no',\n      editSettings: 'no',\n      viewAccommodation: 'no',\n      manageAccommodation: 'no',\n      managePromotions: 'no',\n    },\n    createdAt: new Date('2024-01-01'),"
);

// inventory (this matches the 4th occurrence of 'no', 'no', 'no' theoretically but the regex match is exact on the date so it should be fine. Actually cashier and inventory have the exact same tail in the string.
// Let's just do a global replace for the cashier/inventory tail. Wait, no, they have different groups. I'll just use a safer replace for all occurrences in the groups array that don't have the new rights.

content = content.replace(
  /      viewReports: 'no',\r?\n      viewSettings: 'no',\r?\n      editSettings: 'no',\r?\n    \},\r?\n    createdAt: new Date\('2024-01-01'\),/g,
  "      viewReports: 'no',\n      viewSettings: 'no',\n      editSettings: 'no',\n      viewAccommodation: 'no',\n      manageAccommodation: 'no',\n      managePromotions: 'no',\n    },\n    createdAt: new Date('2024-01-01'),"
);

// 4. rightLabels
content = content.replace(
  /  viewReports: 'View Reports',\r?\n/,
  "  viewReports: 'View Reports',\n  viewAccommodation: 'View Accommodation',\n  manageAccommodation: 'Manage Accommodation',\n  managePromotions: 'Manage Promotions',\n"
);

// 5. rightCategories
content = content.replace(
  /'Reports': \['viewReports'\],\r?\n/,
  "'Reports': ['viewReports'],\n  'Accommodation': ['viewAccommodation', 'manageAccommodation'],\n  'Promotions': ['managePromotions'],\n"
);

fs.writeFileSync(path, content);
console.log('Patched user.ts successfully');

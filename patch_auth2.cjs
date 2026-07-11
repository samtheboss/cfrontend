const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/contexts/AuthContext.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add defaultRights to import
content = content.replace(
  /import \{ User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups \} from '@\/types\/user';/,
  "import { User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups, defaultRights } from '@/types/user';"
);

// 2. Update Admin Override
content = content.replace(
  /        stockTake: 'yes',\r?\n        viewReports: 'yes',\r?\n        viewSettings: 'yes',\r?\n        editSettings: 'yes',\r?\n      \};\r?\n    \}/,
  "        stockTake: 'yes',\n        manageRecipes: 'yes',\n        managePurchasing: 'yes',\n        viewReports: 'yes',\n        viewSettings: 'yes',\n        editSettings: 'yes',\n        viewAccommodation: 'yes',\n        manageAccommodation: 'yes',\n        managePromotions: 'yes',\n      };\n    }"
);

// 3. Safe merge with defaultRights
content = content.replace(
  /    \/\/ Return group rights or safe defaults\r?\n    return group\?\.rights \|\| \{[\s\S]*?editSettings: 'no',\r?\n    \};\r?\n  \};\r?\n\r?\n  const getLandingPage/,
  "    // Return group rights or safe defaults\n    return { ...defaultRights, ...(group?.rights || {}) };\n  };\n\n  const getLandingPage"
);

// 4. Update getLandingPage to just return '/'
content = content.replace(
  /  const getLandingPage = \(targetUser: User\): string => \{[\s\S]*?return '\/'; \/\/ Final fallback\r?\n  \};\r?\n\r?\n  return \(/,
  "  const getLandingPage = (targetUser: User): string => {\n    // Always land on the module selection hub so users with multiple rights can choose where to go.\n    return '/';\n  };\n\n  return ("
);

fs.writeFileSync(path, content);
console.log('Patched AuthContext.tsx successfully (Take 2)');

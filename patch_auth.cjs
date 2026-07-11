const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/contexts/AuthContext.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Admin Override
content = content.replace(
  /        stockTake: 'yes',\r?\n        viewReports: 'yes',\r?\n        viewSettings: 'yes',\r?\n        editSettings: 'yes',\r?\n      \};\r?\n    \}/,
  "        stockTake: 'yes',\n        manageRecipes: 'yes',\n        managePurchasing: 'yes',\n        viewReports: 'yes',\n        viewSettings: 'yes',\n        editSettings: 'yes',\n        viewAccommodation: 'yes',\n        manageAccommodation: 'yes',\n        managePromotions: 'yes',\n      };\n    }"
);

// 2. Safe merge with defaultRights
content = content.replace(
  /import \{ User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups \} from '@\/types\/user';/,
  "import { User, UserGroup, UserRights, hardcodedUsers, hardcodedUserGroups, defaultRights } from '@/types/user';"
);

content = content.replace(
  /    \/\/ Return group rights or safe defaults\r?\n    return group\?\.rights \|\| \{/,
  "    // Return group rights or safe defaults\n    return { ...defaultRights, ...(group?.rights || {}) };\n    /*"
);

// Close the multiline comment that blocks out the old fallback object
content = content.replace(
  /      editSettings: 'no',\r?\n    \};\r?\n  \};\r?\n\r?\n  const getLandingPage/,
  "      editSettings: 'no',\n    };\n    */\n  };\n\n  const getLandingPage"
);

fs.writeFileSync(path, content);
console.log('Patched AuthContext.tsx successfully');

const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Inventory.tsx';
let content = fs.readFileSync(path, 'utf8');

// Insert after useAuth import
content = content.replace(
  /import \{ useAuth \} from '@\/contexts\/AuthContext';\r?\n/,
  "import { useAuth } from '@/contexts/AuthContext';\nimport { useCurrency } from '@/hooks/useCurrency';\n"
);

fs.writeFileSync(path, content);
console.log('Patched Inventory.tsx successfully');

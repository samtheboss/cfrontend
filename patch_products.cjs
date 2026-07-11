const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Products.tsx';
let content = fs.readFileSync(path, 'utf8');

// Insert after useToast import
content = content.replace(
  /import \{ useToast \} from '@\/hooks\/use-toast';\r?\n/,
  "import { useToast } from '@/hooks/use-toast';\nimport { useCurrency } from '@/hooks/useCurrency';\n"
);

fs.writeFileSync(path, content);
console.log('Patched Products.tsx successfully');

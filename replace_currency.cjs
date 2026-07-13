const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/SupplierAccounts.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/Total split payment \(\$\$\{totalSplit/g, "Total split payment (${sym}${totalSplit");
content = content.replace(/allocated amount \(\$\$\{totalAllocated/g, "allocated amount (${sym}${totalAllocated");
content = content.replace(/Total allocated \(\$\$\{totalAllocated\.toFixed\(2\)\}\) cannot exceed the credit\/prepayment amount \(\$\$\{Number\(selectedCredit\?\.amount \|\| 0\)\.toFixed\(2\)\}\)/g, "Total allocated (${sym}${totalAllocated.toFixed(2)}) cannot exceed the credit/prepayment amount (${sym}${Number(selectedCredit?.amount || 0).toFixed(2)})");

fs.writeFileSync(path, content);
console.log('Replaced $ with ${sym}');

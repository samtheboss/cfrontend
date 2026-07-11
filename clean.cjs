const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Reports.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove State & Handlers
content = content.replace(/\/\/ ─── Custom Reports State ────────────────────────────────────────────────[\s\S]*?\/\/ ────────────────────────────────────────────────────────────────────────\r?\n\r?\n/, '');

// Remove Custom Reports TabTrigger
content = content.replace(/<TabsTrigger value="custom-reports"[\s\S]*?<\/TabsTrigger>\r?\n?/, '');

// Remove Custom Reports TabsContent
content = content.replace(/\{\/\* ── Custom Reports Tab ──[\s\S]*?<\/TabsContent>\r?\n?/, '');
// Wait, the regex needs to be more robust, I'll match from the comment down to </TabsContent>
content = content.replace(/\{\/\*.*?Custom Reports Tab.*?[\s\S]*?<\/TabsContent>\r?\n?/, '');

content = content.replace(/\{\/\* ── Upload Template Dialog ──[\s\S]*?<\/Dialog>\r?\n?/, '');
content = content.replace(/\{\/\* ── Run Report Parameter Dialog ──[\s\S]*?<\/Dialog>\r?\n?/, '');
content = content.replace(/\{\/\* ── PDF Preview Dialog ──[\s\S]*?<\/Dialog>\r?\n?/, '');
content = content.replace(/\{\/\* ── Edit Template Dialog ──[\s\S]*?<\/Dialog>\r?\n?/, '');

fs.writeFileSync(path, content);
console.log('Removed Custom Reports from Reports.tsx');

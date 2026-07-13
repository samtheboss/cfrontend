const fs = require('fs');
const path = 'E:/New folder/cakes/inventory-master/src/pages/Purchasing.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { useAuth }')) {
    content = content.replace(/import \{ useState, useEffect, useMemo \} from 'react';/, "import { useState, useEffect, useMemo } from 'react';\nimport { useAuth } from '@/contexts/AuthContext';");
}

if (!content.includes('const { user } = useAuth();')) {
    content = content.replace(/export default function Purchasing\(\) \{/, "export default function Purchasing() {\n  const { user } = useAuth();");
}

fs.writeFileSync(path, content);
console.log('Added useAuth to Purchasing.tsx');

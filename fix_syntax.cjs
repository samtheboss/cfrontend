const fs = require('fs');

const posPath = 'E:/New folder/cakes/inventory-master/src/pages/POS.tsx';
let posContent = fs.readFileSync(posPath, 'utf8');

const posRegex = /        return prev\.map\(item =>\r?\n\s*if \(item\.printed && delta < 0\) \{/;
const posReplacement = `        return prev.map(item =>
          item.cartItemId === existing.cartItemId
            ? { ...item, quantity: item.quantity + 1, price: currentPrice }
            : item
        );
      }
      return [...prev, {
        cartItemId: \`\${variant.id}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`,
        variantId: variant.id,
        productName: productName,
        variantSku: variant.sku,
        attributes: variant.attributes,
        quantity: 1,
        price: currentPrice,
        maxStock: availableStock,
        hasRecipe: variant.hasRecipe,
        taxRate: product?.taxRate ?? 16.0,
        taxType: product?.taxType ?? 'A'
      }];
    });
    setVariantDialogOpen(false);
    const attrStr = Object.values(variant.attributes).join(' / ');
    toast.success(\`Added \${productName}\${attrStr ? \` (\${attrStr})\` : ''} to cart\`);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        if (item.printed && delta < 0) {`;

posContent = posContent.replace(posRegex, posReplacement);
fs.writeFileSync(posPath, posContent);
console.log('Fixed POS.tsx');

const prodPath = 'E:/New folder/cakes/inventory-master/src/pages/Products.tsx';
let prodContent = fs.readFileSync(prodPath, 'utf8');

const prodRegex = /        parseFloat\(newProduct\.baseCost\) \|\| 0,\r?\n\s*\} else \{\r?\n\s*savedProduct = await contextAddProduct\(productData\);\r?\n\s*\}/;

const prodReplacement = `        parseFloat(newProduct.baseCost) || 0,
        productId,
        newProduct.name,
        newProduct.barcode || undefined
      ).map(v => ({ ...v, id: undefined, productId: sanitizeId(editingId) }));

      const productData: any = {
        id: sanitizeId(editingId),
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        type: newProduct.type,
        attributes: parsedAttributes,
        variants,
        images: newProduct.images.map(img => img.replace(BASE_URL, '')).filter(img => img.trim() !== ''),
        availableOnline: !!newProduct.availableOnline,
        isActive: newProduct.isActive !== false,
        isFeatured: !!newProduct.isFeatured,
        unit: newProduct.unit,
        taxType: newProduct.taxType,
        taxRate: newProduct.taxRate,
      };

      let savedProduct: Product;
      if (editingId) {
        savedProduct = await contextUpdateProduct(productData);
      } else {
        savedProduct = await contextAddProduct(productData);
      }`;

prodContent = prodContent.replace(prodRegex, prodReplacement);
fs.writeFileSync(prodPath, prodContent);
console.log('Fixed Products.tsx');

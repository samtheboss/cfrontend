import { Product, Promotion, ProductVariant } from '../types/inventory';

export function getActivePromotion(
    promotions: Promotion[],
    productId: string | number,
    variantId?: string | number
): Promotion | null {
    const now = new Date();

    // Find all promotions that are active for this product
    const relevantPromotions = promotions.filter(p => {
        // Handle both 'active' and 'isActive' naming from backend
        const isCurrentlyActive = p.active !== false && p.isActive !== false;
        if (!isCurrentlyActive) return false;
        if (p.productId?.toString() !== productId?.toString()) return false;

        // If promotion is for a specific variant, it must match
        if (p.variantId && variantId && p.variantId.toString() !== variantId.toString()) return false;

        // If promotion is for a specific variant but we are checking for the whole product, ignore it
        if (p.variantId && !variantId) return false;

        try {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);

            // If date parsing fails, we consider it active as a fallback if isActive is true
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return true;
            }

            return now >= start && now <= end;
        } catch (e) {
            return true;
        }
    });

    if (relevantPromotions.length === 0) return null;

    // Preference 1: Variant specific promotion
    if (variantId) {
        const variantPromo = relevantPromotions.find(p => p.variantId && p.variantId.toString() === variantId.toString());
        if (variantPromo) return variantPromo;
    }

    // Preference 2: Product level promotion
    const productPromo = relevantPromotions.find(p => !p.variantId);
    return productPromo || null;
}

export function calculatePrice(basePrice: number | string, promotion: Promotion | null): number {
    const bp = Number(basePrice);
    if (!promotion) return bp;

    const val = Number(promotion.discountValue);

    switch (promotion.discountType) {
        case 'FIXED_PRICE':
            return val;
        case 'PERCENTAGE':
            return bp * (1 - val / 100);
        case 'AMOUNT_OFF':
            return Math.max(0, bp - val);
        default:
            return bp;
    }
}

export function getProductPriceInfo(
    product: Product,
    variantId: string | undefined,
    promotions: Promotion[]
) {
    const variant = variantId
        ? product.variants?.find(v => v.id?.toString() === variantId?.toString())
        : product.variants?.[0];

    if (!variant) return { originalPrice: 0, currentPrice: 0, promotion: null };

    const promotion = getActivePromotion(promotions, product.id, variant.id);
    const currentPrice = calculatePrice(variant.price, promotion);

    return {
        originalPrice: variant.price,
        currentPrice,
        promotion,
        isOnSale: currentPrice < variant.price
    };
}

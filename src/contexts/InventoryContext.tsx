import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, ProductVariant, Location, StockAdjustment, StockTransfer, StockTake, Customer, InventoryTransaction, SystemSettings, ActiveOrder, Sale, Category, Promotion } from '@/types/inventory';
import { mockProducts, mockLocations, mockAdjustments, mockCustomers } from '@/data/mockData';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuth } from './AuthContext';

interface InventoryContextType {
    products: Product[];
    locations: Location[];
    categories: Category[];
    customers: Customer[];
    transactions: InventoryTransaction[];
    settings: SystemSettings | null;
    promotions: Promotion[];
    isLoading: boolean;

    // Actions
    addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;
    deleteProducts: (productIds: string[]) => Promise<void>;

    createAdjustment: (adjustment: Partial<StockAdjustment>) => Promise<void>;
    createTransfer: (transfer: Partial<StockTransfer>) => Promise<void>;
    confirmTransfer: (transferId: string) => Promise<void>;
    applyStockTake: (stockTake: Partial<StockTake>) => Promise<void>;
    updateTransaction: (id: string, transaction: Partial<InventoryTransaction>) => Promise<void>;

    // Categories
    addCategory: (name: string, image?: string) => Promise<void>;
    updateCategory: (id: number, name: string, image?: string) => Promise<void>;
    deleteCategory: (category: string) => Promise<void>;

    // Locations
    addLocation: (location: Partial<Location>) => Promise<void>;
    updateLocation: (location: Location) => Promise<void>;
    deleteLocation: (locationId: string) => Promise<void>;

    // Customers
    addCustomer: (customer: Partial<Customer>) => Promise<void>;
    updateCustomer: (customer: Customer) => Promise<void>;
    deleteCustomer: (customerId: string) => Promise<void>;

    // Promotions
    addPromotion: (promotion: Partial<Promotion>) => Promise<void>;
    addBulkPromotions: (promotions: Partial<Promotion>[]) => Promise<void>;
    updatePromotion: (promotion: Promotion) => Promise<void>;
    updateBulkPromotions: (promotions: Promotion[]) => Promise<void>;
    deletePromotion: (id: number) => Promise<void>;
    deleteBulkPromotions: (ids: number[]) => Promise<void>;

    // Settings
    updateSettings: (settings: SystemSettings) => Promise<void>;

    // Sales & Orders
    createSale: (saleData: any) => Promise<{ id: number; journalNumber: string }>;
    createReturn: (returnData: any) => Promise<{ id: number; journalNumber: string }>;
    checkReturnableItems: (saleId: number) => Promise<any[]>;
    activeOrders: ActiveOrder[];
    holdOrder: (order: ActiveOrder) => void;
    discardOrder: (orderId: string) => void;
    salesHistory: Sale[];

    // High-level actions
    processSale: (items: { variantId: string; quantity: number }[], locationId: string) => void;
    updateStock: (variantId: string, locationId: string, delta: number) => void;
    refreshData: (startDate?: string, endDate?: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

interface ApiResponse<T> {
    title: string;
    message: string;
    data: T;
}

export function InventoryProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Active (Held) Orders - Persisted in LocalStorage
    const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>(() => {
        const saved = localStorage.getItem('activeOrders');
        return saved ? JSON.parse(saved) : [];
    });

    // Save active orders to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('activeOrders', JSON.stringify(activeOrders));
    }, [activeOrders]);

    const holdOrder = (order: ActiveOrder) => {
        setActiveOrders(prev => [order, ...prev]);
    };

    const discardOrder = (orderId: string) => {
        setActiveOrders(prev => prev.filter(o => o.id !== orderId));
    };

    // Sales history state
    const [salesHistory, setSalesHistory] = useState<Sale[]>([]);

    const fetchInventoryData = async (startDate?: string, endDate?: string) => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            let queryParams = '';
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                queryParams = `&startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
            }

            const [productsRes, categoriesRes, transactionsRes, salesRes, locationsRes, customersRes, promotionsRes, settingsRes] = await Promise.all([
                apiFetch<ApiResponse<Product[]>>('/api/products'),
                apiFetch<ApiResponse<Category[]>>('/api/categories'),
                apiFetch<ApiResponse<InventoryTransaction[]>>(`/api/transactions?${queryParams.replace('&', '')}`), // Remove leading & if basic param
                apiFetch<ApiResponse<Sale[]>>(`/api/transactions?type=SALE${queryParams}`),
                apiFetch<ApiResponse<Location[]>>('/api/locations'),
                apiFetch<ApiResponse<Customer[]>>('/api/customers'),
                apiFetch<ApiResponse<Promotion[]>>('/api/promotions'),
                apiFetch<ApiResponse<SystemSettings>>('/api/system-settings'),
            ]);
            setProducts(productsRes.data);
            setCategories(categoriesRes.data);
            setTransactions(transactionsRes.data);
            setSalesHistory(salesRes.data || []);
            setLocations(locationsRes.data);
            setCustomers(customersRes.data);
            setPromotions(promotionsRes.data || []);
            setSettings(settingsRes.data);
        } catch (error) {
            console.error('Failed to fetch inventory data:', error);
            toast.error('Connection failed: Could not fetch inventory data');
            setProducts([]);
            setCategories([]);
            setTransactions([]);
            setLocations([]);
            setCustomers([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInventoryData();
    }, [isAuthenticated]);

    const addProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            await apiFetch('/api/products', {
                method: 'POST',
                body: JSON.stringify(productData),
            });
            await fetchInventoryData();
            toast.success('Product added successfully');
        } catch (error) {
            toast.error('Failed to add product');
            throw error;
        }
    };

    const updateProduct = async (product: Product) => {
        try {
            await apiFetch('/api/products', {
                method: 'POST', // Backend uses save (upsert)
                body: JSON.stringify(product),
            });
            await fetchInventoryData();
            toast.success('Product updated successfully');
        } catch (error) {
            toast.error('Failed to update product');
            throw error;
        }
    };

    const deleteProduct = async (productId: string) => {
        try {
            await apiFetch(`/api/products/${productId}`, {
                method: 'DELETE',
            });
            await fetchInventoryData();
            toast.success('Product disabled successfully');
        } catch (error) {
            toast.error('Failed to disable product');
            throw error;
        }
    };

    const deleteProducts = async (productIds: string[]) => {
        try {
            await apiFetch('/api/products/bulk-delete', {
                method: 'POST',
                body: JSON.stringify(productIds),
            });
            await fetchInventoryData();
            toast.success('Selected products disabled successfully');
        } catch (error) {
            toast.error('Failed to disable selected products');
            throw error;
        }
    };

    const createAdjustment = async (adjustment: Partial<StockAdjustment>) => {
        try {
            const response = await apiFetch<ApiResponse<StockAdjustment>>('/api/transactions/adjustment', {
                method: 'POST',
                body: JSON.stringify(adjustment),
            });
            await fetchInventoryData();
            toast.success(response.message || 'Stock adjustment processed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to process adjustment');
            throw error;
        }
    };

    const createTransfer = async (transfer: Partial<StockTransfer>) => {
        try {
            await apiFetch('/api/transactions/transfer', {
                method: 'POST',
                body: JSON.stringify(transfer),
            });
            await fetchInventoryData();
            toast.success('Stock transfer initiated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to initiate transfer');
            throw error;
        }
    };

    const confirmTransfer = async (transferId: string) => {
        try {
            await apiFetch(`/api/transactions/transfer/${transferId}/confirm`, {
                method: 'POST',
            });
            await fetchInventoryData();
            toast.success('Stock transfer confirmed and received');
        } catch (error: any) {
            toast.error(error.message || 'Failed to confirm transfer');
            throw error;
        }
    };

    const applyStockTake = async (stockTake: Partial<StockTake>) => {
        try {
            const response = await apiFetch<ApiResponse<StockTake>>('/api/transactions/stock-take', {
                method: 'POST',
                body: JSON.stringify(stockTake),
            });
            await fetchInventoryData();
            toast.success(response.message || 'Stock take processed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to apply stock take');
            throw error;
        }
    };

    const updateTransaction = async (id: string, transaction: Partial<InventoryTransaction>) => {
        try {
            const response = await apiFetch<ApiResponse<InventoryTransaction>>(`/api/transactions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(transaction),
            });
            await fetchInventoryData();
            toast.success(response.message || 'Transaction updated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update transaction');
            throw error;
        }
    };

    // Expose updateTransaction to window for easier access in components
    useEffect(() => {
        (window as any).updateTransaction = updateTransaction;
    }, [updateTransaction]);

    const addCategory = async (name: string, image?: string) => {
        try {
            await apiFetch('/api/categories', {
                method: 'POST',
                body: JSON.stringify({ name, image }),
            });
            await fetchInventoryData();
            toast.success('Category added');
        } catch (error) {
            toast.error('Failed to add category');
        }
    };

    const updateCategory = async (id: number, name: string, image?: string) => {
        try {
            await apiFetch(`/api/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, image }),
            });
            await fetchInventoryData();
            toast.success('Category updated successfully');
        } catch (error) {
            toast.error('Failed to update category');
        }
    };

    const deleteCategory = async (categoryName: string) => {
        const category = categories.find(c => c.name === categoryName);
        if (!category) return;

        const inUse = products.some(p => p.category === categoryName);
        if (inUse) {
            toast.error('Cannot delete: Category is in use by products');
            return;
        }

        try {
            await apiFetch(`/api/categories/${category.id}`, {
                method: 'DELETE',
            });
            await fetchInventoryData();
            toast.success('Category deleted successfully');
        } catch (error) {
            toast.error('Failed to delete category');
        }
    };

    const addLocation = async (locationData: Partial<Location>) => {
        try {
            await apiFetch('/api/locations', {
                method: 'POST',
                body: JSON.stringify(locationData),
            });
            await fetchInventoryData();
            toast.success('Location added successfully');
        } catch (error) {
            toast.error('Failed to add location');
        }
    };

    const updateLocation = async (location: Location) => {
        try {
            await apiFetch('/api/locations', {
                method: 'POST',
                body: JSON.stringify(location),
            });
            await fetchInventoryData();
            toast.success('Location updated successfully');
        } catch (error) {
            toast.error('Failed to update location');
        }
    };

    const deleteLocation = async (locationId: string) => {
        try {
            await apiFetch(`/api/locations/${locationId}`, {
                method: 'DELETE',
            });
            await fetchInventoryData();
            toast.success('Location deleted successfully');
        } catch (error) {
            toast.error('Failed to delete location');
        }
    };

    const addCustomer = async (customerData: Partial<Customer>) => {
        try {
            await apiFetch('/api/customers', {
                method: 'POST',
                body: JSON.stringify(customerData),
            });
            await fetchInventoryData();
            toast.success('Customer added successfully');
        } catch (error) {
            toast.error('Failed to add customer');
        }
    };

    const updateCustomer = async (customer: Customer) => {
        try {
            await apiFetch('/api/customers', {
                method: 'POST',
                body: JSON.stringify(customer),
            });
            await fetchInventoryData();
            toast.success('Customer updated successfully');
        } catch (error) {
            toast.error('Failed to update customer');
        }
    };

    const deleteCustomer = async (customerId: string) => {
        try {
            await apiFetch(`/api/customers/${customerId}`, {
                method: 'DELETE',
            });
            await fetchInventoryData();
            toast.success('Customer deleted successfully');
        } catch (error) {
            toast.error('Failed to delete customer');
        }
    };

    const addPromotion = async (promotionData: Partial<Promotion>) => {
        try {
            await apiFetch('/api/promotions', {
                method: 'POST',
                body: JSON.stringify(promotionData),
            });
            await fetchInventoryData();
            toast.success('Promotion added successfully');
        } catch (error) {
            toast.error('Failed to add promotion');
        }
    };

    const addBulkPromotions = async (promotionsData: Partial<Promotion>[]) => {
        try {
            await apiFetch('/api/promotions/bulk', {
                method: 'POST',
                body: JSON.stringify(promotionsData),
            });
            await fetchInventoryData();
            toast.success('Bulk promotions added successfully');
        } catch (error) {
            toast.error('Failed to add bulk promotions');
        }
    };

    const updatePromotion = async (promotion: Promotion) => {
        try {
            await apiFetch('/api/promotions', {
                method: 'POST', // Backend uses save (upsert)
                body: JSON.stringify(promotion),
            });
            await fetchInventoryData();
            toast.success('Promotion updated successfully');
        } catch (error) {
            toast.error('Failed to update promotion');
        }
    };

    const updateBulkPromotions = async (promotionsData: Promotion[]) => {
        try {
            await apiFetch('/api/promotions/bulk', {
                method: 'POST',
                body: JSON.stringify(promotionsData),
            });
            await fetchInventoryData();
            toast.success('Promotions updated successfully');
        } catch (error) {
            toast.error('Failed to update promotions');
        }
    };

    const deletePromotion = async (id: number) => {
        try {
            await apiFetch(`/api/promotions/${id}`, {
                method: 'DELETE',
            });
            await fetchInventoryData();
            toast.success('Promotion deleted successfully');
        } catch (error) {
            toast.error('Failed to delete promotion');
        }
    };

    const deleteBulkPromotions = async (ids: number[]) => {
        try {
            await Promise.all(ids.map(id => apiFetch(`/api/promotions/${id}`, { method: 'DELETE' })));
            await fetchInventoryData();
            toast.success('Selected promotions deleted successfully');
        } catch (error) {
            toast.error('Failed to delete some promotions');
        }
    };

    const updateStock = (variantId: string, locationId: string, delta: number) => {
        setProducts(prev => prev.map(product => {
            const variantIndex = product.variants.findIndex(v => v.id === variantId);
            if (variantIndex === -1) return product;

            const newVariants = [...product.variants];
            const variant = { ...newVariants[variantIndex] };
            const newLocationStock = { ...variant.locationStock };

            newLocationStock[locationId] = (newLocationStock[locationId] || 0) + delta;

            // Update aggregate stock for backward compatibility
            variant.locationStock = newLocationStock;
            variant.stock = Object.values(newLocationStock).reduce((sum, q) => sum + q, 0);

            newVariants[variantIndex] = variant;
            return { ...product, variants: newVariants };
        }));
    };

    const processSale = (items: { variantId: string; quantity: number }[], locationId: string) => {
        items.forEach(item => {
            updateStock(item.variantId, locationId, -item.quantity);
        });
    };

    return (
        <InventoryContext.Provider
            value={{
                products,
                locations,
                categories,
                customers,
                transactions,
                promotions,
                isLoading,
                addProduct,
                updateProduct,
                deleteProduct,
                deleteProducts,
                createAdjustment,
                createTransfer,
                confirmTransfer,
                applyStockTake,
                updateTransaction,
                addCategory,
                updateCategory,
                deleteCategory,
                addLocation,
                updateLocation,
                deleteLocation,
                addCustomer,
                updateCustomer,
                deleteCustomer,
                addPromotion,
                addBulkPromotions,
                updatePromotion,
                updateBulkPromotions,
                deletePromotion,
                deleteBulkPromotions,
                processSale,
                updateStock,
                settings,
                updateSettings: async (newSettings: SystemSettings) => {
                    try {
                        await apiFetch('/api/system-settings', {
                            method: 'POST',
                            body: JSON.stringify(newSettings),
                        });
                        await fetchInventoryData();
                        toast.success('Settings updated successfully');
                    } catch (error) {
                        toast.error('Failed to update settings');
                    }
                },
                createSale: async (saleData: any) => {
                    try {
                        const response = await apiFetch<ApiResponse<{ id: number; journalNumber: string }>>('/api/transactions/sale', {
                            method: 'POST',
                            body: JSON.stringify(saleData),
                        });
                        await fetchInventoryData();
                        toast.success(`Sale ${response.data.journalNumber} completed!`);
                        return response.data;
                    } catch (error: any) {
                        toast.error(error.message || 'Failed to process sale');
                        throw error;
                    }
                },
                createReturn: async (returnData: any) => {
                    try {
                        const response = await apiFetch<ApiResponse<{ id: number; journalNumber: string }>>('/api/transactions/return', {
                            method: 'POST',
                            body: JSON.stringify(returnData),
                        });
                        await fetchInventoryData();
                        toast.success(`Return ${response.data.journalNumber} processed!`);
                        return response.data;
                    } catch (error: any) {
                        toast.error(error.message || 'Failed to process return');
                        throw error;
                    }
                },
                checkReturnableItems: async (saleId: number) => {
                    try {
                        const response = await apiFetch<ApiResponse<any[]>>(`/api/transactions/sale/${saleId}/returnable`);
                        return response.data;
                    } catch (error: any) {
                        toast.error('Failed to check return status');
                        return [];
                    }
                },
                activeOrders,
                holdOrder,
                discardOrder,
                salesHistory,
                refreshData: fetchInventoryData,
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
}

export function useInventory() {
    const context = useContext(InventoryContext);
    if (context === undefined) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
}

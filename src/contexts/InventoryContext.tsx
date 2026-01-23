import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, ProductVariant, Location, StockAdjustment, StockTransfer, StockTake, Customer, InventoryTransaction } from '@/types/inventory';
import { mockProducts, mockLocations, mockAdjustments, mockCustomers } from '@/data/mockData';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAuth } from './AuthContext';

interface InventoryContextType {
    products: Product[];
    locations: Location[];
    categories: string[];
    customers: Customer[];
    transactions: InventoryTransaction[];
    settings: SystemSettings | null;
    isLoading: boolean;

    // Actions
    addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;

    createAdjustment: (adjustment: Partial<StockAdjustment>) => Promise<void>;
    createTransfer: (transfer: Partial<StockTransfer>) => Promise<void>;
    confirmTransfer: (transferId: string) => Promise<void>;
    applyStockTake: (stockTake: Partial<StockTake>) => Promise<void>;

    // Categories
    addCategory: (name: string) => Promise<void>;
    deleteCategory: (category: string) => Promise<void>;

    // Locations
    addLocation: (location: Partial<Location>) => Promise<void>;
    updateLocation: (location: Location) => Promise<void>;
    deleteLocation: (locationId: string) => Promise<void>;

    // Customers
    addCustomer: (customer: Partial<Customer>) => Promise<void>;
    updateCustomer: (customer: Customer) => Promise<void>;
    deleteCustomer: (customerId: string) => Promise<void>;

    // Settings
    updateSettings: (settings: SystemSettings) => Promise<void>;

    // High-level actions
    processSale: (items: { variantId: string; quantity: number }[], locationId: string) => void;
    updateStock: (variantId: string, locationId: string, delta: number) => void;
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
    const [categories, setCategories] = useState<string[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInventoryData = async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const [productsRes, categoriesRes, transactionsRes, locationsRes, customersRes, settingsRes] = await Promise.all([
                apiFetch<ApiResponse<Product[]>>('/api/products'),
                apiFetch<ApiResponse<{ name: string }[]>>('/api/categories'),
                apiFetch<ApiResponse<InventoryTransaction[]>>('/api/transactions'),
                apiFetch<ApiResponse<Location[]>>('/api/locations'),
                apiFetch<ApiResponse<Customer[]>>('/api/customers'),
                apiFetch<ApiResponse<SystemSettings>>('/api/system-settings'),
            ]);
            setProducts(productsRes.data);
            setCategories(categoriesRes.data.map(c => c.name));
            setTransactions(transactionsRes.data);
            setLocations(locationsRes.data);
            setCustomers(customersRes.data);
            setSettings(settingsRes.data);
        } catch (error) {
            console.error('Failed to fetch inventory data:', error);
            // Fallback to mock data in development if API fails
            setProducts(mockProducts);
            setCategories(['Apparel', 'Footwear', 'Accessories', 'Electronics']);
            setTransactions([]);
            setLocations(mockLocations);
            setCustomers(mockCustomers);
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
        // Backend doesn't have delete yet, but let's assume it will
        toast.error('Delete product not yet implemented in backend');
    };

    const createAdjustment = async (adjustment: Partial<StockAdjustment>) => {
        try {
            await apiFetch('/api/transactions/adjustment', {
                method: 'POST',
                body: JSON.stringify(adjustment),
            });
            await fetchInventoryData();
            toast.success('Stock adjustment completed');
        } catch (error) {
            toast.error('Failed to process adjustment');
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
        } catch (error) {
            toast.error('Failed to initiate transfer');
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
        } catch (error) {
            toast.error('Failed to confirm transfer');
            throw error;
        }
    };

    const applyStockTake = async (stockTake: Partial<StockTake>) => {
        try {
            await apiFetch('/api/transactions/stock-take', {
                method: 'POST',
                body: JSON.stringify(stockTake),
            });
            await fetchInventoryData();
            toast.success('Stock take applied successfully');
        } catch (error) {
            toast.error('Failed to apply stock take');
            throw error;
        }
    };

    const addCategory = async (name: string) => {
        try {
            await apiFetch('/api/categories', {
                method: 'POST',
                body: JSON.stringify({ name }),
            });
            await fetchInventoryData();
            toast.success('Category added');
        } catch (error) {
            toast.error('Failed to add category');
        }
    };

    const deleteCategory = async (category: string) => {
        const inUse = products.some(p => p.category === category);
        if (inUse) {
            toast.error('Cannot delete: Category is in use by products');
            return;
        }
        // Backend doesn't have delete yet
        toast.error('Delete category not yet implemented in backend');
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
                isLoading,
                addProduct,
                updateProduct,
                deleteProduct,
                createAdjustment,
                createTransfer,
                confirmTransfer,
                applyStockTake,
                addCategory,
                deleteCategory,
                addLocation,
                updateLocation,
                deleteLocation,
                addCustomer,
                updateCustomer,
                deleteCustomer,
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

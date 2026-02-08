import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { InventoryProvider } from "@/contexts/InventoryContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import StockAdjustment from "./pages/StockAdjustment";
import StockTake from "./pages/StockTake";
import StockTransfer from "./pages/StockTransfer";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Customers from "./pages/Customers";
import Locations from "./pages/Locations";
import InventoryTransactions from "./pages/InventoryTransactions";
import Slides from "./pages/Slides";
import Promotions from "./pages/Promotions";
import OnlineOrders from "./pages/OnlineOrders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <InventoryProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<SignIn />} />
              <Route path="/" element={<ProtectedRoute requiredRight="viewDashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute requiredRight="viewProducts"><Products /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute requiredRight="viewInventory"><Inventory /></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute requiredRight="viewOrders"><POS /></ProtectedRoute>} />
              <Route path="/adjustments" element={<ProtectedRoute requiredRight="stockAdjustment"><StockAdjustment /></ProtectedRoute>} />
              <Route path="/stock-take" element={<ProtectedRoute requiredRight="stockTake"><StockTake /></ProtectedRoute>} />
              <Route path="/transfers" element={<ProtectedRoute requiredRight="stockAdjustment"><StockTransfer /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requiredRight="viewReports"><Reports /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredRight="viewSettings"><Settings /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredRight="viewUsers"><Users /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute requiredRight="viewCustomers"><Customers /></ProtectedRoute>} />
              <Route path="/locations" element={<ProtectedRoute requiredRight="viewSettings"><Locations /></ProtectedRoute>} />
              <Route path="/journal" element={<ProtectedRoute requiredRight="viewInventory"><InventoryTransactions /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute requiredRight="viewOrders"><OnlineOrders /></ProtectedRoute>} />
              <Route path="/slides" element={<ProtectedRoute requiredRight="viewSettings"><Slides /></ProtectedRoute>} />
              <Route path="/promotions" element={<ProtectedRoute requiredRight="viewProducts"><Promotions /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </InventoryProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Property, PropertyUnit } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Building,
  Plus,
  Trash2,
  Edit,
  Search,
  MapPin,
  User,
  Phone,
  Mail,
  Home,
  CheckCircle,
  HelpCircle,
  Wrench,
  ChevronRight,
  TrendingUp,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const generateUnitRange = (start: string, end: string) => {
  if (!start || !end) return [start || ''];
  const startMatch = start.match(/^(.*?)(\d+)$/);
  const endMatch = end.match(/^(.*?)(\d+)$/);
  
  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    const prefix = startMatch[1];
    const startNum = parseInt(startMatch[2], 10);
    const endNum = parseInt(endMatch[2], 10);
    const padLength = startMatch[2].length;
    
    if (endNum >= startNum && endNum - startNum <= 100) {
       const results = [];
       for (let i = startNum; i <= endNum; i++) {
         const numStr = String(i).padStart(padLength, '0');
         results.push(prefix + numStr);
       }
       return results;
    }
  }
  return [start];
};

export default function Properties() {
  const { locations } = useInventory();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchProperty, setSearchProperty] = useState('');
  const [searchUnit, setSearchUnit] = useState('');

  // Dialog states
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isPropertyPopoverOpen, setIsPropertyPopoverOpen] = useState(false);
  const [isBulkAdd, setIsBulkAdd] = useState(false);
  const [bulkRangeEnd, setBulkRangeEnd] = useState('');
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);

  // Form states
  const [newProperty, setNewProperty] = useState({
    name: '',
    address: '',
    propertyType: 'APARTMENT',
    locationId: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
  });

  const [newUnit, setNewUnit] = useState({
    propertyId: '',
    unitNumber: '',
    floor: '',
    bedrooms: 1,
    bathrooms: 1,
    monthlyRent: 0,
    depositAmount: 0,
    status: 'VACANT',
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const propRes = await apiFetch<{ data: Property[] }>('/api/pms/properties');
      const unitRes = await apiFetch<{ data: PropertyUnit[] }>('/api/pms/units');
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load properties or units: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for Properties
  const handleSaveProperty = async () => {
    if (!newProperty.name || !newProperty.locationId) {
      toast.error('Please enter property name and branch location');
      return;
    }

    try {
      const payload = {
        ...newProperty,
        locationId: parseInt(newProperty.locationId),
      };
      await apiFetch('/api/pms/properties', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Property saved successfully');
      setNewProperty({
        name: '',
        address: '',
        propertyType: 'APARTMENT',
        locationId: '',
        ownerName: '',
        ownerPhone: '',
        ownerEmail: '',
      });
      setIsAddPropertyOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save property: ' + err.message);
    }
  };

  const handleUpdateProperty = async () => {
    if (!editingProperty || !editingProperty.name || !editingProperty.locationId) {
      toast.error('Please complete all required fields');
      return;
    }

    try {
      await apiFetch('/api/pms/properties', {
        method: 'POST',
        body: JSON.stringify(editingProperty),
      });
      toast.success('Property updated successfully');
      setEditingProperty(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update property: ' + err.message);
    }
  };

  const handleDeleteProperty = async (id: number) => {
    if (!confirm('Are you sure you want to delete this property? This will delete all vacant units associated with it.')) return;
    try {
      await apiFetch(`/api/pms/properties/${id}`, { method: 'DELETE' });
      toast.success('Property deleted');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete property: ' + err.message);
    }
  };

  // Handlers for Units
  const handleSaveUnit = async () => {
    if (!newUnit.propertyId || !newUnit.unitNumber) {
      toast.error('Please specify property and unit number');
      return;
    }
    if (isBulkAdd && !bulkRangeEnd) {
      toast.error('Please specify the end of the unit range');
      return;
    }

    try {
      const basePayload = {
        ...newUnit,
        propertyId: parseInt(newUnit.propertyId),
        bedrooms: parseInt(newUnit.bedrooms as any),
        bathrooms: parseInt(newUnit.bathrooms as any),
        monthlyRent: parseFloat(newUnit.monthlyRent as any),
        depositAmount: parseFloat(newUnit.depositAmount as any),
      };

      const unitNumbers = isBulkAdd ? generateUnitRange(newUnit.unitNumber, bulkRangeEnd) : [newUnit.unitNumber];

      await Promise.all(unitNumbers.map(uNum => {
        const payload = { ...basePayload, unitNumber: uNum };
        return apiFetch('/api/pms/units', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }));

      toast.success(isBulkAdd ? 'Units saved successfully' : 'Unit saved successfully');
      setNewUnit({
        propertyId: '',
        unitNumber: '',
        floor: '',
        bedrooms: 1,
        bathrooms: 1,
        monthlyRent: 0,
        depositAmount: 0,
        status: 'VACANT',
      });
      setBulkRangeEnd('');
      setIsBulkAdd(false);
      setIsAddUnitOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save unit(s): ' + err.message);
    }
  };

  const handleUpdateUnit = async () => {
    if (!editingUnit || !editingUnit.propertyId || !editingUnit.unitNumber) {
      toast.error('Please complete all required fields');
      return;
    }

    try {
      const payload = {
        ...editingUnit,
        bedrooms: parseInt(editingUnit.bedrooms as any),
        bathrooms: parseInt(editingUnit.bathrooms as any),
        monthlyRent: parseFloat(editingUnit.monthlyRent as any),
        depositAmount: parseFloat(editingUnit.depositAmount as any),
      };
      await apiFetch('/api/pms/units', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success('Unit updated successfully');
      setEditingUnit(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update unit: ' + err.message);
    }
  };

  const handleDeleteUnit = async (id: number) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
      await apiFetch(`/api/pms/units/${id}`, { method: 'DELETE' });
      toast.success('Unit deleted');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to delete unit: ' + err.message);
    }
  };

  // Helpers
  const getLocationName = (id?: number) => {
    if (!id) return 'Unknown';
    const loc = locations.find((l) => l.id === id.toString() || l.id === id);
    return loc ? loc.name : `Branch #${id}`;
  };

  const getPropertyName = (id: number) => {
    const prop = properties.find((p) => p.id === id);
    return prop ? prop.name : `Property #${id}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VACANT':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">Vacant</Badge>;
      case 'OCCUPIED':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Occupied</Badge>;
      case 'RESERVED':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Reserved</Badge>;
      case 'UNDER_MAINTENANCE':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white">Maintenance</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Filtered lists
  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(searchProperty.toLowerCase()) ||
    (p.address && p.address.toLowerCase().includes(searchProperty.toLowerCase()))
  );

  const filteredUnits = units.filter((u) => {
    const unitNoMatch = u.unitNumber.toLowerCase().includes(searchUnit.toLowerCase());
    const propNameMatch = getPropertyName(u.propertyId).toLowerCase().includes(searchUnit.toLowerCase());
    return unitNoMatch || propNameMatch;
  });

  return (
    <AppLayout title="Properties & Units">
      <div className="space-y-6">
        <Tabs defaultValue="properties" className="w-full">
          <div className="flex items-center justify-between border-b pb-2">
            <TabsList className="bg-muted">
              <TabsTrigger value="properties" className="data-[state=active]:bg-background">
                <Building className="h-4 w-4 mr-2" />
                Properties ({properties.length})
              </TabsTrigger>
              <TabsTrigger value="units" className="data-[state=active]:bg-background">
                <Home className="h-4 w-4 mr-2" />
                Units ({units.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Properties Tab */}
          <TabsContent value="properties" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={searchProperty}
                  onChange={(e) => setSearchProperty(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setIsAddPropertyOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Branch Location</TableHead>
                      <TableHead>Owner / Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.map((prop) => (
                      <TableRow key={prop.id}>
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-indigo-500" />
                            <div>
                              <p>{prop.name}</p>
                              {prop.address && <p className="text-xs text-muted-foreground font-normal">{prop.address}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{prop.propertyType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {getLocationName(prop.locationId)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {prop.ownerName && (
                              <div className="flex items-center gap-1 font-medium">
                                <User className="h-3 w-3 text-slate-500" />
                                {prop.ownerName}
                              </div>
                            )}
                            {prop.ownerPhone && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {prop.ownerPhone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingProperty(prop)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => prop.id && handleDeleteProperty(prop.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProperties.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No properties found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Units Tab */}
          <TabsContent value="units" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search units or property..."
                  value={searchUnit}
                  onChange={(e) => setSearchUnit(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setIsAddUnitOpen(true)} disabled={properties.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Unit
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property / Unit</TableHead>
                      <TableHead>Floor / Spec</TableHead>
                      <TableHead>Monthly Rent</TableHead>
                      <TableHead>Deposit Required</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold">Unit {unit.unitNumber}</p>
                            <p className="text-xs text-muted-foreground">{getPropertyName(unit.propertyId)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">Floor {unit.floor || 'G'}</p>
                          <p className="text-xs text-muted-foreground">
                            {unit.bedrooms} Bed / {unit.bathrooms} Bath
                          </p>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          KES {unit.monthlyRent.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          KES {unit.depositAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(unit.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingUnit(unit)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unit.id && handleDeleteUnit(unit.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUnits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No units found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Property Dialog */}
        <Dialog open={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Property</DialogTitle>
              <DialogDescription>Create a new physical property profile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="propName">Property Name *</Label>
                <Input
                  id="propName"
                  value={newProperty.name}
                  onChange={(e) => setNewProperty((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="E.g., Sunrise Apartments"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="propLoc">Branch Location *</Label>
                <Select
                  value={newProperty.locationId}
                  onValueChange={(val) => setNewProperty((prev) => ({ ...prev, locationId: val }))}
                >
                  <SelectTrigger id="propLoc">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="propType">Property Type</Label>
                  <Select
                    value={newProperty.propertyType}
                    onValueChange={(val) => setNewProperty((prev) => ({ ...prev, propertyType: val }))}
                  >
                    <SelectTrigger id="propType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APARTMENT">Apartment</SelectItem>
                      <SelectItem value="HOUSE">House</SelectItem>
                      <SelectItem value="OFFICE">Office</SelectItem>
                      <SelectItem value="SHOP">Shop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propAddress">Address</Label>
                  <Input
                    id="propAddress"
                    value={newProperty.address}
                    onChange={(e) => setNewProperty((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="E.g., Nairobi, Ngong Road"
                  />
                </div>
              </div>
              <div className="border-t pt-2 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner Contact Information</h4>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerName">Owner Full Name</Label>
                  <Input
                    id="ownerName"
                    value={newProperty.ownerName}
                    onChange={(e) => setNewProperty((prev) => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="E.g., Mary Jane"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ownerPhone">Owner Phone</Label>
                    <Input
                      id="ownerPhone"
                      value={newProperty.ownerPhone}
                      onChange={(e) => setNewProperty((prev) => ({ ...prev, ownerPhone: e.target.value }))}
                      placeholder="E.g., 0712345678"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ownerEmail">Owner Email</Label>
                    <Input
                      id="ownerEmail"
                      value={newProperty.ownerEmail}
                      onChange={(e) => setNewProperty((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                      placeholder="owner@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddPropertyOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProperty}>Save Property</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Property Dialog */}
        <Dialog open={editingProperty !== null} onOpenChange={() => setEditingProperty(null)}>
          {editingProperty && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Property</DialogTitle>
                <DialogDescription>Modify property details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editPropName">Property Name *</Label>
                  <Input
                    id="editPropName"
                    value={editingProperty.name}
                    onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editPropLoc">Branch Location *</Label>
                  <Select
                    value={editingProperty.locationId?.toString()}
                    onValueChange={(val) => setEditingProperty((prev: any) => ({ ...prev, locationId: parseInt(val) }))}
                  >
                    <SelectTrigger id="editPropLoc">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editPropType">Property Type</Label>
                    <Select
                      value={editingProperty.propertyType}
                      onValueChange={(val) => setEditingProperty((prev: any) => ({ ...prev, propertyType: val }))}
                    >
                      <SelectTrigger id="editPropType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APARTMENT">Apartment</SelectItem>
                        <SelectItem value="HOUSE">House</SelectItem>
                        <SelectItem value="OFFICE">Office</SelectItem>
                        <SelectItem value="SHOP">Shop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editPropAddress">Address</Label>
                    <Input
                      id="editPropAddress"
                      value={editingProperty.address || ''}
                      onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="border-t pt-2 space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner Contact Information</h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="editOwnerName">Owner Full Name</Label>
                    <Input
                      id="editOwnerName"
                      value={editingProperty.ownerName || ''}
                      onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, ownerName: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="editOwnerPhone">Owner Phone</Label>
                      <Input
                        id="editOwnerPhone"
                        value={editingProperty.ownerPhone || ''}
                        onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, ownerPhone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="editOwnerEmail">Owner Email</Label>
                      <Input
                        id="editOwnerEmail"
                        value={editingProperty.ownerEmail || ''}
                        onChange={(e) => setEditingProperty((prev: any) => ({ ...prev, ownerEmail: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingProperty(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateProperty}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {/* Add Unit Dialog */}
        <Dialog open={isAddUnitOpen} onOpenChange={setIsAddUnitOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Property Unit</DialogTitle>
              <DialogDescription>Create a new rental unit.</DialogDescription>
              <div className="flex items-center space-x-2 mt-3 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border">
                <Switch id="unit-bulk-add" checked={isBulkAdd} onCheckedChange={setIsBulkAdd} />
                <Label htmlFor="unit-bulk-add" className="text-xs font-semibold cursor-pointer">Create multiple units (Bulk Add Range)</Label>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="unitProp">Belongs to Property *</Label>
                <Popover open={isPropertyPopoverOpen} onOpenChange={setIsPropertyPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="unitProp"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isPropertyPopoverOpen}
                      className="w-full justify-between animate-none"
                    >
                      {newUnit.propertyId
                        ? properties.find(p => p.id?.toString() === newUnit.propertyId)?.name
                        : 'Select Property...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search properties..." />
                      <CommandList>
                        <CommandEmpty>No properties found.</CommandEmpty>
                        <CommandGroup>
                          {properties.map((prop) => (
                            <CommandItem
                              key={prop.id}
                              value={prop.name.toLowerCase()}
                              onSelect={() => {
                                setNewUnit((prev) => ({ ...prev, propertyId: prop.id?.toString() || '' }));
                                setIsPropertyPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  prop.id?.toString() === newUnit.propertyId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {prop.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={cn("space-y-1.5", isBulkAdd ? "col-span-2" : "col-span-1")}>
                  <Label htmlFor="unitNo">
                    {isBulkAdd ? "Unit Number Range (Start to End) *" : "Unit Number / Code *"}
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="unitNo"
                      value={newUnit.unitNumber}
                      onChange={(e) => setNewUnit((prev) => ({ ...prev, unitNumber: e.target.value }))}
                      placeholder={isBulkAdd ? "Start (e.g. 1)" : "E.g., A-101"}
                      className="flex-1"
                    />
                    {isBulkAdd && (
                      <>
                        <span className="text-slate-400 font-medium text-xs">to</span>
                        <Input
                          placeholder="End (e.g. 10)"
                          value={bulkRangeEnd}
                          onChange={(e) => setBulkRangeEnd(e.target.value)}
                          className="flex-1"
                        />
                      </>
                    )}
                  </div>
                </div>
                {!isBulkAdd && (
                  <div className="space-y-1.5">
                    <Label htmlFor="unitFloor">Floor</Label>
                    <Input
                      id="unitFloor"
                      value={newUnit.floor}
                      onChange={(e) => setNewUnit((prev) => ({ ...prev, floor: e.target.value }))}
                      placeholder="E.g., 1st Floor"
                    />
                  </div>
                )}
              </div>
              {isBulkAdd && (
                <div className="space-y-1.5">
                  <Label htmlFor="unitFloor">Floor</Label>
                  <Input
                    id="unitFloor"
                    value={newUnit.floor}
                    onChange={(e) => setNewUnit((prev) => ({ ...prev, floor: e.target.value }))}
                    placeholder="E.g., 1st Floor"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="unitBedrooms">Bedrooms</Label>
                  <Input
                    id="unitBedrooms"
                    type="number"
                    value={newUnit.bedrooms}
                    onChange={(e) => setNewUnit((prev) => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitBathrooms">Bathrooms</Label>
                  <Input
                    id="unitBathrooms"
                    type="number"
                    value={newUnit.bathrooms}
                    onChange={(e) => setNewUnit((prev) => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="unitRent">Monthly Rent Rate (KES) *</Label>
                  <Input
                    id="unitRent"
                    type="number"
                    value={newUnit.monthlyRent}
                    onChange={(e) => setNewUnit((prev) => ({ ...prev, monthlyRent: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unitDeposit">Deposit Amount (KES)</Label>
                  <Input
                    id="unitDeposit"
                    type="number"
                    value={newUnit.depositAmount}
                    onChange={(e) => setNewUnit((prev) => ({ ...prev, depositAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitStatus">Unit Status</Label>
                <Select
                  value={newUnit.status}
                  onValueChange={(val) => setNewUnit((prev) => ({ ...prev, status: val }))}
                >
                  <SelectTrigger id="unitStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACANT">Vacant</SelectItem>
                    <SelectItem value="OCCUPIED">Occupied</SelectItem>
                    <SelectItem value="RESERVED">Reserved</SelectItem>
                    <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUnitOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveUnit}>Save Unit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Unit Dialog */}
        <Dialog open={editingUnit !== null} onOpenChange={() => setEditingUnit(null)}>
          {editingUnit && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Unit</DialogTitle>
                <DialogDescription>Modify unit parameters.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitNo">Unit Number / Code *</Label>
                    <Input
                      id="editUnitNo"
                      value={editingUnit.unitNumber}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, unitNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitFloor">Floor</Label>
                    <Input
                      id="editUnitFloor"
                      value={editingUnit.floor || ''}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, floor: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitBedrooms">Bedrooms</Label>
                    <Input
                      id="editUnitBedrooms"
                      type="number"
                      value={editingUnit.bedrooms || 0}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, bedrooms: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitBathrooms">Bathrooms</Label>
                    <Input
                      id="editUnitBathrooms"
                      type="number"
                      value={editingUnit.bathrooms || 0}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, bathrooms: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitRent">Monthly Rent Rate (KES) *</Label>
                    <Input
                      id="editUnitRent"
                      type="number"
                      value={editingUnit.monthlyRent}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, monthlyRent: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editUnitDeposit">Deposit Amount (KES)</Label>
                    <Input
                      id="editUnitDeposit"
                      type="number"
                      value={editingUnit.depositAmount}
                      onChange={(e) => setEditingUnit((prev: any) => ({ ...prev, depositAmount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editUnitStatus">Unit Status</Label>
                  <Select
                    value={editingUnit.status}
                    onValueChange={(val) => setEditingUnit((prev: any) => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger id="editUnitStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VACANT">Vacant</SelectItem>
                      <SelectItem value="OCCUPIED">Occupied</SelectItem>
                      <SelectItem value="RESERVED">Reserved</SelectItem>
                      <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUnit(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateUnit}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </AppLayout>
  );
}

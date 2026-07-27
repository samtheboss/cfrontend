import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useInventory } from '@/contexts/InventoryContext';
import { Property, PropertyUnit, PropertyMaintenanceRequest } from '@/types/inventory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Maintenance() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [requests, setRequests] = useState<PropertyMaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isAddRequestOpen, setIsAddRequestOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PropertyMaintenanceRequest | null>(null);

  // Form states
  const [newRequest, setNewRequest] = useState({
    unitId: '',
    issueDescription: '',
    priority: 'MEDIUM',
    status: 'REPORTED',
    technicianName: '',
    cost: 0,
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const propRes = await apiFetch<{ data: Property[] }>('/api/pms/properties');
      const unitRes = await apiFetch<{ data: PropertyUnit[] }>('/api/pms/units');
      const reqRes = await apiFetch<{ data: PropertyMaintenanceRequest[] }>('/api/pms/maintenance');
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setRequests(reqRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Save Request
  const handleSaveRequest = async () => {
    if (!newRequest.unitId || !newRequest.issueDescription) {
      toast.error('Please specify unit and describe the issue');
      return;
    }

    try {
      const payload = {
        ...newRequest,
        unitId: parseInt(newRequest.unitId),
        cost: parseFloat(newRequest.cost as any),
      };

      await apiFetch('/api/pms/maintenance', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Maintenance ticket logged');
      setIsAddRequestOpen(false);
      setNewRequest({
        unitId: '',
        issueDescription: '',
        priority: 'MEDIUM',
        status: 'REPORTED',
        technicianName: '',
        cost: 0,
      });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to log request: ' + err.message);
    }
  };

  // Handle Update Request
  const handleUpdateRequest = async () => {
    if (!editingRequest) return;

    try {
      const payload = {
        ...editingRequest,
        cost: parseFloat(editingRequest.cost as any),
      };

      await apiFetch('/api/pms/maintenance', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Maintenance request updated');
      setEditingRequest(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update request: ' + err.message);
    }
  };

  // Helpers
  const getUnitName = (unitId: number) => {
    const u = units.find((unit) => unit.id === unitId);
    if (!u) return `Unit #${unitId}`;
    const p = properties.find((prop) => prop.id === u.propertyId);
    return p ? `${p.name} - Unit ${u.unitNumber}` : `Unit ${u.unitNumber}`;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <Badge variant="destructive">High</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Medium</Badge>;
      case 'LOW':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white inline-flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'ASSIGNED':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            Assigned
          </Badge>
        );
      case 'REPORTED':
        return (
          <Badge variant="outline" className="text-red-500 border-red-500 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Reported
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Filtered requests
  const filteredRequests = requests.filter((req) => {
    const unitName = getUnitName(req.unitId).toLowerCase();
    const desc = req.issueDescription.toLowerCase();
    const tech = req.technicianName?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return unitName.includes(q) || desc.includes(q) || tech.includes(q);
  });

  return (
    <AppLayout title="Maintenance Tickets">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tickets by property, description, tech..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setIsAddRequestOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Issue
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Queue</CardTitle>
            <CardDescription>
              Assign repairs and trace technician servicing costs.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Issue / Description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolved Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-semibold">{getUnitName(req.unitId)}</TableCell>
                    <TableCell className="max-w-xs truncate">{req.issueDescription}</TableCell>
                    <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                    <TableCell className="font-medium text-slate-700 dark:text-slate-350">
                      {req.technicianName || <span className="text-muted-foreground font-normal">Unassigned</span>}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {req.cost > 0 ? `KES ${req.cost.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {req.completionDate ? format(new Date(req.completionDate), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingRequest(req)}>
                        Update Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No maintenance tickets found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Log Issue Dialog */}
        <Dialog open={isAddRequestOpen} onOpenChange={setIsAddRequestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Maintenance Issue</DialogTitle>
              <DialogDescription>
                Report a new repair requirement for a property unit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="issueUnit">Property Unit *</Label>
                <Select
                  value={newRequest.unitId}
                  onValueChange={(val) => setNewRequest((prev) => ({ ...prev, unitId: val }))}
                >
                  <SelectTrigger id="issueUnit">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id?.toString() || ''}>
                        {getUnitName(u.id!)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="issueDesc">Issue Description *</Label>
                <Input
                  id="issueDesc"
                  value={newRequest.issueDescription}
                  onChange={(e) =>
                    setNewRequest((prev) => ({ ...prev, issueDescription: e.target.value }))
                  }
                  placeholder="Describe repair needed (e.g. leaking sink)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issuePriority">Priority</Label>
                  <Select
                    value={newRequest.priority}
                    onValueChange={(val) => setNewRequest((prev) => ({ ...prev, priority: val }))}
                  >
                    <SelectTrigger id="issuePriority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="issueStatus">Status</Label>
                  <Select
                    value={newRequest.status}
                    onValueChange={(val) => setNewRequest((prev) => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger id="issueStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REPORTED">Reported</SelectItem>
                      <SelectItem value="ASSIGNED">Assigned</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issueTech">Assigned Technician</Label>
                  <Input
                    id="issueTech"
                    value={newRequest.technicianName}
                    onChange={(e) =>
                      setNewRequest((prev) => ({ ...prev, technicianName: e.target.value }))
                    }
                    placeholder="Technician name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="issueCost">Service Cost (KES)</Label>
                  <Input
                    id="issueCost"
                    type="number"
                    value={newRequest.cost}
                    onChange={(e) =>
                      setNewRequest((prev) => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRequestOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRequest}>Log Issue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update Request Dialog */}
        <Dialog open={editingRequest !== null} onOpenChange={() => setEditingRequest(null)}>
          {editingRequest && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Ticket Status</DialogTitle>
                <DialogDescription>
                  Modify the assignment, cost, or state of this ticket.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editIssueUnit">Unit</Label>
                  <Input id="editIssueUnit" value={getUnitName(editingRequest.unitId)} disabled />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editIssueDesc">Issue Description</Label>
                  <Input id="editIssueDesc" value={editingRequest.issueDescription} disabled />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editIssuePriority">Priority</Label>
                    <Select
                      value={editingRequest.priority}
                      onValueChange={(val) => setEditingRequest((prev: any) => ({ ...prev, priority: val }))}
                    >
                      <SelectTrigger id="editIssuePriority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editIssueStatus">Status</Label>
                    <Select
                      value={editingRequest.status}
                      onValueChange={(val) => setEditingRequest((prev: any) => ({ ...prev, status: val }))}
                    >
                      <SelectTrigger id="editIssueStatus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REPORTED">Reported</SelectItem>
                        <SelectItem value="ASSIGNED">Assigned</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="editIssueTech">Assigned Technician</Label>
                    <Input
                      id="editIssueTech"
                      value={editingRequest.technicianName || ''}
                      onChange={(e) =>
                        setEditingRequest((prev: any) => ({ ...prev, technicianName: e.target.value }))
                      }
                      placeholder="Technician name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editIssueCost">Service Cost (KES)</Label>
                    <Input
                      id="editIssueCost"
                      type="number"
                      value={editingRequest.cost}
                      onChange={(e) =>
                        setEditingRequest((prev: any) => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRequest(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateRequest}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </AppLayout>
  );
}

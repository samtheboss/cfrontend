import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserRights, RightValue, rightLabels, rightCategories } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Users as UsersIcon, Shield, Edit, Check, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function RightBadge({ value }: { value: RightValue }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        value === 'yes' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
        value === 'no' && 'bg-destructive/10 text-destructive border-destructive/30',
        value === 'supervised' && 'bg-warning/10 text-warning border-warning/30'
      )}
    >
      {value === 'yes' && <Check className="h-3 w-3 mr-1" />}
      {value === 'no' && <X className="h-3 w-3 mr-1" />}
      {value === 'supervised' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </Badge>
  );
}

export default function Users() {
  const { allUsers, updateUser, user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRights, setEditingRights] = useState<UserRights | null>(null);
  const { toast } = useToast();

  const handleEditRights = (user: User) => {
    setSelectedUser(user);
    setEditingRights({ ...user.rights });
  };

  const handleRightChange = (right: keyof UserRights, value: RightValue) => {
    if (editingRights) {
      setEditingRights({ ...editingRights, [right]: value });
    }
  };

  const handleSaveRights = () => {
    if (selectedUser && editingRights) {
      updateUser(selectedUser.id, { rights: editingRights });
      toast({
        title: 'Rights updated',
        description: `Updated permissions for ${selectedUser.name}.`,
      });
      setSelectedUser(null);
      setEditingRights(null);
    }
  };

  const canManageUsers = currentUser?.rights.manageUsers === 'yes';

  return (
    <AppLayout title="User Management">
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UsersIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Users & Permissions</CardTitle>
                <CardDescription>
                  Manage user accounts and their access rights
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Rights Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium">Rights Legend:</span>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RightBadge value="yes" />
                  <span className="text-sm text-muted-foreground">Full access</span>
                </div>
                <div className="flex items-center gap-2">
                  <RightBadge value="supervised" />
                  <span className="text-sm text-muted-foreground">Requires approval</span>
                </div>
                <div className="flex items-center gap-2">
                  <RightBadge value="no" />
                  <span className="text-sm text-muted-foreground">No access</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rights Summary</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((user) => {
                  const yesCount = Object.values(user.rights).filter(v => v === 'yes').length;
                  const supervisedCount = Object.values(user.rights).filter(v => v === 'supervised').length;
                  const noCount = Object.values(user.rights).filter(v => v === 'no').length;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                            <Shield className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <span className="text-xs text-emerald-600">{yesCount} Yes</span>
                          <span className="text-xs text-amber-600">{supervisedCount} Supervised</span>
                          <span className="text-xs text-destructive">{noCount} No</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRights(user)}
                          disabled={!canManageUsers && currentUser?.id !== user.id}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Rights
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Rights Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => { setSelectedUser(null); setEditingRights(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Rights - {selectedUser?.name}</DialogTitle>
            </DialogHeader>
            
            {editingRights && (
              <div className="space-y-6">
                {Object.entries(rightCategories).map(([category, rights]) => (
                  <div key={category}>
                    <h4 className="font-medium mb-3">{category}</h4>
                    <div className="space-y-3">
                      {rights.map((right) => (
                        <div key={right} className="flex items-center justify-between">
                          <Label className="text-sm">{rightLabels[right]}</Label>
                          <Select
                            value={editingRights[right]}
                            onValueChange={(value: RightValue) => handleRightChange(right, value)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">
                                <div className="flex items-center gap-2">
                                  <Check className="h-3 w-3 text-green-600" />
                                  Yes
                                </div>
                              </SelectItem>
                              <SelectItem value="supervised">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                  Supervised
                                </div>
                              </SelectItem>
                              <SelectItem value="no">
                                <div className="flex items-center gap-2">
                                  <X className="h-3 w-3 text-red-600" />
                                  No
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedUser(null); setEditingRights(null); }}>
                Cancel
              </Button>
              <Button onClick={handleSaveRights}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

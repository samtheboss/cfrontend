import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserGroup, UserRights, RightValue, rightLabels, rightCategories, defaultRights } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Users as UsersIcon, 
  Shield, 
  Edit, 
  Check, 
  X, 
  AlertTriangle, 
  Plus, 
  Trash2,
  UserPlus,
  FolderPlus
} from 'lucide-react';
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
        value === 'supervised' && 'bg-amber-500/10 text-amber-600 border-amber-500/30'
      )}
    >
      {value === 'yes' && <Check className="h-3 w-3 mr-1" />}
      {value === 'no' && <X className="h-3 w-3 mr-1" />}
      {value === 'supervised' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </Badge>
  );
}

function RightsEditor({ 
  rights, 
  onChange 
}: { 
  rights: UserRights; 
  onChange: (right: keyof UserRights, value: RightValue) => void;
}) {
  return (
    <div className="space-y-6">
      {Object.entries(rightCategories).map(([category, categoryRights]) => (
        <div key={category}>
          <h4 className="font-medium mb-3">{category}</h4>
          <div className="space-y-3">
            {categoryRights.map((right) => (
              <div key={right} className="flex items-center justify-between">
                <Label className="text-sm">{rightLabels[right]}</Label>
                <Select
                  value={rights[right]}
                  onValueChange={(value: RightValue) => onChange(right, value)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-600" />
                        Yes
                      </div>
                    </SelectItem>
                    <SelectItem value="supervised">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        Supervised
                      </div>
                    </SelectItem>
                    <SelectItem value="no">
                      <div className="flex items-center gap-2">
                        <X className="h-3 w-3 text-destructive" />
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
  );
}

export default function Users() {
  const { 
    allUsers, 
    allGroups, 
    addUser, 
    updateUser, 
    deleteUser,
    addGroup,
    updateGroup,
    deleteGroup,
    getUserRights, 
    getGroupById,
    user: currentUser 
  } = useAuth();
  const { toast } = useToast();

  // User dialogs
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    groupId: '',
  });

  // Group dialogs
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [editingGroupRights, setEditingGroupRights] = useState<UserRights | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    rights: { ...defaultRights },
  });

  const currentUserRights = currentUser ? getUserRights(currentUser) : null;
  const canManageUsers = currentUserRights?.manageUsers === 'yes';

  // User handlers
  const handleAddUser = () => {
    if (!newUser.username || !newUser.password || !newUser.name || !newUser.groupId) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    
    // Check for duplicate username
    if (allUsers.some(u => u.username === newUser.username)) {
      toast({ title: 'Username exists', description: 'This username is already taken.', variant: 'destructive' });
      return;
    }

    addUser(newUser);
    toast({ title: 'User created', description: `${newUser.name} has been added.` });
    setNewUser({ username: '', password: '', name: '', email: '', groupId: '' });
    setIsAddUserOpen(false);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, {
      name: editingUser.name,
      email: editingUser.email,
      groupId: editingUser.groupId,
    });
    toast({ title: 'User updated', description: `${editingUser.name} has been updated.` });
    setEditingUser(null);
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser?.id) {
      toast({ title: 'Cannot delete', description: 'You cannot delete your own account.', variant: 'destructive' });
      return;
    }
    deleteUser(user.id);
    toast({ title: 'User deleted', description: `${user.name} has been removed.` });
  };

  // Group handlers
  const handleAddGroup = () => {
    if (!newGroup.name) {
      toast({ title: 'Missing name', description: 'Please enter a group name.', variant: 'destructive' });
      return;
    }

    addGroup(newGroup);
    toast({ title: 'Group created', description: `${newGroup.name} has been added.` });
    setNewGroup({ name: '', description: '', rights: { ...defaultRights } });
    setIsAddGroupOpen(false);
  };

  const handleEditGroup = (group: UserGroup) => {
    setEditingGroup(group);
    setEditingGroupRights({ ...group.rights });
  };

  const handleUpdateGroup = () => {
    if (!editingGroup || !editingGroupRights) return;
    updateGroup(editingGroup.id, {
      name: editingGroup.name,
      description: editingGroup.description,
      rights: editingGroupRights,
    });
    toast({ title: 'Group updated', description: `${editingGroup.name} has been updated.` });
    setEditingGroup(null);
    setEditingGroupRights(null);
  };

  const handleDeleteGroup = (group: UserGroup) => {
    const usersInGroup = allUsers.filter(u => u.groupId === group.id);
    if (usersInGroup.length > 0) {
      toast({ 
        title: 'Cannot delete', 
        description: `${usersInGroup.length} user(s) are in this group. Move them first.`, 
        variant: 'destructive' 
      });
      return;
    }
    deleteGroup(group.id);
    toast({ title: 'Group deleted', description: `${group.name} has been removed.` });
  };

  return (
    <AppLayout title="User Management">
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UsersIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Users & Groups</CardTitle>
                  <CardDescription>
                    Manage user accounts and permission groups
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Rights Legend */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm font-medium">Rights Legend:</span>
              <div className="flex gap-4 flex-wrap">
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

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Users ({allUsers.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Groups ({allGroups.length})
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">All Users</CardTitle>
                {canManageUsers && (
                  <Button onClick={() => setIsAddUserOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rights Summary</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user) => {
                      const userRights = getUserRights(user);
                      const group = getGroupById(user.groupId);
                      const yesCount = Object.values(userRights).filter(v => v === 'yes').length;
                      const supervisedCount = Object.values(userRights).filter(v => v === 'supervised').length;
                      const noCount = Object.values(userRights).filter(v => v === 'no').length;

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                <UsersIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">@{user.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {group?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <span className="text-xs text-emerald-600">{yesCount} Yes</span>
                              <span className="text-xs text-amber-600">{supervisedCount} Supervised</span>
                              <span className="text-xs text-destructive">{noCount} No</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingUser({ ...user })}
                                disabled={!canManageUsers && currentUser?.id !== user.id}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canManageUsers && user.id !== currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">User Groups</CardTitle>
                {canManageUsers && (
                  <Button onClick={() => setIsAddGroupOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Rights Summary</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allGroups.map((group) => {
                      const memberCount = allUsers.filter(u => u.groupId === group.id).length;
                      const yesCount = Object.values(group.rights).filter(v => v === 'yes').length;
                      const supervisedCount = Object.values(group.rights).filter(v => v === 'supervised').length;
                      const noCount = Object.values(group.rights).filter(v => v === 'no').length;

                      return (
                        <TableRow key={group.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                <Shield className="h-4 w-4 text-primary" />
                              </div>
                              <p className="font-medium">{group.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {group.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{memberCount} users</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <span className="text-xs text-emerald-600">{yesCount} Yes</span>
                              <span className="text-xs text-amber-600">{supervisedCount} Supervised</span>
                              <span className="text-xs text-destructive">{noCount} No</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditGroup(group)}
                                disabled={!canManageUsers}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canManageUsers && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteGroup(group)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={allUsers.some(u => u.groupId === group.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add User Dialog */}
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account and assign to a group.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-username">Username *</Label>
                  <Input
                    id="new-username"
                    placeholder="johndoe"
                    value={newUser.username}
                    onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Full Name *</Label>
                <Input
                  id="new-name"
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="john@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-group">User Group *</Label>
                <Select
                  value={newUser.groupId}
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, groupId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGroups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser}>Add User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details and group assignment.</DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={editingUser.username} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-group">User Group</Label>
                  <Select
                    value={editingUser.groupId}
                    onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, groupId: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={handleUpdateUser}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Group Dialog */}
        <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Group</DialogTitle>
              <DialogDescription>Create a new user group with defined permissions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name *</Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Senior Cashier"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-desc">Description</Label>
                <Textarea
                  id="group-desc"
                  placeholder="Describe the group's purpose..."
                  value={newGroup.description}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-4">Group Permissions</h4>
                <RightsEditor
                  rights={newGroup.rights}
                  onChange={(right, value) => 
                    setNewGroup(prev => ({ 
                      ...prev, 
                      rights: { ...prev.rights, [right]: value } 
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>Cancel</Button>
              <Button onClick={handleAddGroup}>Create Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Group Dialog */}
        <Dialog open={!!editingGroup} onOpenChange={() => { setEditingGroup(null); setEditingGroupRights(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Group - {editingGroup?.name}</DialogTitle>
              <DialogDescription>Modify group details and permissions.</DialogDescription>
            </DialogHeader>
            {editingGroup && editingGroupRights && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-group-name">Group Name</Label>
                  <Input
                    id="edit-group-name"
                    value={editingGroup.name}
                    onChange={(e) => setEditingGroup(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-group-desc">Description</Label>
                  <Textarea
                    id="edit-group-desc"
                    value={editingGroup.description}
                    onChange={(e) => setEditingGroup(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-4">Group Permissions</h4>
                  <RightsEditor
                    rights={editingGroupRights}
                    onChange={(right, value) => 
                      setEditingGroupRights(prev => prev ? { ...prev, [right]: value } : null)
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingGroup(null); setEditingGroupRights(null); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateGroup}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

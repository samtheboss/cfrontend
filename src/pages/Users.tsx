import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { User, UserGroup, UserRights, RightValue, rightLabels, rightCategories, defaultRights, rightDescriptions } from '@/types/user';
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
  FolderPlus,
  MapPin,
  Key,
  Search
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
  onChange,
  onGrantAll,
  onRevokeAll
}: {
  rights: UserRights;
  onChange: (right: keyof UserRights, value: RightValue) => void;
  onGrantAll?: () => void;
  onRevokeAll?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = Object.entries(rightCategories).map(([category, categoryRights]) => {
    const filteredRights = categoryRights.filter(right => {
      const q = searchQuery.toLowerCase();
      const label = (rightLabels[right] || '').toLowerCase();
      const desc = (rightDescriptions[right] || '').toLowerCase();
      return label.includes(q) || desc.includes(q) || category.toLowerCase().includes(q);
    });
    return { category, filteredRights };
  }).filter(({ filteredRights }) => filteredRights.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search permissions..." 
            className="pl-9 bg-muted/50"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {(onGrantAll || onRevokeAll) && (
          <div className="flex gap-2">
            {onGrantAll && (
              <Button type="button" variant="outline" onClick={onGrantAll} className="whitespace-nowrap text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                <Check className="w-4 h-4 mr-2" /> Grant Full Access
              </Button>
            )}
            {onRevokeAll && (
              <Button type="button" variant="outline" onClick={onRevokeAll} className="whitespace-nowrap text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                <X className="w-4 h-4 mr-2" /> Revoke All
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-8">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No permissions found matching "{searchQuery}"
          </div>
        ) : (
          filteredCategories.map(({ category, filteredRights }) => (
            <div key={category}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-200">{category}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mr-1 hidden sm:block">Set Category:</span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                      onClick={() => filteredRights.forEach(right => onChange(right, 'yes'))}
                    >
                      <Check className="w-3 h-3 mr-1" /> All Yes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                      onClick={() => filteredRights.forEach(right => onChange(right, 'supervised'))}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" /> All Supervised
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                      onClick={() => filteredRights.forEach(right => onChange(right, 'no'))}
                    >
                      <X className="w-3 h-3 mr-1" /> All No
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {filteredRights.map((right) => (
                  <div 
                    key={right} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-900/5 bg-[#FAF7F2] dark:bg-slate-900/50 gap-4 transition-colors hover:bg-amber-50/50 dark:hover:bg-slate-800/50"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{rightLabels[right]}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{rightDescriptions[right] || 'No description available.'}</div>
                    </div>
                    
                    <div className="flex bg-[#F3EFE6] dark:bg-slate-800 p-1 rounded-full w-fit">
                      {(['yes', 'no', 'supervised'] as RightValue[]).map((val) => {
                        const isActive = rights[right] === val;
                        return (
                          <button
                            key={val}
                            onClick={() => onChange(right, val)}
                            className={cn(
                              "px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200",
                              isActive 
                                ? "bg-[#8B5A2B] text-white shadow-sm" 
                                : "text-[#8B5A2B] hover:bg-black/5 dark:text-amber-500 dark:hover:bg-white/5"
                            )}
                          >
                            {val.charAt(0).toUpperCase() + val.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser, allUsers, allGroups, addUser, updateUser, deleteUser, addGroup, updateGroup, deleteGroup, resetPassword, getUserRights, getGroupById } = useAuth();
  const { locations } = useInventory();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('users');

  const staffUsers = allUsers.filter(u => u.role !== 'CUSTOMER');

  // User dialogs
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    phoneNumber: '',
    groupId: '',
    locationId: '',
  });

  // Group dialogs
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [editingGroupRights, setEditingGroupRights] = useState<UserRights | null>(null);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    rights: { ...defaultRights },
  });

  const currentUserRights = currentUser ? getUserRights(currentUser) : null;

  // Derived permissions
  const canCreateUser = currentUserRights?.createUser === 'yes';
  const canEditUser = currentUserRights?.editUser === 'yes';
  const canDeleteUser = currentUserRights?.deleteUser === 'yes';
  const canManageGroups = currentUserRights?.manageUserRoles === 'yes';

  // User handlers
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.name || !newUser.groupId) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }

    try {
      await addUser(newUser);
      toast({ title: 'User created', description: `${newUser.name} has been added.` });
      setNewUser({ username: '', password: '', name: '', email: '', phoneNumber: '', groupId: '', locationId: '' });
      setIsAddUserOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, {
      name: editingUser.name,
      email: editingUser.email,
      phoneNumber: editingUser.phoneNumber,
      groupId: editingUser.groupId,
      locationId: editingUser.locationId,
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

  const handleResetPassword = async () => {
    if (!resettingPasswordUser || !newPassword) return;
    try {
      await resetPassword(resettingPasswordUser.id, newPassword);
      toast({ title: 'Password reset', description: `Password for ${resettingPasswordUser.name} has been reset.` });
      setResettingPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reset password', variant: 'destructive' });
    }
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
    setActiveTab('groups');
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
    const usersInGroup = staffUsers.filter(u => u.groupId === group.id);
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Users ({staffUsers.length})
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Groups ({allGroups.length})
            </TabsTrigger>
            {canManageGroups && (
              <TabsTrigger value="add-group" className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Add Group
              </TabsTrigger>
            )}
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">All Users</CardTitle>
                {canCreateUser && (
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
                      <TableHead>Primary Location</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rights Summary</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffUsers.map((user) => {
                      const userRights = getUserRights(user);
                      const group = getGroupById(user.groupId);
                      const yesCount = Object.values(userRights).filter(v => v === 'yes').length;
                      const supervisedCount = Object.values(userRights).filter(v => v === 'supervised').length;
                      const noCount = Object.values(userRights).filter(v => v === 'no').length;

                      const isSelf = currentUser?.id === user.id;

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
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {user.locationId === 'all' ? 'All Locations' : locations.find(l => l.id.toString() === String(user.locationId))?.name || 'None'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-sm">
                              <span className="text-muted-foreground">{user.email || '-'}</span>
                              {user.phoneNumber && <span className="text-xs text-muted-foreground/70">{user.phoneNumber}</span>}
                            </div>
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
                                onClick={() => setEditingUser({ ...user })}
                                disabled={!canEditUser && !isSelf}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canEditUser && !isSelf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setResettingPasswordUser(user)}
                                  title="Reset Password"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteUser && !isSelf && (
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
                {canManageGroups && (
                  <Button onClick={() => setActiveTab('add-group')}>
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
                      const memberCount = staffUsers.filter(u => u.groupId === group.id).length;
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
                                disabled={!canManageGroups}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canManageGroups && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteGroup(group)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={staffUsers.some(u => u.groupId === group.id)}
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

          {/* Add Group Tab */}
          {canManageGroups && (
            <TabsContent value="add-group">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Group</CardTitle>
                  <CardDescription>Create a new user group with defined permissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <Input
                        id="group-desc"
                        placeholder="Describe the group's purpose..."
                        value={newGroup.description}
                        onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <RightsEditor
                      rights={newGroup.rights}
                      onChange={(right, value) =>
                        setNewGroup(prev => ({
                          ...prev,
                          rights: { ...prev.rights, [right]: value }
                        }))
                      }
                      onGrantAll={() => {
                        const allYes = Object.keys(newGroup.rights).reduce((acc, key) => {
                          acc[key as keyof UserRights] = 'yes';
                          return acc;
                        }, {} as UserRights);
                        setNewGroup(prev => ({ ...prev, rights: allYes }));
                      }}
                      onRevokeAll={() => {
                        const allNo = Object.keys(newGroup.rights).reduce((acc, key) => {
                          acc[key as keyof UserRights] = 'no';
                          return acc;
                        }, {} as UserRights);
                        setNewGroup(prev => ({ ...prev, rights: allNo }));
                      }}
                    />
                  </div>
                  <div className="sticky bottom-0 bg-card p-4 -mx-6 -mb-6 border-t flex justify-end gap-3 z-10 mt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                    <Button variant="outline" onClick={() => setActiveTab('groups')}>Cancel</Button>
                    <Button onClick={handleAddGroup}>Create Group</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
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
                    autoComplete="off"
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
                    autoComplete="new-password"
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
                <Label htmlFor="new-phone">Phone Number</Label>
                <Input
                  id="new-phone"
                  placeholder="+254..."
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser(prev => ({ ...prev, phoneNumber: e.target.value }))}
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
              <div className="space-y-2">
                <Label htmlFor="new-location">Main Location</Label>
                <Select
                  value={newUser.locationId ? String(newUser.locationId) : ''}
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, locationId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
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
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editingUser.phoneNumber || ''}
                    onChange={(e) => setEditingUser(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
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
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Main Location</Label>
                  <Select
                    value={editingUser.locationId ? String(editingUser.locationId) : ''}
                    onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, locationId: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={String(loc.id)}>
                          {loc.name}
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

        {/* Reset Password Dialog */}
        <Dialog open={!!resettingPasswordUser} onOpenChange={(open) => { if (!open) { setResettingPasswordUser(null); setNewPassword(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Enter a new password for {resettingPasswordUser?.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResettingPasswordUser(null); setNewPassword(''); }}>Cancel</Button>
              <Button onClick={handleResetPassword}>Reset Password</Button>
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
                    onGrantAll={() => {
                      const allYes = Object.keys(editingGroupRights).reduce((acc, key) => {
                        acc[key as keyof UserRights] = 'yes';
                        return acc;
                      }, {} as UserRights);
                      setEditingGroupRights(allYes);
                    }}
                    onRevokeAll={() => {
                      const allNo = Object.keys(editingGroupRights).reduce((acc, key) => {
                        acc[key as keyof UserRights] = 'no';
                        return acc;
                      }, {} as UserRights);
                      setEditingGroupRights(allNo);
                    }}
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

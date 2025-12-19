import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Loader, Plus, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'showroom'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (userToEdit = null) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormData({
        username: userToEdit.username,
        password: '',
        email: userToEdit.email || '',
        full_name: userToEdit.full_name,
        role: userToEdit.role
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        email: '',
        full_name: '',
        role: 'showroom'
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update user
        await axios.put(`${API_URL}/users/${editingUser.id}`, formData);
        toast.success('Kullanıcı güncellendi');
      } else {
        // Create new user
        await axios.post(`${API_URL}/auth/register`, formData);
        toast.success('Kullanıcı oluşturuldu');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await axios.patch(`${API_URL}/users/${userId}/toggle-active`);
      toast.success('Kullanıcı durumu güncellendi');
      fetchUsers();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/users/${userId}`);
      toast.success('Kullanıcı silindi');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Silme başarısız');
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      showroom: 'Showroom',
      corporate_sales: 'Kurumsal Satış',
      warehouse: 'Depo',
      finance: 'Finans',
      accounting: 'Muhasebe',
      admin: 'Admin'
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      showroom: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      corporate_sales: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
      finance: 'bg-pink-100 text-pink-800 border-pink-200',
      accounting: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-zinc-900 text-white border-zinc-900'
    };
    return colors[role] || 'bg-zinc-100 text-zinc-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const canManageUsers = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Kullanıcılar
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {users.length} kullanıcı listeleniyor
          </p>
        </div>
        {canManageUsers && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" onClick={() => handleOpenDialog()} data-testid="create-user-button">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Kullanıcı
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Oluştur'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Kullanıcı Adı *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    required
                    data-testid="user-username-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Şifre {editingUser ? '(Değiştirmek için doldurun)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editingUser}
                    data-testid="user-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Ad Soyad *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                    data-testid="user-fullname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    data-testid="user-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    required
                    data-testid="user-role-select"
                  >
                    <option value="showroom">Showroom</option>
                    <option value="corporate_sales">Kurumsal Satış</option>
                    <option value="warehouse">Depo</option>
                    <option value="finance">Finans</option>
                    <option value="accounting">Muhasebe</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit" data-testid="submit-user-button">
                    {editingUser ? 'Güncelle' : 'Oluştur'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u) => (
          <Card
            key={u.id}
            className="p-6 border-zinc-200"
            data-testid={`user-${u.username}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-700 text-lg">
                {u.full_name?.charAt(0) || 'U'}
              </div>
              <Badge className={getRoleBadgeColor(u.role)}>
                {getRoleLabel(u.role)}
              </Badge>
            </div>
            <div className="space-y-2 mb-4">
              <div>
                <p className="font-semibold text-zinc-900">{u.full_name}</p>
                <p className="text-sm text-zinc-600 font-mono">@{u.username}</p>
              </div>
              {u.email && (
                <p className="text-sm text-zinc-600">{u.email}</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-800'}>
                  {u.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>
            </div>
            
            {canManageUsers && (
              <div className="flex gap-2 pt-4 border-t border-zinc-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(u)}
                  data-testid={`edit-user-${u.username}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(u.id)}
                  data-testid={`toggle-user-${u.username}`}
                >
                  {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
                {u.id !== user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(u.id)}
                    className="text-red-600 hover:text-red-700"
                    data-testid={`delete-user-${u.username}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Users;

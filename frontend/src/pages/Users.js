import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
          Kullanıcılar
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          {users.length} kullanıcı listeleniyor
        </p>
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
            <div className="space-y-2">
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
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Users;

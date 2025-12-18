import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ShoppingCart, 
  Clock, 
  Loader, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Package
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleGreeting = () => {
    const greetings = {
      showroom: 'Showroom Dashboard',
      corporate_sales: 'Kurumsal Satış Dashboard',
      warehouse: 'Depo Dashboard',
      finance: 'Finans Dashboard',
      accounting: 'Muhasebe Dashboard',
      admin: 'Yönetici Dashboard'
    };
    return greetings[user?.role] || 'Dashboard';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Toplam Siparişler',
      value: stats?.total_orders || 0,
      icon: ShoppingCart,
      color: 'text-zinc-600',
      bgColor: 'bg-zinc-100',
      show: true
    },
    {
      title: 'Bilgi Bekleyen',
      value: stats?.waiting_info || 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      show: true
    },
    {
      title: 'İşlemde',
      value: stats?.in_progress || 0,
      icon: Loader,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      show: true
    },
    {
      title: 'Hazır',
      value: stats?.ready || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      show: true
    },
    {
      title: 'Fatura Bekleyen',
      value: stats?.pending_invoices || 0,
      icon: FileText,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      show: ['accounting', 'finance', 'admin'].includes(user?.role)
    },
    {
      title: 'Temin Edilecek',
      value: stats?.items_to_procure || 0,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      show: ['warehouse', 'finance', 'admin'].includes(user?.role)
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            {getRoleGreeting()}
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Hoş geldiniz, {user?.full_name}
          </p>
        </div>
        <Link to="/orders/new">
          <Button size="lg" data-testid="new-order-button">
            + Yeni Sipariş
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statCards.filter(card => card.show).map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="p-6 hover:shadow-md transition-shadow duration-200 border-zinc-200"
              data-testid={`stat-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-600 mb-1">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold font-heading tracking-tight text-zinc-900">
                    {card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-6 w-6 ${card.color}`} strokeWidth={1.5} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="p-6 border-zinc-200">
        <h2 className="text-xl font-bold font-heading tracking-tight text-zinc-900 mb-4">
          Hızlı İşlemler
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/orders/new">
            <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="quick-new-order">
              <ShoppingCart className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Yeni Sipariş Oluştur</div>
                <div className="text-xs text-zinc-500">Hızlı sipariş girişi</div>
              </div>
            </Button>
          </Link>
          
          <Link to="/orders">
            <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="quick-view-orders">
              <Clock className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Bekleyen Siparişler</div>
                <div className="text-xs text-zinc-500">Bilgi bekleyen siparişler</div>
              </div>
            </Button>
          </Link>
          
          <Link to="/products">
            <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="quick-view-products">
              <Package className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Ürün Kataloğu</div>
                <div className="text-xs text-zinc-500">Ürünleri görüntüle</div>
              </div>
            </Button>
          </Link>
        </div>
      </Card>

      {/* Alerts */}
      {(stats?.waiting_info > 0 || stats?.pending_invoices > 0 || stats?.items_to_procure > 0) && (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-2">Dikkat Gereken Konular</h3>
              <ul className="space-y-1 text-sm text-amber-800">
                {stats?.waiting_info > 0 && (
                  <li>• {stats.waiting_info} sipariş bilgi bekliyor</li>
                )}
                {stats?.pending_invoices > 0 && user?.role === 'accounting' && (
                  <li>• {stats.pending_invoices} siparişin faturası kesilmedi</li>
                )}
                {stats?.items_to_procure > 0 && ['warehouse', 'finance', 'admin'].includes(user?.role) && (
                  <li>• {stats.items_to_procure} kalem temin edilmeli</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

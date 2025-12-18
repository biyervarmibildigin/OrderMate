import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Loader, Plus, Search } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderTypeBadge = (type) => {
    const types = {
      showroom_satis: { label: 'Perakende', variant: 'emerald' },
      cari_kurumsal: { label: 'Kurumsal', variant: 'indigo' },
      eksik_bilgili: { label: 'Eksik Bilgi', variant: 'amber' }
    };
    const config = types[type] || { label: type, variant: 'zinc' };
    return (
      <Badge className={`bg-${config.variant}-100 text-${config.variant}-800 border-${config.variant}-200`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const statuses = {
      bilgi_bekliyor: { label: 'Bilgi Bekliyor', color: 'bg-amber-100 text-amber-800' },
      islemde: { label: 'İşlemde', color: 'bg-blue-100 text-blue-800' },
      hazir: { label: 'Hazır', color: 'bg-emerald-100 text-emerald-800' },
      tamamlandi: { label: 'Tamamlandı', color: 'bg-zinc-100 text-zinc-800' }
    };
    const config = statuses[status] || { label: status, color: 'bg-zinc-100 text-zinc-800' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.order_number?.toString().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.created_by_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Siparişler
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {filteredOrders.length} sipariş listeleniyor
          </p>
        </div>
        <Link to="/orders/new">
          <Button size="lg" data-testid="create-order-button">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Sipariş
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Sipariş numarası, müşteri adı veya oluşturan ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="search-orders-input"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card className="p-12 text-center border-zinc-200">
            <p className="text-zinc-500">Henüz sipariş bulunmuyor.</p>
            <Link to="/orders/new">
              <Button className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                İlk Siparişi Oluştur
              </Button>
            </Link>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Link key={order.id} to={`/orders/${order.id}`} data-testid={`order-${order.order_number}`}>
              <Card className="p-6 hover:shadow-md transition-all duration-200 border-zinc-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold font-mono text-zinc-900">
                        #{order.order_number}
                      </span>
                      {getOrderTypeBadge(order.order_type)}
                      {getStatusBadge(order.general_status)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-900">
                        Müşteri: {order.customer_name || 'Belirtilmemiş'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Oluşturan: {order.created_by_name} • {new Date(order.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs text-zinc-500">
                      Fatura: {order.invoice_status === 'kesildi' ? '✓ Kesildi' : '× Kesilmedi'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Kargo: {order.cargo_status === 'teslim' ? '✓ Teslim' : order.cargo_status}
                    </p>
                    {order.delivery_method && (
                      <p className="text-xs text-zinc-500">
                        Teslimat: {order.delivery_method === 'kargo' ? 'Kargo' : 'Elden'}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Orders;

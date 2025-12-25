import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Loader, Plus, Search, Filter, X, FileText, Truck, Receipt } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Orders = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: searchParams.get('general_status') || '',
    invoice_status: searchParams.get('invoice_status') || '',
    waybill_status: searchParams.get('waybill_status') || '',
    cargo_status: searchParams.get('cargo_status') || '',
    cargo_barcode_status: searchParams.get('cargo_barcode_status') || '',
    order_type: searchParams.get('order_type') || '',
    item_status: searchParams.get('item_status') || '',
    my_orders: searchParams.get('my_orders') === 'true'
  });

  // URL parametreleri değiştiğinde filtreleri güncelle
  useEffect(() => {
    const newFilters = {
      status: searchParams.get('general_status') || '',
      invoice_status: searchParams.get('invoice_status') || '',
      waybill_status: searchParams.get('waybill_status') || '',
      cargo_status: searchParams.get('cargo_status') || '',
      cargo_barcode_status: searchParams.get('cargo_barcode_status') || '',
      order_type: searchParams.get('order_type') || '',
      item_status: searchParams.get('item_status') || '',
      my_orders: searchParams.get('my_orders') === 'true'
    };
    setFilters(newFilters);
    // URL'de filtre varsa filtre panelini aç
    if (Object.values(newFilters).some(v => v)) {
      setShowFilters(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchOrders();
  }, [filters, searchTerm]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.invoice_status) params.append('invoice_status', filters.invoice_status);
      if (filters.waybill_status) params.append('waybill_status', filters.waybill_status);
      if (filters.cargo_status) params.append('cargo_status', filters.cargo_status);
      if (filters.cargo_barcode_status) params.append('cargo_barcode_status', filters.cargo_barcode_status);
      if (filters.order_type) params.append('order_type', filters.order_type);
      if (filters.item_status) params.append('item_status', filters.item_status);
      if (filters.my_orders) params.append('my_orders', 'true');
      if (searchTerm) params.append('search', searchTerm.trim());
      
      const url = `${API_URL}/orders${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.get(url);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      invoice_status: '',
      waybill_status: '',
      cargo_status: '',
      cargo_barcode_status: '',
      order_type: '',
      item_status: '',
      my_orders: false
    });
    setSearchParams({});
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  const getOrderTypeBadge = (type) => {
    const types = {
      teklif: { label: 'Teklif', color: 'bg-purple-100 text-purple-800' },
      showroom_satis: { label: 'Perakende', color: 'bg-emerald-100 text-emerald-800' },
      cari_kurumsal: { label: 'Kurumsal Cari', color: 'bg-indigo-100 text-indigo-800' },
      kurumsal_pesin: { label: 'Kurumsal Peşin', color: 'bg-blue-100 text-blue-800' },
      eksik_bilgili: { label: 'Eksik Bilgi', color: 'bg-amber-100 text-amber-800' }
    };
    const config = types[type] || { label: type, color: 'bg-zinc-100 text-zinc-800' };
    return <Badge className={config.color}>{config.label}</Badge>;
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

  const getInvoiceBadge = (status) => {
    return status === 'kesildi' 
      ? <Badge className="bg-emerald-100 text-emerald-800"><Receipt className="h-3 w-3 mr-1" />Fatura ✓</Badge>
      : <Badge className="bg-red-100 text-red-800"><Receipt className="h-3 w-3 mr-1" />Fatura ✗</Badge>;
  };

  const getWaybillBadge = (status) => {
    return status === 'kesildi'
      ? <Badge className="bg-emerald-100 text-emerald-800"><FileText className="h-3 w-3 mr-1" />İrsaliye ✓</Badge>
      : <Badge className="bg-red-100 text-red-800"><FileText className="h-3 w-3 mr-1" />İrsaliye ✗</Badge>;
  };

  // Liste, backend filtre ve arama parametrelerine göre geliyor
  const filteredOrders = orders;

  if (loading && orders.length === 0) {
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
            {activeFilterCount > 0 && ` (${activeFilterCount} filtre aktif)`}
          </p>
        </div>
        <Link to="/orders/new">
          <Button size="lg" data-testid="create-order-button">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Sipariş
          </Button>
        </Link>
      </div>

      {/* Search and Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Sipariş numarası, müşteri adı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtrele
          {activeFilterCount > 0 && (
            <Badge className="bg-white text-zinc-900 ml-1">{activeFilterCount}</Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4 border-zinc-200 bg-zinc-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Filtreler</h3>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-zinc-500">
                <X className="h-4 w-4 mr-1" />
                Temizle
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Genel Durum */}
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Genel Durum</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="w-full h-9 px-3 rounded-md border border-zinc-300 text-sm bg-white"
              >
                <option value="">Tümü</option>
                <option value="bilgi_bekliyor">Bilgi Bekliyor</option>
                <option value="islemde">İşlemde</option>
                <option value="hazir">Hazır</option>
                <option value="tamamlandi">Tamamlandı</option>
              </select>
            </div>

            {/* Fatura Durumu */}
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Fatura Durumu</label>
              <select
                value={filters.invoice_status}
                onChange={(e) => setFilters({...filters, invoice_status: e.target.value})}
                className="w-full h-9 px-3 rounded-md border border-zinc-300 text-sm bg-white"
              >
                <option value="">Tümü</option>
                <option value="kesilmedi">Kesilmedi</option>
                <option value="kesildi">Kesildi</option>
              </select>
            </div>

            {/* İrsaliye Durumu */}
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">İrsaliye Durumu</label>
              <select
                value={filters.waybill_status}
                onChange={(e) => setFilters({...filters, waybill_status: e.target.value})}
                className="w-full h-9 px-3 rounded-md border border-zinc-300 text-sm bg-white"
              >
                <option value="">Tümü</option>
                <option value="kesilmedi">Kesilmedi</option>
                <option value="kesildi">Kesildi</option>
              </select>
            </div>

            {/* Kargo Durumu */}
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Kargo Durumu</label>
              <select
                value={filters.cargo_status}
                onChange={(e) => setFilters({...filters, cargo_status: e.target.value})}
                className="w-full h-9 px-3 rounded-md border border-zinc-300 text-sm bg-white"
              >
                <option value="">Tümü</option>
                <option value="yok">Yok</option>
                <option value="hazirlaniyor">Kargo Hazırlanıyor</option>
                <option value="kargo_hazirlandi">Kargo Hazırlandı</option>
                <option value="paketlendi">Paketlendi</option>
                <option value="gonderime_hazir">Gönderime Hazır</option>
                <option value="kargoda">Kargoda</option>
                <option value="teslim">Teslim Edildi</option>
              </select>
            </div>

            {/* Sipariş Türü */}
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Sipariş Türü</label>
              <select
                value={filters.order_type}
                onChange={(e) => setFilters({...filters, order_type: e.target.value})}
                className="w-full h-9 px-3 rounded-md border border-zinc-300 text-sm bg-white"
              >
                <option value="">Tümü</option>
                <option value="teklif">Teklif</option>
                <option value="showroom_satis">Perakende</option>
                <option value="cari_kurumsal">Kurumsal Cari</option>
                <option value="kurumsal_pesin">Kurumsal Peşin</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filters.invoice_status === 'kesilmedi' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({...filters, invoice_status: filters.invoice_status === 'kesilmedi' ? '' : 'kesilmedi'})}
          className="gap-1"
        >
          <Receipt className="h-3 w-3" />
          Fatura Kesilmedi
        </Button>
        <Button
          variant={filters.waybill_status === 'kesilmedi' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({...filters, waybill_status: filters.waybill_status === 'kesilmedi' ? '' : 'kesilmedi'})}
          className="gap-1"
        >
          <FileText className="h-3 w-3" />
          İrsaliye Kesilmedi
        </Button>
        <Button
          variant={filters.status === 'bilgi_bekliyor' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({...filters, status: filters.status === 'bilgi_bekliyor' ? '' : 'bilgi_bekliyor'})}
        >
          Bilgi Bekliyor
        </Button>
        <Button
          variant={filters.cargo_status === 'kargoda' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({...filters, cargo_status: filters.cargo_status === 'kargoda' ? '' : 'kargoda'})}
          className="gap-1"
        >
          <Truck className="h-3 w-3" />
          Kargoda
        </Button>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader className="h-5 w-5 animate-spin text-zinc-400 mr-2" />
          <span className="text-sm text-zinc-500">Yükleniyor...</span>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 && !loading ? (
          <Card className="p-12 text-center border-zinc-200">
            <p className="text-zinc-500">
              {activeFilterCount > 0 ? 'Bu filtrelere uygun sipariş bulunamadı.' : 'Henüz sipariş bulunmuyor.'}
            </p>
            {activeFilterCount > 0 ? (
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                Filtreleri Temizle
              </Button>
            ) : (
              <Link to="/orders/new">
                <Button className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  İlk Siparişi Oluştur
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Link key={order.id} to={`/orders/${order.order_code || order.id}`}>
              <Card className="p-6 hover:shadow-md transition-all duration-200 border-zinc-200 hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold font-mono text-zinc-900">
                        {order.order_code || `#${order.order_number}`}
                      </span>
                      {getOrderTypeBadge(order.order_type)}
                      {getStatusBadge(order.general_status)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-600">
                      <span>{order.customer_name || order.company_name || 'Müşteri belirtilmemiş'}</span>
                      <span>•</span>
                      <span>{new Date(order.created_at).toLocaleDateString('tr-TR')}</span>
                      <span>•</span>
                      <span className="text-zinc-400">{order.created_by_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getInvoiceBadge(order.invoice_status)}
                    {getWaybillBadge(order.waybill_status)}
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

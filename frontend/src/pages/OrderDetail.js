import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Loader, FileDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [newItem, setNewItem] = useState({
    product_name: '',
    product_id: '',
    quantity: 1,
    item_type: 'katalog_urunu',
    item_status: 'netlesecek'
  });

  useEffect(() => {
    fetchOrderDetail();
    fetchProducts();
  }, [id]);

  const fetchOrderDetail = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders/${id}`);
      setOrder(response.data.order);
      setItems(response.data.items);
    } catch (error) {
      toast.error('Sipariş yüklenemedi');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products?limit=100`);
      setProducts(response.data);
    } catch (error) {
      console.error('Products fetch failed:', error);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.product_name) {
      toast.error('Ürün adı gerekli');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/order-items`, {
        ...newItem,
        order_id: id
      });
      setItems([...items, response.data]);
      setNewItem({
        product_name: '',
        product_id: '',
        quantity: 1,
        item_type: 'katalog_urunu',
        item_status: 'netlesecek'
      });
      toast.success('Kalem eklendi');
    } catch (error) {
      toast.error('Kalem eklenemedi: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await axios.delete(`${API_URL}/order-items/${itemId}`);
      setItems(items.filter(item => item.id !== itemId));
      toast.success('Kalem silindi');
    } catch (error) {
      toast.error('Kalem silinemedi');
    }
  };

  const handleUpdateItemStatus = async (itemId, newStatus) => {
    try {
      const item = items.find(i => i.id === itemId);
      await axios.put(`${API_URL}/order-items/${itemId}`, {
        ...item,
        item_status: newStatus
      });
      setItems(items.map(i => i.id === itemId ? { ...i, item_status: newStatus } : i));
      toast.success('Durum güncellendi');
    } catch (error) {
      toast.error('Durum güncellenemedi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!order) return null;

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

  const getItemStatusLabel = (status) => {
    const labels = {
      netlesecek: 'Netleşecek',
      stokta: 'Stokta',
      temin_edilecek: 'Temin Edilecek',
      uretimde: 'Üretimde',
      hazir: 'Hazır',
      gonderildi: 'Gönderildi',
      iptal: 'İptal'
    };
    return labels[status] || status;
  };

  const getCargoTrackingUrl = (company, trackingCode) => {
    if (!company || !trackingCode) return '#';
    
    const urls = {
      'aras': `https://www.araskargo.com.tr/tr/cargo-tracking?code=${trackingCode}`,
      'yurtici': `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${trackingCode}`,
      'mng': `https://www.mngkargo.com.tr/shipmentquery?q=${trackingCode}`,
      'ups': `https://www.ups.com/track?tracknum=${trackingCode}`,
      'dhl': `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${trackingCode}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingCode}`,
      'ptt': `https://gonderitakip.ptt.gov.tr/Track/Verify?barcode=${trackingCode}`,
      'sürat': `https://www.suratkargo.com.tr/kargo-takip?code=${trackingCode}`,
      'horoz': `https://www.horozlojistik.com/tr/kargo-takip?code=${trackingCode}`
    };
    
    const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
    return urls[normalizedCompany] || `https://www.google.com/search?q=${encodeURIComponent(company + ' kargo takip ' + trackingCode)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/orders')}
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
              Sipariş #{order.order_number}
            </h1>
            {getStatusBadge(order.general_status)}
          </div>
          <p className="text-sm text-zinc-600 mt-1">
            Oluşturan: {order.created_by_name} • {new Date(order.created_at).toLocaleString('tr-TR')}
          </p>
        </div>
        {/* PDF Download for Teklif */}
        {order.order_type === 'teklif' && (
          <a
            href={`${API_URL}/orders/${order.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <Button variant="outline" size="lg">
              <FileDown className="mr-2 h-4 w-4" />
              Teklif PDF İndir
            </Button>
          </a>
        )}
      </div>

      {/* Order Info */}
      <Card className="p-6 border-zinc-200">
        <h2 className="text-xl font-bold font-heading mb-4">Sipariş Bilgileri</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Müşteri</p>
            <p className="font-semibold">{order.customer_name || '-'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Telefon</p>
            <p className="font-semibold">{order.customer_phone || '-'}</p>
          </div>
          <div>
            <p className="text-zinc-500">E-posta</p>
            <p className="font-semibold">{order.customer_email || '-'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Teslimat</p>
            <p className="font-semibold">{order.delivery_method === 'kargo' ? 'Kargo' : order.delivery_method === 'elden' ? 'Elden' : '-'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Fatura Durumu</p>
            <p className="font-semibold">{order.invoice_status === 'kesildi' ? 'Kesildi' : 'Kesilmedi'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Kargo Durumu</p>
            <p className="font-semibold">{order.cargo_status}</p>
          </div>
          {order.cargo_company && (
            <div>
              <p className="text-zinc-500">Kargo Firması</p>
              <p className="font-semibold capitalize">{order.cargo_company}</p>
            </div>
          )}
          {order.cargo_tracking_code && (
            <div className="md:col-span-2">
              <p className="text-zinc-500 mb-1">Kargo Takip</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-semibold">{order.cargo_tracking_code}</p>
                <a
                  href={getCargoTrackingUrl(order.cargo_company, order.cargo_tracking_code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  Takip Et →
                </a>
              </div>
            </div>
          )}
        </div>
        {order.whatsapp_content && (
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <p className="text-zinc-500 text-sm mb-2">WhatsApp İçeriği</p>
            <p className="text-sm bg-zinc-50 p-3 rounded-md whitespace-pre-wrap">{order.whatsapp_content}</p>
          </div>
        )}
      </Card>

      {/* Order Items */}
      <Card className="p-6 border-zinc-200">
        <h2 className="text-xl font-bold font-heading mb-4">Sipariş Kalemleri</h2>
        
        <div className="space-y-3 mb-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-zinc-50 rounded-md border border-zinc-200"
              data-testid={`order-item-${item.id}`}
            >
              <div className="flex-1">
                <p className="font-semibold text-zinc-900">{item.product_name}</p>
                <p className="text-sm text-zinc-500">Adet: {item.quantity}</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={item.item_status}
                  onChange={(e) => handleUpdateItemStatus(item.id, e.target.value)}
                  className="w-40 h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                >
                  <option value="netlesecek">Netleşecek</option>
                  <option value="stokta">Stokta</option>
                  <option value="temin_edilecek">Temin Edilecek</option>
                  <option value="uretimde">Üretimde</option>
                  <option value="hazir">Hazır</option>
                  <option value="gonderildi">Gönderildi</option>
                  <option value="iptal">İptal</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteItem(item.id)}
                  data-testid={`delete-item-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Add New Item */}
        <div className="pt-4 border-t border-zinc-200">
          <h3 className="font-semibold mb-3">Yeni Kalem Ekle</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <Input
                placeholder="Ürün adı"
                value={newItem.product_name}
                onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                data-testid="new-item-product-name"
              />
            </div>
            <div className="md:col-span-2">
              <Input
                type="number"
                placeholder="Adet"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                data-testid="new-item-quantity"
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={newItem.item_status}
                onChange={(e) => setNewItem({ ...newItem, item_status: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
              >
                <option value="netlesecek">Netleşecek</option>
                <option value="stokta">Stokta</option>
                <option value="temin_edilecek">Temin Edilecek</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleAddItem} className="w-full" data-testid="add-item-button">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OrderDetail;

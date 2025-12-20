import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Loader, FileDown, Edit, History, MessageSquarePlus, Save, X, AlertTriangle, Search } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Ürün arama state'leri
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);
  const [newItem, setNewItem] = useState({
    product_name: '',
    product_id: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    item_type: 'katalog_urunu',
    item_status: 'netlesecek'
  });

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  // Ürün arama effect'i
  useEffect(() => {
    const searchProducts = async () => {
      if (!debouncedProductSearch || debouncedProductSearch.length < 2) {
        setProductSearchResults([]);
        return;
      }
      setSearchingProducts(true);
      try {
        const response = await axios.get(`${API_URL}/products/search?q=${encodeURIComponent(debouncedProductSearch)}&limit=20`);
        setProductSearchResults(response.data);
      } catch (error) {
        console.error('Product search failed:', error);
      } finally {
        setSearchingProducts(false);
      }
    };
    searchProducts();
  }, [debouncedProductSearch]);

  const fetchOrderDetail = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders/${id}`);
      setOrder(response.data.order);
      setItems(response.data.items);
      setEditData(response.data.order);
    } catch (error) {
      toast.error('Sipariş yüklenemedi');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  // Ürün seçildiğinde
  const handleSelectProductForItem = (product) => {
    setNewItem({
      ...newItem,
      product_name: product.name,
      product_id: product.product_id,
      unit_price: product.price || 0,
      total_price: (product.price || 0) * newItem.quantity,
      item_type: 'katalog_urunu'
    });
    setProductSearchTerm('');
    setProductSearchResults([]);
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/orders/${id}`, editData);
      toast.success('Sipariş güncellendi');
      setEditMode(false);
      fetchOrderDetail();
    } catch (error) {
      toast.error('Güncelleme başarısız: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await axios.post(`${API_URL}/orders/${id}/add-note`, { note: newNote });
      toast.success('Not eklendi');
      setNoteDialogOpen(false);
      setNewNote('');
      fetchOrderDetail();
    } catch (error) {
      toast.error('Not eklenemedi');
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
        unit_price: 0,
        total_price: 0,
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

  const handleDeleteOrder = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/orders/${id}`);
      toast.success('Sipariş silindi');
      navigate('/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Sipariş silinemedi');
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
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

  const statusOptions = [
    { value: 'bilgi_bekliyor', label: 'Bilgi Bekliyor', color: 'bg-amber-100 text-amber-800' },
    { value: 'islemde', label: 'İşlemde', color: 'bg-blue-100 text-blue-800' },
    { value: 'hazir', label: 'Hazır', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'tamamlandi', label: 'Tamamlandı', color: 'bg-zinc-100 text-zinc-800' }
  ];

  const invoiceStatusOptions = [
    { value: 'kesilmedi', label: 'Kesilmedi', color: 'bg-amber-100 text-amber-800' },
    { value: 'kesildi', label: 'Kesildi', color: 'bg-emerald-100 text-emerald-800' }
  ];

  const waybillStatusOptions = [
    { value: 'kesilmedi', label: 'Kesilmedi', color: 'bg-amber-100 text-amber-800' },
    { value: 'kesildi', label: 'Kesildi', color: 'bg-emerald-100 text-emerald-800' }
  ];

  const cargoStatusOptions = [
    { value: 'yok', label: 'Yok', color: 'bg-zinc-100 text-zinc-800' },
    { value: 'hazirlaniyor', label: 'Hazırlanıyor', color: 'bg-amber-100 text-amber-800' },
    { value: 'kargoda', label: 'Kargoda', color: 'bg-blue-100 text-blue-800' },
    { value: 'teslim', label: 'Teslim Edildi', color: 'bg-emerald-100 text-emerald-800' }
  ];

  const getStatusBadge = (status, options) => {
    const config = options.find(o => o.value === status) || { label: status, color: 'bg-zinc-100 text-zinc-800' };
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
      'ptt': `https://gonderitakip.ptt.gov.tr/Track/Verify?barcode=${trackingCode}`,
    };
    const normalizedCompany = company.toLowerCase().replace(/\s+/g, '');
    return urls[normalizedCompany] || `https://www.google.com/search?q=${encodeURIComponent(company + ' kargo takip ' + trackingCode)}`;
  };

  const totalPrice = items.reduce((sum, item) => sum + (item.total_price || item.quantity * item.unit_price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
              Sipariş {order.order_code || `#${order.order_number}`}
            </h1>
            {getStatusBadge(order.general_status, statusOptions)}
          </div>
          <p className="text-sm text-zinc-600 mt-1">
            Oluşturan: {order.created_by_name} • {new Date(order.created_at).toLocaleString('tr-TR')}
          </p>
        </div>
        <div className="flex gap-2">
          {order.order_type === 'teklif' && (
            <Button 
              variant="outline" 
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(`${API_URL}/orders/${order.id}/pdf`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `teklif_${order.order_number}.pdf`;
                  a.click();
                } catch (error) {
                  toast.error('PDF indirilemedi');
                }
              }}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Teklif PDF İndir
            </Button>
          )}
          {!editMode ? (
            <div className="flex gap-2">
              <Button onClick={() => setEditMode(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Düzenle
              </Button>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditMode(false); setEditData(order); }}>
                <X className="mr-2 h-4 w-4" />
                İptal
              </Button>
              <Button onClick={handleSaveOrder} disabled={saving}>
                {saving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Kaydet
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Order Info & Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Details */}
        <Card className="p-6 border-zinc-200">
          <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4">Sipariş Bilgileri</h2>
          
          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Müşteri Adı</Label>
                  <Input value={editData.customer_name || ''} onChange={(e) => setEditData({...editData, customer_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={editData.customer_phone || ''} onChange={(e) => setEditData({...editData, customer_phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input value={editData.customer_email || ''} onChange={(e) => setEditData({...editData, customer_email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Teslimat</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-zinc-300" value={editData.delivery_method || ''} onChange={(e) => setEditData({...editData, delivery_method: e.target.value})}>
                    <option value="">Seçiniz</option>
                    <option value="kargo">Kargo</option>
                    <option value="showroom_teslim">Showroom Teslim</option>
                    <option value="depo_teslim">Depo Teslim</option>
                    <option value="kurye">Kurye</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Textarea value={editData.customer_address || ''} onChange={(e) => setEditData({...editData, customer_address: e.target.value})} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vergi Dairesi</Label>
                  <Input value={editData.tax_office || ''} onChange={(e) => setEditData({...editData, tax_office: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Vergi No</Label>
                  <Input value={editData.tax_number || ''} onChange={(e) => setEditData({...editData, tax_number: e.target.value})} />
                </div>
              </div>
              {editData.delivery_method === 'kargo' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kargo Firması</Label>
                    <Input value={editData.cargo_company || ''} onChange={(e) => setEditData({...editData, cargo_company: e.target.value})} placeholder="Aras, Yurtiçi, MNG..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Kargo Takip Kodu</Label>
                    <Input value={editData.cargo_tracking_code || ''} onChange={(e) => setEditData({...editData, cargo_tracking_code: e.target.value})} />
                  </div>
                </div>
              )}
              {/* Ödeme ve Teslimat Durumları */}
              <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                <h4 className="text-sm font-semibold text-zinc-700">Ödeme ve Teslimat</h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editData.pos_payment || false} onChange={(e) => setEditData({...editData, pos_payment: e.target.checked})} className="h-4 w-4" />
                    <span className="text-sm">POS Cihazından Çekildi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editData.delivered_invoice_only || false} onChange={(e) => setEditData({...editData, delivered_invoice_only: e.target.checked})} className="h-4 w-4" />
                    <span className="text-sm">Teslim Edildi Sadece Fatura</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editData.site_payment || false} onChange={(e) => setEditData({...editData, site_payment: e.target.checked})} className="h-4 w-4" />
                    <span className="text-sm">Siteden Ödeme Yapıldı</span>
                  </label>
                </div>
                {editData.site_payment && (
                  <div className="space-y-1">
                    <Label className="text-xs">Site Ödemesi İşlem No</Label>
                    <Input value={editData.online_payment_ref || ''} onChange={(e) => setEditData({...editData, online_payment_ref: e.target.value.toUpperCase()})} placeholder="CRxxxxxx" className="max-w-xs font-mono" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea value={editData.notes || ''} onChange={(e) => setEditData({...editData, notes: e.target.value})} rows={2} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-zinc-500 text-sm">Sipariş Veren / Yetkili</span><p className="font-medium">{order.customer_name || '-'}</p></div>
                <div><span className="text-zinc-500 text-sm">Telefon</span><p className="font-medium">{order.customer_phone || '-'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-zinc-500 text-sm">E-posta</span><p className="font-medium">{order.customer_email || '-'}</p></div>
                <div><span className="text-zinc-500 text-sm">Teslimat</span><p className="font-medium">{
                  order.delivery_method === 'kargo' ? 'Kargo' :
                  order.delivery_method === 'showroom_teslim' ? 'Showroom Teslim' :
                  order.delivery_method === 'depo_teslim' ? 'Depo Teslim' :
                  order.delivery_method === 'kurye' ? 'Kurye' :
                  order.delivery_method || '-'
                }</p></div>
              </div>
              {order.customer_address && (
                <div><span className="text-zinc-500 text-sm">Adres</span><p className="font-medium">{order.customer_address}</p></div>
              )}
              {(order.tax_office || order.tax_number) && (
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-zinc-500 text-sm">Vergi Dairesi</span><p className="font-medium">{order.tax_office || '-'}</p></div>
                  <div><span className="text-zinc-500 text-sm">Vergi No</span><p className="font-medium">{order.tax_number || '-'}</p></div>
                </div>
              )}

              {/* Kargo Adresi - Tüm Siparişler İçin (Kargo seçilmişse) */}
              {order.delivery_method === 'kargo' && order.shipping_address && order.shipping_address.address && !order.order_type?.startsWith('kurumsal') && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-3">
                  <span className="text-emerald-800 text-xs font-semibold">KARGO TESLİMAT ADRESİ</span>
                  {order.shipping_address.recipient_name && (
                    <p className="font-semibold text-sm mt-1">Alıcı: {order.shipping_address.recipient_name}</p>
                  )}
                  {order.shipping_address.recipient_phone && (
                    <p className="text-sm text-zinc-600">Tel: {order.shipping_address.recipient_phone}</p>
                  )}
                  <p className="font-medium text-sm mt-1">{order.shipping_address.address}</p>
                  {(order.shipping_address.district || order.shipping_address.city) && (
                    <p className="text-sm text-zinc-600">
                      {[order.shipping_address.district, order.shipping_address.city].filter(Boolean).join(' / ')}
                    </p>
                  )}
                </div>
              )}

              {/* Kurumsal Sipariş Adres Bilgileri */}
              {order.order_type?.startsWith('kurumsal') && (order.billing_address || order.shipping_address) && (
                <div className="space-y-3 mt-4">
                  {/* Fatura Adresi */}
                  {order.billing_address && order.billing_address.address && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-amber-800 text-xs font-semibold">FATURA ADRESİ</span>
                      <p className="font-medium text-sm mt-1">{order.billing_address.address}</p>
                      {(order.billing_address.district || order.billing_address.city) && (
                        <p className="text-sm text-zinc-600">
                          {[order.billing_address.district, order.billing_address.city].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Kargo/Teslimat Adresi */}
                  {order.shipping_address && order.shipping_address.address && !order.same_address && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <span className="text-emerald-800 text-xs font-semibold">KARGO/TESLİMAT ADRESİ</span>
                      {order.shipping_address.recipient_name && (
                        <p className="font-semibold text-sm mt-1">Alıcı: {order.shipping_address.recipient_name}</p>
                      )}
                      {order.shipping_address.recipient_phone && (
                        <p className="text-sm text-zinc-600">Tel: {order.shipping_address.recipient_phone}</p>
                      )}
                      <p className="font-medium text-sm mt-1">{order.shipping_address.address}</p>
                      {(order.shipping_address.district || order.shipping_address.city) && (
                        <p className="text-sm text-zinc-600">
                          {[order.shipping_address.district, order.shipping_address.city].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Aynı Adres Durumu */}
                  {order.same_address && (
                    <div className="text-xs text-zinc-500 italic">
                      * Kargo adresi fatura adresi ile aynı
                    </div>
                  )}
                </div>
              )}

              {order.cargo_tracking_code && (
                <div>
                  <span className="text-zinc-500 text-sm">Kargo Takip</span>
                  <p className="font-medium">
                    {order.cargo_company}: 
                    <a href={getCargoTrackingUrl(order.cargo_company, order.cargo_tracking_code)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                      {order.cargo_tracking_code}
                    </a>
                  </p>
                </div>
              )}
              {/* Ödeme ve Teslimat Durumları Görüntüleme */}
              {(order.pos_payment || order.delivered_invoice_only || order.online_payment_ref) && (
                <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                  <span className="text-zinc-500 text-sm font-medium">Ödeme ve Teslimat</span>
                  <div className="flex flex-wrap gap-3">
                    {order.pos_payment && (
                      <Badge className="bg-green-100 text-green-800">✓ POS Cihazından Çekildi</Badge>
                    )}
                    {order.delivered_invoice_only && (
                      <Badge className="bg-amber-100 text-amber-800">✓ Teslim Edildi Sadece Fatura</Badge>
                    )}
                    {order.online_payment_ref && (
                      <Badge className="bg-blue-100 text-blue-800 font-mono">İşlem No: {order.online_payment_ref}</Badge>
                    )}
                  </div>
                </div>
              )}
              {order.notes && (
                <div><span className="text-zinc-500 text-sm">Notlar</span><p className="font-medium">{order.notes}</p></div>
              )}
            </div>
          )}
        </Card>

        {/* Status Card */}
        <Card className="p-6 border-zinc-200">
          <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4">Durum Bilgileri</h2>
          
          <div className="space-y-4">
            {/* General Status */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm font-medium text-zinc-600">Genel Durum</span>
              {editMode ? (
                <select className="h-9 px-3 rounded-md border border-zinc-300 text-sm" value={editData.general_status} onChange={(e) => setEditData({...editData, general_status: e.target.value})}>
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                getStatusBadge(order.general_status, statusOptions)
              )}
            </div>

            {/* Waybill Status */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm font-medium text-zinc-600">İrsaliye Durumu</span>
              {editMode ? (
                <select className="h-9 px-3 rounded-md border border-zinc-300 text-sm" value={editData.waybill_status || 'kesilmedi'} onChange={(e) => setEditData({...editData, waybill_status: e.target.value})}>
                  {waybillStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                getStatusBadge(order.waybill_status || 'kesilmedi', waybillStatusOptions)
              )}
            </div>

            {/* Invoice Status */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm font-medium text-zinc-600">Fatura Durumu</span>
              {editMode ? (
                <div className="flex items-center gap-2">
                  <select className="h-9 px-3 rounded-md border border-zinc-300 text-sm" value={editData.invoice_status} onChange={(e) => setEditData({...editData, invoice_status: e.target.value})}>
                    {invoiceStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {editData.invoice_status === 'kesildi' && (
                    <Input
                      value={editData.invoice_number || ''}
                      onChange={(e) => setEditData({...editData, invoice_number: e.target.value})}
                      placeholder="Fatura No"
                      className="h-9 w-32 text-sm font-mono"
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {order.invoice_number && order.invoice_status === 'kesildi' && (() => {
                    // Sipariş tarihinden 7 gün geçip geçmediğini kontrol et
                    const orderDate = new Date(order.created_at);
                    const now = new Date();
                    const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
                    const canQuery = daysDiff >= 7;
                    
                    return canQuery ? (
                      <a 
                        href="https://ebelgesorgulama.elogo.com.tr/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-600 bg-blue-100 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                        title="e-Logo Fatura Sorgulama"
                      >
                        #{order.invoice_number} ↗
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-zinc-600 bg-zinc-200 px-2 py-1 rounded" title={`Sorgulamak için ${7 - daysDiff} gün bekleyin`}>
                        #{order.invoice_number}
                      </span>
                    );
                  })()}
                  {getStatusBadge(order.invoice_status, invoiceStatusOptions)}
                </div>
              )}
            </div>

            {/* Cargo Status */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
              <span className="text-sm font-medium text-zinc-600">Kargo Durumu</span>
              {editMode ? (
                <select className="h-9 px-3 rounded-md border border-zinc-300 text-sm" value={editData.cargo_status} onChange={(e) => setEditData({...editData, cargo_status: e.target.value})}>
                  {cargoStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                getStatusBadge(order.cargo_status, cargoStatusOptions)
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Order Items */}
      <Card className="p-6 border-zinc-200">
        <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4">Sipariş Kalemleri</h2>
        
        <div className="space-y-3">
          {items.map((item) => {
            // Son 5 dakikada eklenen kalemleri "Yeni" olarak işaretle
            const isNew = item.created_at && (new Date() - new Date(item.created_at)) < 5 * 60 * 1000;
            return (
              <div key={item.id} className={`flex items-center justify-between p-4 rounded-lg ${isNew ? 'bg-emerald-50 border border-emerald-200' : 'bg-zinc-50'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-zinc-900">{item.product_name}</p>
                    {isNew && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Yeni Eklendi</Badge>}
                    {item.item_type === 'manuel_urun' && <Badge className="bg-amber-100 text-amber-800 text-xs">Manuel</Badge>}
                    {item.item_type === 'katalog_urunu' && <Badge className="bg-blue-100 text-blue-800 text-xs">Katalog</Badge>}
                  </div>
                  <p className="text-sm text-zinc-500">
                    Adet: {item.quantity} • Birim: {item.unit_price?.toFixed(2)} TL • Toplam: {item.total_price?.toFixed(2)} TL
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={item.item_status}
                    onChange={(e) => handleUpdateItemStatus(item.id, e.target.value)}
                    className="h-9 px-3 rounded-md border border-zinc-300 text-sm"
                  >
                    {['netlesecek', 'stokta', 'temin_edilecek', 'uretimde', 'hazir', 'gonderildi', 'iptal'].map(s => (
                      <option key={s} value={s}>{getItemStatusLabel(s)}</option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="flex justify-end mt-4 pt-4 border-t border-zinc-200">
          <div className="text-right">
            <span className="text-zinc-500 text-sm">Genel Toplam</span>
            <p className="text-2xl font-bold text-zinc-900">{totalPrice.toFixed(2)} TL</p>
          </div>
        </div>

        {/* Add New Item */}
        <div className="mt-6 pt-4 border-t border-zinc-200">
          <h3 className="text-sm font-semibold text-zinc-700 mb-3">Yeni Kalem Ekle</h3>
          
          {/* Ürün Arama */}
          <div className="mb-4 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Ürün ara (en az 2 karakter)..." 
                value={productSearchTerm} 
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchingProducts && <Loader className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-400" />}
            </div>
            
            {/* Arama Sonuçları */}
            {productSearchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {productSearchResults.map((product) => (
                  <div 
                    key={product.product_id}
                    onClick={() => handleSelectProductForItem(product)}
                    className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-0"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-zinc-500">{product.brand} • {product.web_service_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600">{product.price?.toFixed(2) || '0.00'} TL</p>
                        <p className="text-xs text-zinc-400">Stok: {product.stock || 0}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manuel Ürün Girişi */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input 
              placeholder="Ürün adı (aramadan seç veya manuel yaz)" 
              value={newItem.product_name} 
              onChange={(e) => setNewItem({...newItem, product_name: e.target.value, item_type: 'manuel_urun'})} 
              className="md:col-span-2" 
            />
            <Input 
              type="number" 
              placeholder="Adet" 
              value={newItem.quantity} 
              onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 0, total_price: (parseInt(e.target.value) || 0) * newItem.unit_price})} 
            />
            <Input 
              type="number" 
              placeholder="Birim Fiyat" 
              step="0.01"
              value={newItem.unit_price} 
              onChange={(e) => setNewItem({...newItem, unit_price: parseFloat(e.target.value) || 0, total_price: newItem.quantity * (parseFloat(e.target.value) || 0)})} 
            />
            <Button onClick={handleAddItem}><Plus className="mr-2 h-4 w-4" />Ekle</Button>
          </div>
          {newItem.product_name && (
            <p className="text-xs text-zinc-500 mt-2">
              Ürün: <span className="font-medium">{newItem.product_name}</span> | 
              Toplam: <span className="font-semibold text-emerald-600">{newItem.total_price.toFixed(2)} TL</span>
              {newItem.item_type === 'katalog_urunu' && <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs">Katalog</Badge>}
              {newItem.item_type === 'manuel_urun' && <Badge className="ml-2 bg-amber-100 text-amber-800 text-xs">Manuel</Badge>}
            </p>
          )}
        </div>
      </Card>

      {/* Order History */}
      <Card className="p-6 border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-heading text-zinc-900 flex items-center gap-2">
            <History className="h-5 w-5" />
            Sipariş Geçmişi
          </h2>
          <Button variant="outline" size="sm" onClick={() => setNoteDialogOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Not Ekle
          </Button>
        </div>

        <div className="space-y-3">
          {(order.history || []).length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">Henüz geçmiş kaydı yok.</p>
          ) : (
            [...(order.history || [])].reverse().map((entry, idx) => (
              <div key={entry.id || idx} className="flex gap-3 p-3 bg-zinc-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                  {entry.action === 'note_added' ? (
                    <MessageSquarePlus className="h-4 w-4 text-zinc-600" />
                  ) : entry.action === 'status_change' ? (
                    <Edit className="h-4 w-4 text-blue-600" />
                  ) : (
                    <History className="h-4 w-4 text-zinc-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-900">{entry.description}</p>
                  {entry.old_value && entry.new_value && (
                    <p className="text-xs text-zinc-500 mt-1">
                      <span className="line-through">{entry.old_value}</span> → <span className="font-medium">{entry.new_value}</span>
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">
                    {entry.user_name} • {new Date(entry.created_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sipariş Notu Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Notunuzu yazın..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>İptal</Button>
              <Button onClick={handleAddNote}>Ekle</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Order Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Siparişi Sil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-zinc-600">
              <strong>{order.order_code || `#${order.order_number}`}</strong> numaralı siparişi silmek istediğinizden emin misiniz?
            </p>
            <p className="text-sm text-zinc-500">
              Bu işlem geri alınamaz. Sipariş ve tüm kalemleri kalıcı olarak silinecektir.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                İptal
              </Button>
              <Button onClick={handleDeleteOrder} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                {deleting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetail;

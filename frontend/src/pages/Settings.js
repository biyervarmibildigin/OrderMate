import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader, Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Settings = () => {
  const { user } = useAuth();
  const [orderTypes, setOrderTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [pdfTemplate, setPdfTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
    order: 0
  });

  useEffect(() => {
    fetchOrderTypes();
    fetchPdfTemplate();
  }, []);

  const fetchOrderTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/order-types`);
      setOrderTypes(response.data);
    } catch (error) {
      toast.error('Sipariş türleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchPdfTemplate = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/pdf-template`);
      setPdfTemplate(response.data);
    } catch (error) {
      console.error('PDF template fetch failed:', error);
    }
  };

  const handleUpdatePdfTemplate = async (field, value) => {
    const updated = { ...pdfTemplate, [field]: value };
    setPdfTemplate(updated);
    
    try {
      await axios.put(`${API_URL}/settings/pdf-template`, updated);
      toast.success('PDF şablonu güncellendi');
    } catch (error) {
      toast.error('Güncelleme başarısız');
    }
  };

  const handleOpenDialog = (orderType = null) => {
    if (orderType) {
      setEditingType(orderType);
      setFormData({
        name: orderType.name,
        code: orderType.code,
        description: orderType.description || '',
        is_active: orderType.is_active,
        order: orderType.order
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        is_active: true,
        order: orderTypes.length + 1
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingType) {
        await axios.put(`${API_URL}/settings/order-types/${editingType.id}`, formData);
        toast.success('Sipariş türü güncellendi');
      } else {
        await axios.post(`${API_URL}/settings/order-types`, formData);
        toast.success('Sipariş türü eklendi');
      }
      setDialogOpen(false);
      fetchOrderTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleDelete = async (orderTypeId, orderTypeName) => {
    if (!window.confirm(`"${orderTypeName}" sipariş türünü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/settings/order-types/${orderTypeId}`);
      toast.success('Sipariş türü silindi');
      fetchOrderTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Silme başarısız');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <Card className="p-12 text-center border-zinc-200">
        <p className="text-zinc-500">Bu sayfaya erişim yetkiniz yok.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Ayarlar
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Sistem ayarlarını yönetin
          </p>
        </div>
      </div>

      {/* PDF Template Section */}
      {pdfTemplate && (
        <Card className="p-6 border-zinc-200">
          <h2 className="text-xl font-bold font-heading text-zinc-900 mb-4">
            PDF Şablon Ayarları
          </h2>
          <p className="text-sm text-zinc-600 mb-6">
            Teklif PDF'lerinin görünümünü özelleştirin
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Başlık</Label>
              <Input
                value={pdfTemplate.title}
                onChange={(e) => handleUpdatePdfTemplate('title', e.target.value)}
                placeholder="TEKLİF"
              />
            </div>

            <div className="space-y-2">
              <Label>Şirket Adı</Label>
              <Input
                value={pdfTemplate.company_name}
                onChange={(e) => handleUpdatePdfTemplate('company_name', e.target.value)}
                placeholder="OrderMate"
              />
            </div>

            <div className="space-y-2">
              <Label>Şirket Adresi</Label>
              <Input
                value={pdfTemplate.company_address || ''}
                onChange={(e) => handleUpdatePdfTemplate('company_address', e.target.value)}
                placeholder="Adres bilgisi"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={pdfTemplate.company_phone || ''}
                onChange={(e) => handleUpdatePdfTemplate('company_phone', e.target.value)}
                placeholder="+90 XXX XXX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input
                value={pdfTemplate.company_email || ''}
                onChange={(e) => handleUpdatePdfTemplate('company_email', e.target.value)}
                placeholder="info@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Alt Bilgi (Footer)</Label>
              <Input
                value={pdfTemplate.footer_text}
                onChange={(e) => handleUpdatePdfTemplate('footer_text', e.target.value)}
                placeholder="OrderMate - Sipariş Takip Sistemi"
              />
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <Label>Notlar (PDF'de görünür)</Label>
            <Textarea
              value={pdfTemplate.notes || ''}
              onChange={(e) => handleUpdatePdfTemplate('notes', e.target.value)}
              placeholder="PDF'de gösterilecek ek notlar..."
              rows={3}
            />
          </div>

          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show_prices"
                checked={pdfTemplate.show_prices}
                onChange={(e) => handleUpdatePdfTemplate('show_prices', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="show_prices">Fiyatları Göster</Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show_customer_info"
                checked={pdfTemplate.show_customer_info}
                onChange={(e) => handleUpdatePdfTemplate('show_customer_info', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="show_customer_info">Müşteri Bilgilerini Göster</Label>
            </div>
          </div>
        </Card>
      )}

      {/* Order Types Section */}
      <Card className="p-6 border-zinc-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold font-heading text-zinc-900">
              Sipariş Türleri
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              {orderTypes.length} sipariş türü tanımlı
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} data-testid="create-order-type-button">
            <Plus className="mr-2 h-4 w-4" />
            Yeni Sipariş Türü
          </Button>
        </div>

        <div className="space-y-3">
          {orderTypes.map((orderType) => (
            <div
              key={orderType.id}
              className="flex items-center justify-between p-4 bg-zinc-50 rounded-md border border-zinc-200"
              data-testid={`order-type-${orderType.code}`}
            >
              <div className="flex items-center gap-4 flex-1">
                <GripVertical className="h-5 w-5 text-zinc-400" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-zinc-900">{orderType.name}</p>
                    <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 font-mono text-xs">
                      {orderType.code}
                    </Badge>
                    {orderType.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">
                        Pasif
                      </Badge>
                    )}
                  </div>
                  {orderType.description && (
                    <p className="text-sm text-zinc-500 mt-1">{orderType.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDialog(orderType)}
                  data-testid={`edit-order-type-${orderType.code}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(orderType.id, orderType.name)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-order-type-${orderType.code}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {orderTypes.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              Henüz sipariş türü eklenmemiş.
            </div>
          )}
        </div>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Sipariş Türünü Düzenle' : 'Yeni Sipariş Türü'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">* Sipariş Türü Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Örn: Teklif Aşaması"
                required
                data-testid="order-type-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">* Kod (Benzersiz)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                placeholder="Örn: teklif_asamasi"
                required
                disabled={!!editingType}
                data-testid="order-type-code-input"
              />
              <p className="text-xs text-zinc-500">Kod bir kez oluşturulduktan sonra değiştirilemez</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Sipariş türü açıklaması"
                rows={3}
                data-testid="order-type-description-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Sıralama</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({...formData, order: parseInt(e.target.value) || 0})}
                data-testid="order-type-order-input"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit" data-testid="submit-order-type-button">
                {editingType ? 'Güncelle' : 'Oluştur'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;

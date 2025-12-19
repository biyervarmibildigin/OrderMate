import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader, Plus, Edit, Trash2, GripVertical, Upload, Building2, CreditCard, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Settings = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  // Order Types State
  const [orderTypes, setOrderTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    is_active: true,
    order: 0
  });

  // PDF Template State
  const [pdfTemplate, setPdfTemplate] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [bankFormData, setBankFormData] = useState({
    bank_name: '',
    account_holder: '',
    iban: '',
    branch_code: '',
    account_number: '',
    currency: 'TRY',
    is_active: true
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState('pdf');

  useEffect(() => {
    fetchOrderTypes();
    fetchPdfTemplate();
    fetchBankAccounts();
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

  const fetchBankAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/bank-accounts`);
      setBankAccounts(response.data);
    } catch (error) {
      console.error('Bank accounts fetch failed:', error);
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Geçersiz dosya türü. PNG, JPEG, GIF veya WEBP yükleyin.');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('Dosya çok büyük. Maksimum 500KB izin verilir.');
      return;
    }

    setLogoUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_URL}/settings/upload-logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Logo yüklendi');
      fetchPdfTemplate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Logo yüklenemedi');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await axios.put(`${API_URL}/settings/pdf-template`, { ...pdfTemplate, logo_base64: null });
      setPdfTemplate({ ...pdfTemplate, logo_base64: null });
      toast.success('Logo kaldırıldı');
    } catch (error) {
      toast.error('Logo kaldırılamadı');
    }
  };

  // Order Type Handlers
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

  // Bank Account Handlers
  const handleOpenBankDialog = (account = null) => {
    if (account) {
      setEditingBank(account);
      setBankFormData({
        bank_name: account.bank_name,
        account_holder: account.account_holder,
        iban: account.iban,
        branch_code: account.branch_code || '',
        account_number: account.account_number || '',
        currency: account.currency || 'TRY',
        is_active: account.is_active
      });
    } else {
      setEditingBank(null);
      setBankFormData({
        bank_name: '',
        account_holder: '',
        iban: '',
        branch_code: '',
        account_number: '',
        currency: 'TRY',
        is_active: true
      });
    }
    setBankDialogOpen(true);
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBank) {
        await axios.put(`${API_URL}/settings/bank-accounts/${editingBank.id}`, bankFormData);
        toast.success('Banka hesabı güncellendi');
      } else {
        await axios.post(`${API_URL}/settings/bank-accounts`, bankFormData);
        toast.success('Banka hesabı eklendi');
      }
      setBankDialogOpen(false);
      fetchBankAccounts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleDeleteBank = async (accountId, bankName) => {
    if (!window.confirm(`"${bankName}" hesabını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/settings/bank-accounts/${accountId}`);
      toast.success('Banka hesabı silindi');
      fetchBankAccounts();
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-2">
        <Button
          variant={activeTab === 'pdf' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('pdf')}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          Firma & PDF
        </Button>
        <Button
          variant={activeTab === 'bank' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('bank')}
          className="gap-2"
        >
          <CreditCard className="h-4 w-4" />
          Banka Hesapları
        </Button>
        <Button
          variant={activeTab === 'orders' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('orders')}
          className="gap-2"
        >
          <GripVertical className="h-4 w-4" />
          Sipariş Türleri
        </Button>
      </div>

      {/* PDF Template Section */}
      {activeTab === 'pdf' && pdfTemplate && (
        <div className="space-y-6">
          {/* Logo Section */}
          <Card className="p-6 border-zinc-200">
            <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Firma Logosu
            </h2>
            
            <div className="flex items-start gap-6">
              {/* Logo Preview */}
              <div className="w-40 h-24 border-2 border-dashed border-zinc-300 rounded-lg flex items-center justify-center bg-zinc-50 relative overflow-hidden">
                {pdfTemplate.logo_base64 ? (
                  <>
                    <img
                      src={`data:image/png;base64,${pdfTemplate.logo_base64}`}
                      alt="Firma Logosu"
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-zinc-400 text-sm">Logo Yok</span>
                )}
              </div>
              
              <div className="flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  variant="outline"
                  className="gap-2"
                >
                  {logoUploading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Logo Yükle
                </Button>
                <p className="text-xs text-zinc-500 mt-2">
                  PNG, JPEG, GIF veya WEBP. Maksimum 500KB.
                </p>
              </div>
            </div>
          </Card>

          {/* Company Info Section */}
          <Card className="p-6 border-zinc-200">
            <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Firma Bilgileri
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firma Adı</Label>
                <Input
                  value={pdfTemplate.company_name}
                  onChange={(e) => handleUpdatePdfTemplate('company_name', e.target.value)}
                  placeholder="OrderMate"
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
                <Label>Web Sitesi</Label>
                <Input
                  value={pdfTemplate.company_website || ''}
                  onChange={(e) => handleUpdatePdfTemplate('company_website', e.target.value)}
                  placeholder="www.company.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Vergi Dairesi</Label>
                <Input
                  value={pdfTemplate.company_tax_office || ''}
                  onChange={(e) => handleUpdatePdfTemplate('company_tax_office', e.target.value)}
                  placeholder="Vergi Dairesi Adı"
                />
              </div>

              <div className="space-y-2">
                <Label>Vergi No</Label>
                <Input
                  value={pdfTemplate.company_tax_number || ''}
                  onChange={(e) => handleUpdatePdfTemplate('company_tax_number', e.target.value)}
                  placeholder="Vergi Numarası"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Adres</Label>
                <Textarea
                  value={pdfTemplate.company_address || ''}
                  onChange={(e) => handleUpdatePdfTemplate('company_address', e.target.value)}
                  placeholder="Firma adresi (her satır ayrı bir satır olarak PDF'de görünür)"
                  rows={2}
                />
              </div>
            </div>
          </Card>

          {/* PDF Settings Section */}
          <Card className="p-6 border-zinc-200">
            <h2 className="text-lg font-bold font-heading text-zinc-900 mb-4">
              PDF Şablon Ayarları
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teklif Başlığı</Label>
                <Input
                  value={pdfTemplate.title}
                  onChange={(e) => handleUpdatePdfTemplate('title', e.target.value)}
                  placeholder="TEKLİF"
                />
              </div>

              <div className="space-y-2">
                <Label>Geçerlilik Süresi (Gün)</Label>
                <Input
                  type="number"
                  value={pdfTemplate.validity_days || 30}
                  onChange={(e) => handleUpdatePdfTemplate('validity_days', parseInt(e.target.value) || 30)}
                  placeholder="30"
                />
              </div>

              <div className="space-y-2">
                <Label>Ödeme Koşulları</Label>
                <Input
                  value={pdfTemplate.payment_terms || ''}
                  onChange={(e) => handleUpdatePdfTemplate('payment_terms', e.target.value)}
                  placeholder="Örn: %50 peşin, %50 teslimatta"
                />
              </div>

              <div className="space-y-2">
                <Label>Teslimat Koşulları</Label>
                <Input
                  value={pdfTemplate.delivery_terms || ''}
                  onChange={(e) => handleUpdatePdfTemplate('delivery_terms', e.target.value)}
                  placeholder="Örn: Fabrika teslim, nakliye alıcıya aittir"
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

            <div className="space-y-2 mt-4">
              <Label>Notlar (PDF'de görünür)</Label>
              <Textarea
                value={pdfTemplate.notes || ''}
                onChange={(e) => handleUpdatePdfTemplate('notes', e.target.value)}
                placeholder="PDF'de gösterilecek ek notlar..."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-6 mt-6">
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_bank_accounts"
                  checked={pdfTemplate.show_bank_accounts !== false}
                  onChange={(e) => handleUpdatePdfTemplate('show_bank_accounts', e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <Label htmlFor="show_bank_accounts">Banka Hesaplarını Göster</Label>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Bank Accounts Section */}
      {activeTab === 'bank' && (
        <Card className="p-6 border-zinc-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold font-heading text-zinc-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banka Hesapları
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                PDF tekliflerinde gösterilecek banka hesapları
              </p>
            </div>
            <Button onClick={() => handleOpenBankDialog()} data-testid="add-bank-account-button">
              <Plus className="mr-2 h-4 w-4" />
              Hesap Ekle
            </Button>
          </div>

          <div className="space-y-3">
            {bankAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-zinc-50 rounded-md border border-zinc-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-zinc-900">{account.bank_name}</p>
                    <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 font-mono text-xs">
                      {account.currency}
                    </Badge>
                    {account.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">
                        Pasif
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 mt-1">{account.account_holder}</p>
                  <p className="text-sm text-zinc-500 font-mono">{account.iban}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenBankDialog(account)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBank(account.id, account.bank_name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {bankAccounts.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                Henüz banka hesabı eklenmemiş.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Order Types Section */}
      {activeTab === 'orders' && (
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
      )}

      {/* Order Type Dialog */}
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

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBank ? 'Banka Hesabını Düzenle' : 'Yeni Banka Hesabı'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBankSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">* Banka Adı</Label>
              <Input
                id="bank_name"
                value={bankFormData.bank_name}
                onChange={(e) => setBankFormData({...bankFormData, bank_name: e.target.value})}
                placeholder="Örn: Garanti Bankası"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_holder">* Hesap Sahibi</Label>
              <Input
                id="account_holder"
                value={bankFormData.account_holder}
                onChange={(e) => setBankFormData({...bankFormData, account_holder: e.target.value})}
                placeholder="Firma veya kişi adı"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">* IBAN</Label>
              <Input
                id="iban"
                value={bankFormData.iban}
                onChange={(e) => setBankFormData({...bankFormData, iban: e.target.value.toUpperCase()})}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch_code">Şube Kodu</Label>
                <Input
                  id="branch_code"
                  value={bankFormData.branch_code}
                  onChange={(e) => setBankFormData({...bankFormData, branch_code: e.target.value})}
                  placeholder="Opsiyonel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_number">Hesap No</Label>
                <Input
                  id="account_number"
                  value={bankFormData.account_number}
                  onChange={(e) => setBankFormData({...bankFormData, account_number: e.target.value})}
                  placeholder="Opsiyonel"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Para Birimi</Label>
              <select
                id="currency"
                value={bankFormData.currency}
                onChange={(e) => setBankFormData({...bankFormData, currency: e.target.value})}
                className="w-full h-10 px-3 rounded-md border border-zinc-300 bg-white"
              >
                <option value="TRY">TRY - Türk Lirası</option>
                <option value="USD">USD - Amerikan Doları</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - İngiliz Sterlini</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bank_is_active"
                checked={bankFormData.is_active}
                onChange={(e) => setBankFormData({...bankFormData, is_active: e.target.checked})}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="bank_is_active">Aktif (PDF'lerde göster)</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setBankDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">
                {editingBank ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;

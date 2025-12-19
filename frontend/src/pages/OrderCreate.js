import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, X, Loader, ShoppingBag, FileText, Building2, CreditCard, ChevronRight } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Debounce hook for search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// Sipariş Türü Konfigürasyonları
const ORDER_TYPE_CONFIG = {
  teklif: {
    label: 'Teklif Aşaması',
    icon: FileText,
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Fiyat teklifi hazırlamak için',
    fields: ['customer', 'tax', 'products', 'notes']
  },
  showroom_satis: {
    label: 'Showroom Satış (Perakende)',
    icon: ShoppingBag,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Mağazadan perakende satış',
    fields: ['customer', 'tax_optional', 'payment', 'delivery', 'products', 'notes']
  },
  kurumsal_cari: {
    label: 'Kurumsal / Cari Hesap',
    icon: Building2,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Cari hesaplı kurumsal satış',
    fields: ['customer', 'tax_required', 'delivery', 'products', 'notes']
  },
  kurumsal_pesin: {
    label: 'Kurumsal (Peşin Ödeme)',
    icon: CreditCard,
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Peşin ödemeli kurumsal satış',
    fields: ['customer', 'tax_required', 'payment', 'delivery', 'products', 'notes']
  }
};

const OrderCreate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Tür Seçimi, 2: Form
  const [loading, setLoading] = useState(false);
  const [orderTypes, setOrderTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [taxError, setTaxError] = useState('');
  
  const [formData, setFormData] = useState({
    order_type: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    tax_id_type: 'vkn',
    tax_number: '',
    tax_office: '',
    company_name: '', // VKN'ye ait firma/kurum adı
    delivery_method: '',
    cargo_company: '',
    cargo_tracking_code: '',
    pos_payment: false,
    delivered_invoice_only: false,
    online_payment_ref: '',
    whatsapp_content: '',
    notes: ''
  });

  useEffect(() => {
    fetchOrderTypes();
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const response = await axios.get(`${API_URL}/products?search=${encodeURIComponent(debouncedSearch)}&limit=20`);
        setSearchResults(response.data);
      } catch (error) {
        console.error('Product search failed:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };
    searchProducts();
  }, [debouncedSearch]);

  const fetchOrderTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/order-types`);
      const activeTypes = response.data.filter(t => t.is_active);
      setOrderTypes(activeTypes);
    } catch (error) {
      console.error('Failed to fetch order types:', error);
    }
  };

  const handleSelectOrderType = (typeCode) => {
    setFormData(prev => ({ ...prev, order_type: typeCode }));
    setStep(2);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchInput = (value) => {
    setSearchTerm(value);
    if (!value.trim()) setSearchResults([]);
  };

  const handleSelectProduct = (product) => {
    const exists = selectedProducts.find(p => p.product_id === product.id);
    if (exists) {
      toast.error('Bu ürün zaten eklenmiş');
      return;
    }
    setSelectedProducts([...selectedProducts, {
      product_id: product.id,
      product_name: product.product_name,
      web_service_code: product.web_service_code,
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      item_type: 'katalog_urunu',
      item_status: 'netlesecek'
    }]);
    setSearchTerm('');
    setSearchResults([]);
    toast.success('Ürün eklendi');
  };

  const handleRemoveProduct = (index) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index, field, value) => {
    const updated = [...selectedProducts];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total_price = (updated[index].quantity || 0) * (updated[index].unit_price || 0);
    }
    setSelectedProducts(updated);
  };

  const handleCreateManualProduct = () => {
    if (!searchTerm.trim()) return;
    setSelectedProducts([...selectedProducts, {
      product_id: null,
      product_name: searchTerm,
      web_service_code: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      item_type: 'manuel_urun',
      item_status: 'netlesecek'
    }]);
    setSearchTerm('');
    setSearchResults([]);
    toast.success('Manuel ürün eklendi');
  };

  // VKN/TC Validasyon
  const validateVKN = (vkn) => {
    if (!vkn) return 'VKN zorunludur';
    if (vkn.length !== 10) return 'VKN 10 karakter olmalıdır';
    if (!/^\d+$/.test(vkn)) return 'VKN sadece rakam içermelidir';
    return '';
  };

  const validateTC = (tc) => {
    if (!tc) return 'TC Kimlik No zorunludur';
    if (tc.length !== 11) return 'TC Kimlik No 11 karakter olmalıdır';
    if (!/^\d+$/.test(tc)) return 'TC Kimlik No sadece rakam içermelidir';
    if (tc[0] === '0') return 'TC Kimlik No 0 ile başlayamaz';
    const lastDigit = parseInt(tc[10]);
    if (lastDigit % 2 !== 0) return 'TC Kimlik No son hanesi çift rakam olmalıdır';
    return '';
  };

  const currentConfig = ORDER_TYPE_CONFIG[formData.order_type] || {};
  const isTaxRequired = currentConfig.fields?.includes('tax_required');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // VKN/TC Validasyonu - sadece zorunlu ise
    if (isTaxRequired) {
      const taxValidationError = formData.tax_id_type === 'vkn' 
        ? validateVKN(formData.tax_number)
        : validateTC(formData.tax_number);
      if (taxValidationError) {
        setTaxError(taxValidationError);
        toast.error(taxValidationError);
        return;
      }
    }
    setTaxError('');
    
    if (selectedProducts.length === 0) {
      toast.error('En az bir ürün eklemelisiniz');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/orders`, formData);
      const orderId = response.data.id;
      
      for (const product of selectedProducts) {
        await axios.post(`${API_URL}/order-items`, { ...product, order_id: orderId });
      }
      
      toast.success('Sipariş oluşturuldu');
      navigate(`/orders/${orderId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Sipariş oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = selectedProducts.reduce((sum, p) => sum + (p.total_price || 0), 0);

  // STEP 1: Sipariş Türü Seçimi
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
              Yeni Sipariş
            </h1>
            <p className="text-sm text-zinc-600 mt-1">Sipariş türünü seçin</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(ORDER_TYPE_CONFIG).map(([code, config]) => {
            const Icon = config.icon;
            return (
              <Card
                key={code}
                className={`p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-2 ${
                  formData.order_type === code ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-400'
                }`}
                onClick={() => handleSelectOrderType(code)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${config.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-zinc-900">{config.label}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{config.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-zinc-400" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // STEP 2: Sipariş Formu
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
              Yeni Sipariş
            </h1>
            <Badge className={currentConfig.color}>{currentConfig.label}</Badge>
          </div>
          <p className="text-sm text-zinc-600 mt-1">Sipariş bilgilerini doldurun</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 border-zinc-200 space-y-6">
          
          {/* Müşteri Bilgileri */}
          {(currentConfig.fields?.includes('customer')) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-zinc-900 border-b pb-2">Müşteri Bilgileri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Müşteri Adı *</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    placeholder="Müşteri adı"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={formData.customer_phone}
                    onChange={(e) => handleChange('customer_phone', e.target.value)}
                    placeholder="+90 XXX XXX XX XX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    value={formData.customer_email}
                    onChange={(e) => handleChange('customer_email', e.target.value)}
                    placeholder="ornek@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Adres</Label>
                  <Input
                    value={formData.customer_address}
                    onChange={(e) => handleChange('customer_address', e.target.value)}
                    placeholder="Müşteri adresi"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VKN/TC - Zorunlu */}
          {(currentConfig.fields?.includes('tax_required')) && (
            <div className="space-y-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
              <h3 className="font-semibold text-zinc-900">VKN / TC Kimlik No *</h3>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_id_type" value="vkn" checked={formData.tax_id_type === 'vkn'}
                    onChange={(e) => { handleChange('tax_id_type', e.target.value); handleChange('tax_number', ''); setTaxError(''); }}
                    className="h-4 w-4" />
                  <span className="text-sm">VKN (Kurumsal - 10 hane)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_id_type" value="tc" checked={formData.tax_id_type === 'tc'}
                    onChange={(e) => { handleChange('tax_id_type', e.target.value); handleChange('tax_number', ''); setTaxError(''); }}
                    className="h-4 w-4" />
                  <span className="text-sm">TC Kimlik No (Bireysel - 11 hane)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{formData.tax_id_type === 'vkn' ? 'Vergi Kimlik No (VKN) *' : 'TC Kimlik No *'}</Label>
                  <Input
                    value={formData.tax_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const maxLength = formData.tax_id_type === 'vkn' ? 10 : 11;
                      handleChange('tax_number', value.slice(0, maxLength));
                      setTaxError('');
                    }}
                    placeholder={formData.tax_id_type === 'vkn' ? '10 haneli VKN' : '11 haneli TC No'}
                    className={taxError ? 'border-red-500' : ''}
                  />
                  {taxError && <p className="text-xs text-red-600">{taxError}</p>}
                  <p className="text-xs text-zinc-500">
                    {formData.tax_id_type === 'vkn' 
                      ? `${formData.tax_number.length}/10 karakter`
                      : `${formData.tax_number.length}/11 karakter ${formData.tax_number.length === 11 ? (parseInt(formData.tax_number[10]) % 2 === 0 ? '✓' : '(son hane çift olmalı!)') : ''}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Vergi Dairesi *</Label>
                  <Input
                    value={formData.tax_office}
                    onChange={(e) => handleChange('tax_office', e.target.value)}
                    placeholder="Vergi dairesi adı"
                  />
                </div>
              </div>
            </div>
          )}

          {/* VKN/TC - Opsiyonel */}
          {(currentConfig.fields?.includes('tax_optional') || currentConfig.fields?.includes('tax')) && (
            <div className="space-y-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
              <h3 className="font-semibold text-zinc-900">VKN / TC Kimlik No (Opsiyonel)</h3>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_id_type" value="vkn" checked={formData.tax_id_type === 'vkn'}
                    onChange={(e) => { handleChange('tax_id_type', e.target.value); handleChange('tax_number', ''); }}
                    className="h-4 w-4" />
                  <span className="text-sm">VKN (10 hane)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_id_type" value="tc" checked={formData.tax_id_type === 'tc'}
                    onChange={(e) => { handleChange('tax_id_type', e.target.value); handleChange('tax_number', ''); }}
                    className="h-4 w-4" />
                  <span className="text-sm">TC Kimlik No (11 hane)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{formData.tax_id_type === 'vkn' ? 'VKN' : 'TC Kimlik No'}</Label>
                  <Input
                    value={formData.tax_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const maxLength = formData.tax_id_type === 'vkn' ? 10 : 11;
                      handleChange('tax_number', value.slice(0, maxLength));
                    }}
                    placeholder={formData.tax_id_type === 'vkn' ? '10 haneli VKN' : '11 haneli TC No'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vergi Dairesi</Label>
                  <Input
                    value={formData.tax_office}
                    onChange={(e) => handleChange('tax_office', e.target.value)}
                    placeholder="Vergi dairesi adı"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ödeme Bilgileri */}
          {(currentConfig.fields?.includes('payment')) && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-zinc-900">Ödeme Durumu</h3>
              
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.pos_payment}
                    onChange={(e) => handleChange('pos_payment', e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300" />
                  <span className="text-sm font-medium">POS Cihazından Çekildi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.delivered_invoice_only}
                    onChange={(e) => handleChange('delivered_invoice_only', e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300" />
                  <span className="text-sm font-medium">Teslim Edildi Sadece Fatura</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label>Site Ödemesi İşlem Numarası <span className="text-xs text-zinc-500">(İşlem numaranızı not ediniz)</span></Label>
                <Input
                  value={formData.online_payment_ref}
                  onChange={(e) => handleChange('online_payment_ref', e.target.value.toUpperCase())}
                  placeholder="CRxxxxxx"
                  className="max-w-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Teslimat Bilgileri */}
          {(currentConfig.fields?.includes('delivery')) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-zinc-900 border-b pb-2">Teslimat Bilgileri</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Teslimat Şekli</Label>
                  <select
                    value={formData.delivery_method}
                    onChange={(e) => handleChange('delivery_method', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-zinc-300 bg-white"
                  >
                    <option value="">Seçiniz</option>
                    <option value="kargo">Kargo</option>
                    <option value="elden">Elden Teslim</option>
                    <option value="kurye">Kurye</option>
                  </select>
                </div>
                {formData.delivery_method === 'kargo' && (
                  <>
                    <div className="space-y-2">
                      <Label>Kargo Firması</Label>
                      <Input
                        value={formData.cargo_company}
                        onChange={(e) => handleChange('cargo_company', e.target.value)}
                        placeholder="Aras, Yurtiçi, MNG..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kargo Takip Kodu</Label>
                      <Input
                        value={formData.cargo_tracking_code}
                        onChange={(e) => handleChange('cargo_tracking_code', e.target.value)}
                        placeholder="Takip kodu"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Ürün Ekleme */}
          {(currentConfig.fields?.includes('products')) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-zinc-900 border-b pb-2">Ürünler *</h3>
              
              {/* Ürün Arama */}
              <div className="relative">
                <div className="relative">
                  <Input
                    placeholder="Ürün adı veya T kodu ile ara... (en az 2 karakter)"
                    value={searchTerm}
                    onChange={(e) => handleSearchInput(e.target.value)}
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader className="h-4 w-4 animate-spin text-zinc-400" />
                    </div>
                  )}
                </div>
                
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((product) => (
                      <div key={product.id} className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100"
                        onClick={() => handleSelectProduct(product)}>
                        <div className="font-medium text-sm">{product.product_name}</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Kod: {product.web_service_code} • Marka: {product.brand || '-'} • Stok: {product.stock}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg p-4">
                    <p className="text-sm text-zinc-600 mb-3">"{searchTerm}" için ürün bulunamadı</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleCreateManualProduct} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />"{searchTerm}" olarak manuel ekle
                    </Button>
                  </div>
                )}
              </div>

              {/* Seçilen Ürünler */}
              {selectedProducts.length > 0 && (
                <div className="space-y-3">
                  {selectedProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product.product_name}</p>
                        {product.web_service_code && (
                          <p className="text-xs text-zinc-500">Kod: {product.web_service_code}</p>
                        )}
                      </div>
                      <Input type="number" placeholder="Adet" value={product.quantity} min="1"
                        onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20" />
                      <Input type="number" placeholder="Fiyat" value={product.unit_price} step="0.01"
                        onChange={(e) => handleProductChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-28" />
                      <span className="text-sm font-semibold w-24 text-right">{product.total_price.toFixed(2)} TL</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveProduct(index)}
                        className="text-red-600 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-3 border-t border-zinc-200">
                    <div className="text-right">
                      <span className="text-zinc-500 text-sm">Toplam: </span>
                      <span className="text-xl font-bold">{totalPrice.toFixed(2)} TL</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedProducts.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">Henüz ürün eklenmedi</p>
              )}
            </div>
          )}

          {/* Notlar */}
          {(currentConfig.fields?.includes('notes')) && (
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Sipariş ile ilgili notlar..."
                rows={3}
              />
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sipariş Türünü Değiştir
            </Button>
            <Button type="submit" disabled={loading || selectedProducts.length === 0}>
              {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {loading ? 'Kaydediliyor...' : 'Siparişi Kaydet'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default OrderCreate;

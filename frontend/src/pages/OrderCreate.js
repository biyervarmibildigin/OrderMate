import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OrderCreate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderTypes, setOrderTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [formData, setFormData] = useState({
    order_type: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    tax_number: '',
    tax_office: '',
    delivery_method: '',
    cargo_company: '',
    cargo_tracking_code: '',
    whatsapp_content: '',
    notes: ''
  });

  useEffect(() => {
    fetchOrderTypes();
    fetchProducts();
  }, []);

  const fetchOrderTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/order-types`);
      const activeTypes = response.data.filter(t => t.is_active);
      setOrderTypes(activeTypes);
      
      if (activeTypes.length > 0) {
        const defaultType = user?.role === 'showroom' 
          ? activeTypes.find(t => t.code === 'showroom_satis') 
          : activeTypes[0];
        setFormData(prev => ({ ...prev, order_type: defaultType?.code || activeTypes[0].code }));
      }
    } catch (error) {
      console.error('Failed to fetch order types:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products?limit=1000`);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    const searchLower = value.toLowerCase();
    const results = products.filter(p => 
      p.product_name.toLowerCase().includes(searchLower) ||
      p.web_service_code?.toLowerCase().includes(searchLower) ||
      p.barcode?.toLowerCase().includes(searchLower)
    ).slice(0, 10);

    setSearchResults(results);
  };

  const handleSelectProduct = (product) => {
    const exists = selectedProducts.find(p => p.id === product.id);
    if (exists) {
      toast.error('Bu ürün zaten eklendi');
      return;
    }

    setSelectedProducts([...selectedProducts, { ...product, quantity: 1, unit_price: 0, total_price: 0 }]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleCreateManualProduct = async () => {
    if (!searchTerm.trim()) return;

    try {
      const response = await axios.post(
        `${API_URL}/products/create-manual`,
        { product_name: searchTerm }
      );
      toast.success(`"${response.data.product_name}" ürünü oluşturuldu (${response.data.web_service_code})`);
      
      setSelectedProducts([...selectedProducts, { ...response.data, quantity: 1, unit_price: 0, total_price: 0 }]);
      setSearchTerm('');
      setSearchResults([]);
      fetchProducts();
    } catch (error) {
      toast.error('Ürün oluşturulamadı');
    }
  };

  const handleRemoveProduct = (index) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, quantity) => {
    const updated = [...selectedProducts];
    updated[index].quantity = Math.max(1, parseInt(quantity) || 1);
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setSelectedProducts(updated);
  };

  const handleUpdatePrice = (index, price) => {
    const updated = [...selectedProducts];
    updated[index].unit_price = Math.max(0, parseFloat(price) || 0);
    updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    setSelectedProducts(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create order
      const response = await axios.post(`${API_URL}/orders`, formData);
      const orderId = response.data.id;

      // Add order items
      for (const product of selectedProducts) {
        await axios.post(`${API_URL}/order-items`, {
          order_id: orderId,
          product_id: product.id,
          product_name: product.product_name,
          quantity: product.quantity,
          item_type: 'katalog_urunu',
          item_status: 'netlesecek'
        });
      }

      toast.success('Sipariş başarıyla oluşturuldu!');
      navigate(`/orders/${orderId}`);
    } catch (error) {
      toast.error('Sipariş oluşturulurken hata: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isShowroomDelivery = formData.delivery_method === 'showroom';

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
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Yeni Sipariş
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Yeni sipariş oluştur
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 border-zinc-200">
          <div className="space-y-6">
            {/* Order Type */}
            <div className="space-y-2">
              <Label htmlFor="order_type">Sipariş Türü</Label>
              <select
                id="order_type"
                value={formData.order_type}
                onChange={(e) => handleChange('order_type', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                data-testid="order-type-select"
              >
                {orderTypes.map((orderType) => (
                  <option key={orderType.id} value={orderType.code}>
                    {orderType.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Müşteri Adı</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  placeholder="Müşteri adı"
                  data-testid="customer-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_phone">Telefon</Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => handleChange('customer_phone', e.target.value)}
                  placeholder="+90 XXX XXX XX XX"
                  data-testid="customer-phone-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_email">E-posta</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => handleChange('customer_email', e.target.value)}
                  placeholder="ornek@email.com"
                  data-testid="customer-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery_method">Teslimat Şekli</Label>
                <select
                  id="delivery_method"
                  value={formData.delivery_method}
                  onChange={(e) => handleChange('delivery_method', e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                  data-testid="delivery-method-select"
                >
                  <option value="">Seçiniz</option>
                  <option value="kargo">Kargo</option>
                  <option value="showroom">Showroom</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_address">Adres</Label>
              <Textarea
                id="customer_address"
                value={formData.customer_address}
                onChange={(e) => handleChange('customer_address', e.target.value)}
                placeholder="Müşteri adresi"
                rows={2}
                data-testid="customer-address-input"
              />
            </div>

            {/* Cargo Info - Only show if delivery is kargo */}
            {formData.delivery_method === 'kargo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cargo_company">Kargo Firması</Label>
                  <select
                    id="cargo_company"
                    value={formData.cargo_company}
                    onChange={(e) => handleChange('cargo_company', e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    data-testid="cargo-company-select"
                  >
                    <option value="">Seçiniz</option>
                    <option value="yurtici">Yurtiçi Kargo</option>
                    <option value="mng">MNG Kargo</option>
                    <option value="aras">Aras Kargo</option>
                    <option value="ptt">PTT Kargo</option>
                    <option value="ups">UPS Kargo</option>
                    <option value="dhl">DHL</option>
                    <option value="fedex">FedEx</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo_tracking_code">Kargo Takip Kodu</Label>
                  <Input
                    id="cargo_tracking_code"
                    value={formData.cargo_tracking_code}
                    onChange={(e) => handleChange('cargo_tracking_code', e.target.value)}
                    placeholder="Takip numarası"
                    data-testid="cargo-tracking-code-input"
                  />
                </div>
              </div>
            )}

            {/* Tax Info */}
            {formData.order_type === 'kurumsal_cari' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_number">Vergi Kimlik No</Label>
                  <Input
                    id="tax_number"
                    value={formData.tax_number}
                    onChange={(e) => handleChange('tax_number', e.target.value)}
                    placeholder="XXXXXXXXXXX"
                    data-testid="tax-number-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_office">Vergi Dairesi</Label>
                  <Input
                    id="tax_office"
                    value={formData.tax_office}
                    onChange={(e) => handleChange('tax_office', e.target.value)}
                    placeholder="Vergi dairesi adı"
                    data-testid="tax-office-input"
                  />
                </div>
              </div>
            )}

            {/* Product Selection */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <Label>Ürün Ekle</Label>
              <div className="relative">
                <Input
                  placeholder="Ürün adı veya T kodu ile ara..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  data-testid="product-search-input"
                />
                
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((product) => (
                      <div
                        key={product.id}
                        className="p-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div className="font-medium text-sm">{product.product_name}</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Kod: {product.web_service_code} • Stok: {product.stock}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchTerm && searchResults.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg p-4">
                    <p className="text-sm text-zinc-600 mb-3">Ürün bulunamadı</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateManualProduct}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      "{searchTerm}" olarak manuel ekle
                    </Button>
                  </div>
                )}
              </div>

              {/* Selected Products */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2">
                  <Label>Seçili Ürünler ({selectedProducts.length})</Label>
                  {selectedProducts.map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-zinc-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{product.product_name}</div>
                        <div className="text-xs text-zinc-500">{product.web_service_code}</div>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProduct(index)}
                        className="text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WhatsApp Content */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp_content">WhatsApp İçeriği</Label>
              <Textarea
                id="whatsapp_content"
                value={formData.whatsapp_content}
                onChange={(e) => handleChange('whatsapp_content', e.target.value)}
                placeholder="WhatsApp mesajını buraya yapıştırın..."
                rows={4}
                data-testid="whatsapp-content-input"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Ek notlar..."
                rows={3}
                data-testid="notes-input"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/orders')}
                data-testid="cancel-button"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                data-testid="submit-order-button"
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Kaydediliyor...' : 'Siparişi Oluştur'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default OrderCreate;

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
import { ArrowLeft, Save } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const OrderCreate = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderTypes, setOrderTypes] = useState([]);
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
  }, []);

  const fetchOrderTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/order-types`);
      const activeTypes = response.data.filter(t => t.is_active);
      setOrderTypes(activeTypes);
      
      // Set default order type
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/orders`, formData);
      toast.success('Sipariş başarıyla oluşturuldu!');
      navigate(`/orders/${response.data.id}`);
    } catch (error) {
      toast.error('Sipariş oluşturulurken hata: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
                  <option value="elden">Elden</option>
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

            {/* Tax Info */}
            {formData.order_type === 'cari_kurumsal' && (
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

            {/* Cargo Info */}
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

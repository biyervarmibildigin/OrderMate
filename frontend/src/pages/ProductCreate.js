import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ProductCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    web_service_code: '',
    supplier_product_code: '',
    barcode: '',
    stock: 0,
    stock_unit: 'Adet',
    brand: '',
    supplier: '',
    is_active: true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/products`, formData);
      toast.success('Ürün başarıyla oluşturuldu!');
      navigate('/products');
    } catch (error) {
      toast.error('Ürün oluşturulurken hata: ' + (error.response?.data?.detail || error.message));
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
          onClick={() => navigate('/products')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Yeni Ürün
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Yeni ürün ekle
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 border-zinc-200">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="product_name">* Ürün Adı</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => handleChange('product_name', e.target.value)}
                placeholder="Ürün adı"
                required
                data-testid="product-name-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="web_service_code">Web Servis Kodu</Label>
                <Input
                  id="web_service_code"
                  value={formData.web_service_code}
                  onChange={(e) => handleChange('web_service_code', e.target.value)}
                  placeholder="T1234"
                  data-testid="web-service-code-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barkod</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  placeholder="123456789"
                  data-testid="barcode-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Marka</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => handleChange('brand', e.target.value)}
                  placeholder="Marka adı"
                  data-testid="brand-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Tedarikçi</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => handleChange('supplier', e.target.value)}
                  placeholder="Tedarikçi adı"
                  data-testid="supplier-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                  data-testid="stock-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_unit">Birim</Label>
                <Input
                  id="stock_unit"
                  value={formData.stock_unit}
                  onChange={(e) => handleChange('stock_unit', e.target.value)}
                  placeholder="Adet, Kg, vb."
                  data-testid="stock-unit-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_product_code">Tedarikçi Kodu</Label>
                <Input
                  id="supplier_product_code"
                  value={formData.supplier_product_code}
                  onChange={(e) => handleChange('supplier_product_code', e.target.value)}
                  placeholder="SUP123"
                  data-testid="supplier-code-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/products')}
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                data-testid="submit-product-button"
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default ProductCreate;

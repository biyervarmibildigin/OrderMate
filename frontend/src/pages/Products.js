import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Loader, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products?limit=50`);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      fetchProducts();
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/products?search=${searchTerm}&limit=50`);
      setProducts(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/products/upload-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`${response.data.total} ürün yüklendi/güncellendi!`);
      fetchProducts();
    } catch (error) {
      toast.error('CSV yükleme başarısız: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const canUpload = ['admin', 'warehouse', 'finance'].includes(user?.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold font-heading tracking-tight text-zinc-900">
            Ürünler
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {products.length} ürün listeleniyor
          </p>
        </div>
        <div className="flex gap-2">
          {canUpload && (
            <>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                style={{ display: 'none' }}
                id="csv-upload"
                data-testid="csv-upload-input"
              />
              <label htmlFor="csv-upload">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={uploading}
                  as="span"
                  className="cursor-pointer"
                  data-testid="csv-upload-button"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Yükleniyor...' : 'CSV Yükle'}
                </Button>
              </label>
            </>
          )}
          <Link to="/products/new">
            <Button size="lg" data-testid="create-product-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Ürün
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Ürün adı, barkod, tedarikçi kodu ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
            data-testid="search-products-input"
          />
        </div>
        <Button onClick={handleSearch} data-testid="search-button">
          Ara
        </Button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.length === 0 ? (
          <Card className="col-span-full p-12 text-center border-zinc-200">
            <p className="text-zinc-500">Henüz ürün bulunmuyor.</p>
            <Link to="/products/new">
              <Button className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                İlk Ürünü Ekle
              </Button>
            </Link>
          </Card>
        ) : (
          products.map((product) => (
            <Card
              key={product.id}
              className="p-6 hover:shadow-md transition-all duration-200 border-zinc-200 hover:-translate-y-0.5"
              data-testid={`product-${product.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-zinc-900 line-clamp-2">
                    {product.product_name}
                  </h3>
                  {product.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Aktif
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">
                      Pasif
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-sm">
                  {product.web_service_code && (
                    <p className="text-zinc-600 font-mono text-xs">
                      Kod: {product.web_service_code}
                    </p>
                  )}
                  {product.brand && (
                    <p className="text-zinc-600">
                      Marka: {product.brand}
                    </p>
                  )}
                  {product.supplier && (
                    <p className="text-zinc-600">
                      Tedarikçi: {product.supplier}
                    </p>
                  )}
                  <p className="text-zinc-600">
                    Stok: <span className="font-semibold">{product.stock}</span>
                    {product.stock_unit && ` ${product.stock_unit}`}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Products;

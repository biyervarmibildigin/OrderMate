import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader, Plus, Search, Upload, Edit, Grid3x3, List, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
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

  const handleOpenEditDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        product_name: product.product_name,
        web_service_code: product.web_service_code || '',
        supplier_product_code: product.supplier_product_code || '',
        barcode: product.barcode || '',
        stock: product.stock,
        stock_unit: product.stock_unit || 'Adet',
        brand: product.brand || '',
        supplier: product.supplier || '',
        is_active: product.is_active
      });
    }
    setEditDialogOpen(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/products/${editingProduct.id}`, formData);
      toast.success('Ürün güncellendi');
      setEditDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast.error('Güncelleme başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`"${productName}" ürününü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/products/${productId}`);
      toast.success('Ürün silindi');
      fetchProducts();
    } catch (error) {
      toast.error('Silme başarısız: ' + (error.response?.data?.detail || error.message));
    }
  };

  if (loading) {
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
            Ürünler
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            {products.length} ürün listeleniyor
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: 'none' }}
            id="csv-upload-input"
            data-testid="csv-upload-input"
          />
          <Button
            variant="outline"
            size="lg"
            disabled={uploading}
            onClick={() => document.getElementById('csv-upload-input').click()}
            data-testid="csv-upload-button"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Yükleniyor...' : 'CSV Yükle'}
          </Button>
          <Link to="/products/new">
            <Button size="lg" data-testid="create-product-button">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Ürün
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and View Toggle */}
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
        <div className="flex border border-zinc-200 rounded-md">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('list')}
            className="rounded-r-none"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
            className="rounded-l-none"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Display */}
      {products.length === 0 ? (
        <Card className="p-12 text-center border-zinc-200">
          <p className="text-zinc-500">Henüz ürün bulunmuyor.</p>
          <Link to="/products/new">
            <Button className="mt-4" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              İlk Ürünü Ekle
            </Button>
          </Link>
        </Card>
      ) : viewMode === 'list' ? (
        /* List View */
        <Card className="border-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Ürün Adı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Kod
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Marka
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Tedarikçi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Durum
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-zinc-50" data-testid={`product-${product.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-zinc-900">{product.product_name}</div>
                      {product.barcode && (
                        <div className="text-xs text-zinc-500 font-mono">{product.barcode}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-zinc-600 font-mono">{product.web_service_code || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      {product.brand || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      {product.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-zinc-900">
                        {product.stock} {product.stock_unit || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-100 text-zinc-800 border-zinc-200">
                          Pasif
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditDialog(product)}
                          data-testid={`edit-product-${product.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id, product.product_name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`delete-product-${product.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
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

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleOpenEditDialog(product)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ürünü Düzenle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_product_name">* Ürün Adı</Label>
              <Input
                id="edit_product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_web_service_code">Web Servis Kodu</Label>
                <Input
                  id="edit_web_service_code"
                  value={formData.web_service_code}
                  onChange={(e) => setFormData({...formData, web_service_code: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_barcode">Barkod</Label>
                <Input
                  id="edit_barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_brand">Marka</Label>
                <Input
                  id="edit_brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_supplier">Tedarikçi</Label>
                <Input
                  id="edit_supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_stock">Stok</Label>
                <Input
                  id="edit_stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_stock_unit">Birim</Label>
                <Input
                  id="edit_stock_unit"
                  value={formData.stock_unit}
                  onChange={(e) => setFormData({...formData, stock_unit: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_supplier_product_code">Tedarikçi Kodu</Label>
                <Input
                  id="edit_supplier_product_code"
                  value={formData.supplier_product_code}
                  onChange={(e) => setFormData({...formData, supplier_product_code: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <Label htmlFor="edit_is_active">Aktif</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">
                Güncelle
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

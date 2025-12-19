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
import { Loader, Plus, Search, Upload, Edit, Grid3x3, List, Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      const response = await axios.get(`${API_URL}/products?limit=100`);
      setProducts(response.data);
      setSelectedProducts(new Set());
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
      const response = await axios.get(`${API_URL}/products?search=${encodeURIComponent(searchTerm)}&limit=100`);
      setProducts(response.data);
      setSelectedProducts(new Set());
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

  // Bulk selection handlers
  const toggleSelectProduct = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    
    setDeleting(true);
    try {
      const response = await axios.post(`${API_URL}/products/bulk-delete`, {
        ids: Array.from(selectedProducts)
      });
      toast.success(response.data.message);
      setBulkDeleteDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast.error('Toplu silme başarısız: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const response = await axios.delete(`${API_URL}/products/delete-all`);
      toast.success(response.data.message);
      setDeleteAllDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast.error('Silme başarısız: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
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
            {selectedProducts.size > 0 && ` • ${selectedProducts.size} seçili`}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: 'none' }}
            id="csv-upload-input"
          />
          <Button
            variant="outline"
            size="lg"
            disabled={uploading}
            onClick={() => document.getElementById('csv-upload-input').click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Yükleniyor...' : 'CSV Yükle'}
          </Button>
          <Link to="/products/new">
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Ürün
            </Button>
          </Link>
        </div>
      </div>

      {/* Bulk Actions */}
      {user?.role === 'admin' && (
        <div className="flex gap-2 items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
          <span className="text-sm text-zinc-600 font-medium">Toplu İşlemler:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkDeleteDialogOpen(true)}
            disabled={selectedProducts.size === 0}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Seçilenleri Sil ({selectedProducts.size})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteAllDialogOpen(true)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Tümünü Sil
          </Button>
        </div>
      )}

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
          />
        </div>
        <Button onClick={handleSearch}>Ara</Button>
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
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 text-left">
                      <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-zinc-600">
                        {selectedProducts.size === products.length ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                  )}
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
                  <tr key={product.id} className={`hover:bg-zinc-50 ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''}`}>
                    {user?.role === 'admin' && (
                      <td className="px-4 py-4">
                        <button onClick={() => toggleSelectProduct(product.id)} className="text-zinc-400 hover:text-zinc-600">
                          {selectedProducts.has(product.id) ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                    )}
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
                      <Badge className={product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-800'}>
                        {product.is_active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id, product.product_name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} className={`p-4 border-zinc-200 ${selectedProducts.has(product.id) ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                {user?.role === 'admin' && (
                  <button onClick={() => toggleSelectProduct(product.id)} className="text-zinc-400 hover:text-zinc-600">
                    {selectedProducts.has(product.id) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                )}
                <Badge className={product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-800'}>
                  {product.is_active ? 'Aktif' : 'Pasif'}
                </Badge>
              </div>
              <h3 className="font-semibold text-zinc-900 mb-1 line-clamp-2">{product.product_name}</h3>
              <p className="text-xs text-zinc-500 font-mono mb-2">{product.web_service_code || '-'}</p>
              <div className="flex justify-between items-center text-sm text-zinc-600">
                <span>{product.brand || '-'}</span>
                <span className="font-semibold">{product.stock} {product.stock_unit}</span>
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-zinc-100">
                <Button variant="ghost" size="sm" onClick={() => handleOpenEditDialog(product)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteProduct(product.id, product.product_name)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ürün Düzenle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-2">
              <Label>Ürün Adı</Label>
              <Input
                value={formData.product_name}
                onChange={(e) => setFormData({...formData, product_name: e.target.value})}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Web Servis Kodu</Label>
                <Input
                  value={formData.web_service_code}
                  onChange={(e) => setFormData({...formData, web_service_code: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Barkod</Label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marka</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tedarikçi</Label>
                <Input
                  value={formData.supplier}
                  onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stok</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Birim</Label>
                <Input
                  value={formData.stock_unit}
                  onChange={(e) => setFormData({...formData, stock_unit: e.target.value})}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Seçili Ürünleri Sil
            </DialogTitle>
          </DialogHeader>
          <p className="text-zinc-600">
            <strong>{selectedProducts.size}</strong> ürünü silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} disabled={deleting}>
              İptal
            </Button>
            <Button onClick={handleBulkDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleting ? 'Siliniyor...' : 'Evet, Sil'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tüm Ürünleri Sil
            </DialogTitle>
          </DialogHeader>
          <p className="text-zinc-600">
            <strong>TÜM</strong> ürünleri silmek istediğinizden emin misiniz?
            Bu işlem geri alınamaz ve veritabanındaki tüm ürün kayıtları silinecektir.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} disabled={deleting}>
              İptal
            </Button>
            <Button onClick={handleDeleteAll} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleting ? 'Siliniyor...' : 'Evet, Tümünü Sil'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

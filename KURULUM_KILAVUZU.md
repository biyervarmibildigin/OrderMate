# 📦 Sipariş Yönetim Sistemi - Kurulum Kılavuzu

Bu kılavuz, sipariş yönetim sisteminin sıfırdan kurulumu için hazırlanmıştır.

---

## 📋 İçindekiler

1. [Sistem Gereksinimleri](#-sistem-gereksinimleri)
2. [Teknoloji Stack](#-teknoloji-stack)
3. [Hızlı Başlangıç](#-hızlı-başlangıç)
4. [Detaylı Kurulum](#-detaylı-kurulum)
5. [Ortam Değişkenleri](#-ortam-değişkenleri)
6. [Varsayılan Kullanıcılar](#-varsayılan-kullanıcılar)
7. [Özellikler](#-özellikler)
8. [API Endpoints](#-api-endpoints)
9. [Sorun Giderme](#-sorun-giderme)

---

## 💻 Sistem Gereksinimleri

### Minimum Gereksinimler
- **İşletim Sistemi:** Ubuntu 20.04+, macOS 12+, Windows 10+ (WSL2 önerilir)
- **RAM:** 4 GB
- **Disk:** 10 GB boş alan
- **CPU:** 2 çekirdek

### Yazılım Gereksinimleri
| Yazılım | Minimum Versiyon | İndirme Linki |
|---------|------------------|---------------|
| Node.js | 18.x | https://nodejs.org |
| Python | 3.10+ | https://python.org |
| MongoDB | 6.0+ | https://mongodb.com |
| Yarn | 1.22+ | `npm install -g yarn` |
| Git | 2.30+ | https://git-scm.com |

---

## 🛠 Teknoloji Stack

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│  React 18 + TailwindCSS + Shadcn/UI + React Router      │
│                    Port: 3000                            │
├─────────────────────────────────────────────────────────┤
│                      BACKEND                             │
│  FastAPI + Pydantic + Motor (Async MongoDB) + JWT       │
│                    Port: 8001                            │
├─────────────────────────────────────────────────────────┤
│                      DATABASE                            │
│                 MongoDB (NoSQL)                          │
│                    Port: 27017                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Hızlı Başlangıç

### 1. Projeyi İndirin
```bash
git clone <repository-url> siparis-yonetim
cd siparis-yonetim
```

### 2. Backend Kurulumu
```bash
cd backend

# Virtual environment oluştur
python -m venv venv

# Aktif et (Linux/macOS)
source venv/bin/activate

# Aktif et (Windows)
.\venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt
```

### 3. Frontend Kurulumu
```bash
cd ../frontend

# Bağımlılıkları yükle (npm DEĞİL, yarn kullanın!)
yarn install
```

### 4. MongoDB Başlatın
```bash
# macOS (Homebrew ile)
brew services start mongodb-community

# Ubuntu
sudo systemctl start mongod

# Windows
net start MongoDB

# Docker ile (önerilen)
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 5. Ortam Değişkenlerini Ayarlayın
```bash
# Backend (.env)
cd backend
cp .env.example .env
# .env dosyasını düzenleyin

# Frontend (.env)
cd ../frontend
cp .env.example .env
# .env dosyasını düzenleyin
```

### 6. Uygulamayı Başlatın
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd frontend
yarn start
```

### 7. Tarayıcıda Açın
```
http://localhost:3000
```

---

## 📖 Detaylı Kurulum

### MongoDB Kurulumu

#### Docker ile (Önerilen)
```bash
# MongoDB container başlat
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:6

# Bağlantı string'i
# mongodb://admin:password123@localhost:27017/orderdb?authSource=admin
```

#### Ubuntu'da Native Kurulum
```bash
# MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg \
   --dearmor

# Repository ekle
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Yükle
sudo apt-get update
sudo apt-get install -y mongodb-org

# Başlat
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS'ta Native Kurulum
```bash
# Homebrew ile
brew tap mongodb/brew
brew install mongodb-community@6.0

# Başlat
brew services start mongodb-community@6.0
```

### Backend Bağımlılıkları

`requirements.txt` dosyası:
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
motor==3.3.2
pydantic==2.5.2
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
reportlab==4.0.7
```

### Frontend Bağımlılıkları

Önemli paketler:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2",
    "tailwindcss": "^3.3.5",
    "sonner": "^1.2.4",
    "lucide-react": "^0.294.0"
  }
}
```

---

## ⚙️ Ortam Değişkenleri

### Backend (`/backend/.env`)
```env
# MongoDB Bağlantısı
MONGO_URL=mongodb://localhost:27017
DB_NAME=orderdb

# JWT Güvenlik
JWT_SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Uygulama
DEBUG=true
```

### Frontend (`/frontend/.env`)
```env
# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:8001

# Diğer ayarlar (opsiyonel)
REACT_APP_APP_NAME=Sipariş Yönetim Sistemi
```

### Production için Örnek
```env
# Backend
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net
DB_NAME=orderdb_prod
JWT_SECRET_KEY=uzun-ve-rastgele-bir-anahtar-uretiniz
DEBUG=false

# Frontend
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

---

## 👥 Varsayılan Kullanıcılar

İlk çalıştırmada otomatik olarak oluşturulan kullanıcılar:

| Kullanıcı Adı | Şifre | Rol | Açıklama |
|---------------|-------|-----|----------|
| `admin` | `admin123` | Admin | Tam yetki |
| `showroom` | `showroom123` | Showroom | Mağaza satış |
| `kurumsal` | `kurumsal123` | Corporate Sales | Kurumsal satış |
| `depo` | `depo123` | Warehouse | Depo yönetimi |
| `muhasebe` | `muhasebe123` | Accounting | Muhasebe |

> ⚠️ **ÖNEMLİ:** Production'da bu şifreleri mutlaka değiştirin!

---

## ✨ Özellikler

### Sipariş Yönetimi
- ✅ Çoklu sipariş türleri (Showroom, Kurumsal, Teklif, vb.)
- ✅ Dinamik form alanları (sipariş türüne göre)
- ✅ Sipariş numaralandırma: `KAggaayy000001` formatı
- ✅ VKN/TC Kimlik validasyonu
- ✅ Fatura/İrsaliye/Kargo durum takibi
- ✅ Sipariş geçmişi ve not ekleme
- ✅ PDF teklif/fatura oluşturma (Türkçe karakter destekli)

### Ürün Yönetimi
- ✅ 14.000+ ürün desteği
- ✅ CSV ile toplu ürün yükleme
- ✅ Ürün arama (anlık)
- ✅ Toplu silme

### Dosya Yönetimi
- ✅ Siparişe dosya ekleme (resim, PDF, Word, Excel)
- ✅ Dosya önizleme
- ✅ Max 10MB dosya boyutu

### Kullanıcı Yönetimi
- ✅ Rol tabanlı yetkilendirme
- ✅ JWT token ile güvenli oturum
- ✅ Kullanıcı bazlı sipariş kodları

### Dashboard
- ✅ Özet kartlar (tıklanabilir filtreler)
- ✅ Sipariş durumu istatistikleri

---

## 🔌 API Endpoints

### Kimlik Doğrulama
```
POST /api/auth/login          # Giriş yap
POST /api/auth/register       # Kayıt ol
GET  /api/users/me            # Mevcut kullanıcı
```

### Siparişler
```
GET    /api/orders                    # Tüm siparişler
POST   /api/orders                    # Yeni sipariş
GET    /api/orders/{order_code}       # Sipariş detayı
PUT    /api/orders/{order_code}       # Sipariş güncelle
DELETE /api/orders/{order_code}       # Sipariş sil
GET    /api/orders/{order_code}/pdf   # PDF oluştur
POST   /api/orders/{order_code}/add-note  # Not ekle
```

### Sipariş Kalemleri
```
POST   /api/order-items               # Kalem ekle
PUT    /api/order-items/{item_id}     # Kalem güncelle
DELETE /api/order-items/{item_id}     # Kalem sil
```

### Ürünler
```
GET    /api/products                  # Ürün listesi
GET    /api/products/search?q=xxx     # Ürün ara
POST   /api/products                  # Ürün ekle
POST   /api/products/upload-csv       # CSV yükle
DELETE /api/products/delete-all       # Tümünü sil
POST   /api/products/bulk-delete      # Toplu sil
```

### Ayarlar
```
GET    /api/settings/order-types      # Sipariş türleri
POST   /api/settings/order-types      # Yeni sipariş türü
GET    /api/settings/pdf              # PDF ayarları
POST   /api/settings/pdf              # PDF ayarları güncelle
GET    /api/bank-accounts             # Banka hesapları
POST   /api/bank-accounts             # Hesap ekle
```

### Dashboard
```
GET    /api/dashboard/stats           # İstatistikler
```

---

## 🔧 Sorun Giderme

### MongoDB Bağlantı Hatası
```
Error: Connection refused
```
**Çözüm:**
```bash
# MongoDB çalışıyor mu kontrol et
sudo systemctl status mongod

# Çalışmıyorsa başlat
sudo systemctl start mongod

# Log kontrol
sudo tail -f /var/log/mongodb/mongod.log
```

### Backend Başlamıyor
```
ModuleNotFoundError: No module named 'xxx'
```
**Çözüm:**
```bash
# Virtual environment aktif mi?
source venv/bin/activate

# Bağımlılıkları yeniden yükle
pip install -r requirements.txt
```

### Frontend Hataları
```
Module not found: Can't resolve 'xxx'
```
**Çözüm:**
```bash
# node_modules sil ve yeniden yükle
rm -rf node_modules
yarn install
```

### Port Kullanımda
```
Error: Port 3000 already in use
```
**Çözüm:**
```bash
# Portu kullanan process'i bul
lsof -i :3000

# Process'i durdur
kill -9 <PID>
```

### JWT Token Hatası
```
401 Unauthorized
```
**Çözüm:**
- Tarayıcı localStorage'ı temizleyin
- Yeniden giriş yapın
- JWT_SECRET_KEY'in backend'de doğru ayarlandığından emin olun

---

## 🚢 Production Deployment

### Docker Compose (Önerilen)
```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - "27017:27017"

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      MONGO_URL: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017
      DB_NAME: orderdb
      JWT_SECRET_KEY: ${JWT_SECRET}
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      REACT_APP_BACKEND_URL: ${BACKEND_URL}
    depends_on:
      - backend

volumes:
  mongodb_data:
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📞 Destek

Sorularınız için:
- GitHub Issues açın
- Dokümantasyonu inceleyin

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

**Son Güncelleme:** Aralık 2025

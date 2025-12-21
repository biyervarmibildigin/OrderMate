# OrderMate Kurulum & Deploy Kılavuzu (Türkçe)

Bu doküman, **hiç bilmeyen bir kullanıcının bile** uygulamayı hem **kendi bilgisayarında geliştirme ortamı** olarak, hem de **basit bir sunucuda (VPS / production)** çalıştırabilmesi için hazırlanmıştır.

Uygulama 3 ana parçadan oluşur:
- **Frontend:** React (SPA) – `frontend/`
- **Backend:** FastAPI (Python) – `backend/`
- **Veritabanı:** MongoDB

---

## 1. Mimari ve Çalışma Mantığı

- Frontend, tarayıcıda `http://...:3000` portunda çalışan bir React uygulamasıdır.
- Backend, `http://...:8001` portunda çalışan bir FastAPI REST API’sidir.
- Tüm backend endpoint’leri **`/api` ile başlar**:
  - Örn: `/api/auth/login`, `/api/orders`, `/api/products/search` vb.
- Frontend, backend adresini `.env` içindeki **`REACT_APP_BACKEND_URL`** değişkeninden okur.
- Backend, MongoDB bağlantı bilgisini `.env` içindeki **`MONGO_URL`** ve **`DB_NAME`** üzerinden alır.

---

## 2. Önkoşullar

Aşağıdaki yazılımlar hem yerel geliştirme hem de sunucu ortamı için gereklidir:

1. **Git** (opsiyonel ama tavsiye edilir)
2. **Python 3.10+** (3.9 da genelde uygundur, 3.10 üstü önerilir)
3. **Node.js 18+** ve **Yarn**
   - Node.js: <https://nodejs.org/>
   - Yarn: `npm install -g yarn` (sadece bir kere, global)
4. **MongoDB 6+**
   - Lokal kurulum: <https://www.mongodb.com/try/download/community>
   - Ya da bulut: MongoDB Atlas vb.

> Not: Bu kılavuzda komutlar çoğunlukla Linux / macOS içindir. Windows’ta PowerShell’de benzer şekilde çalışır; `source venv/bin/activate` yerine `venv\Scripts\activate` kullanılır.

---

## 3. Kaynak Kodun Alınması

Eğer kodu Git ile yönetecekseniz:

```bash
git clone <SIZIN_REPO_URLINIZ>
cd <proje_klasoru>
```

Emergent içinde çalışıyorsanız, proje klasörü genellikle `/app` altındadır ve bu adım zaten yapılmış olur.

---

## 4. Backend Kurulumu (FastAPI)

### 4.1. Sanal ortam (virtualenv) oluşturma

Proje kök klasöründe:

```bash
cd backend

# Sanal ortam oluştur
python -m venv venv

# Sanal ortamı aktif et (Linux / macOS)
source venv/bin/activate

# Windows (PowerShell)
# .\venv\Scripts\activate
```

### 4.2. Bağımlılıkların kurulumu

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

Eğer yeni paketler eklerseniz, sonrasında:

```bash
pip freeze > requirements.txt
```

### 4.3. Backend `.env` dosyası

`backend/.env` dosyası içinde aşağıya benzer değerler olmalıdır (gerçek değerler size özeldir):

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ordermate
JWT_SECRET=buraya_uzun_rastgele_bir_anahtar_yazin
```

> Önemli:
> - **Gerçek projede** hassas değerleri (JWT_SECRET, üretim Mongo URL’si vb.) asla Git’e koymayın; sunucuya manuel koyun.
> - Emergent ortamında bu dosya zaten önceden doldurulmuş olabilir, değerleri silmeyin.

### 4.4. Backend’i geliştirme modunda çalıştırma (lokalde)

Sanal ortam açıkken:

```bash
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

- API, `http://localhost:8001/api` altından çalışacaktır.
- Örnek: `http://localhost:8001/api/auth/login`

> Emergent platformu içinde çalışıyorsanız, backend zaten Supervisor ile `0.0.0.0:8001`’de koşturulur; bu komutu orada kullanmanız gerekmez.

---

## 5. Frontend Kurulumu (React)

### 5.1. Bağımlılıkların kurulumu

Proje kökünden:

```bash
cd frontend
yarn install
```

> Not: Uygulamada **npm yerine mutlaka `yarn`** kullanılmalıdır.

### 5.2. Frontend `.env` dosyası

`frontend/.env` içinde en az şu satır bulunmalıdır:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

- Geliştirme ortamında backend’i `localhost:8001`’de çalıştırıyorsanız bu değer iş görür.
- Production’da bu değer sunucunuzun dışarıya açık backend adresi olmalıdır, örneğin:
  - `https://sizin-domaininiz.com`  (arka tarafta Nginx ile `/api` istekleri backend’e gönderilir)

### 5.3. Frontend’i geliştirme modunda çalıştırma

```bash
cd frontend
yarn start
```

- Uygulama tarayıcıda şu adreste açılır: `http://localhost:3000`
- Login ekranı gelmelidir.

### 5.4. Test kullanıcıları

Login ekranında test hesapları gösterilir. Örneğin:

- **Admin:** `admin / admin123`
- (Varsa) diğer roller: `showroom / showroom123`, `furkan / furkan123` vb.

Bu hesaplarla giriş yaparak sistemi uçtan uca test edebilirsiniz.

---

## 6. Geliştirme Ortamında Özet Akış

1. MongoDB’yi başlatın (servis olarak veya `mongod` komutuyla).
2. Backend sanal ortamını açın ve FastAPI’yi çalıştırın:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```
3. Frontend’i çalıştırın:
   ```bash
   cd frontend
   yarn start
   ```
4. Tarayıcıdan `http://localhost:3000` adresine gidin.
5. Giriş yapın ve sipariş / ürün fonksiyonlarını test edin.

---

## 7. Basit Production / Sunucu (VPS) Kurulumu

Bu bölüm tek bir Linux sunucusuna (ör. Ubuntu 22.04) **en temel üretim kurulumunu** özetler.

### 7.1. Sunucuda temel paketlerin kurulumu

```bash
# Sistem paketlerini güncelle
sudo apt update && sudo apt upgrade -y

# Python, Node, git, build araçları
sudo apt install -y python3 python3-venv python3-pip git

# Node.js için (örn. NodeSource veya nvm kullanabilirsiniz)
# Örnek (Node 18 LTS için NodeSource):
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# sudo apt install -y nodejs

# MongoDB (Ubuntu reposu veya resmi repo üzerinden)
# Basit örnek (dağıtıma göre değişebilir):
# sudo apt install -y mongodb
```

MongoDB’yi sistem servisi olarak başlatın ve otomatik başlamasını sağlayın:

```bash
sudo systemctl enable mongodb
sudo systemctl start mongodb
```

### 7.2. Projeyi sunucuya kopyalama

Git ile:

```bash
cd /opt
sudo git clone <SIZIN_REPO_URLINIZ> ordermate
sudo chown -R $USER:$USER ordermate
cd ordermate
```

### 7.3. Production için backend kurulumu

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

`backend/.env`’i sunucuya uygun şekilde düzenleyin:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ordermate_prod
JWT_SECRET=buraya_uzun_ve_guclu_bir_anahtar_yazin
```

### 7.4. Production için frontend build

```bash
cd ../frontend
# .env dosyasında backend URL olarak sunucunun gerçek dış adresini kullanın
# Örn: REACT_APP_BACKEND_URL=https://sizin-domaininiz.com

yarn install
yarn build
```

Bu komut sonunda `frontend/build` klasörü oluşur. Bu klasör production’da statik dosya olarak servis edilir (örneğin Nginx ile).

### 7.5. Backend’i servis olarak çalıştırma (örnek: systemd)

`/etc/systemd/system/ordermate-backend.service` dosyası (root olarak):

```ini
[Unit]
Description=OrderMate FastAPI Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/ordermate/backend
Environment="MONGO_URL=mongodb://localhost:27017"
Environment="DB_NAME=ordermate_prod"
Environment="JWT_SECRET=buraya_uzun_ve_guclu_bir_anahtar_yazin"
ExecStart=/opt/ordermate/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

Servisi etkinleştirin:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ordermate-backend
sudo systemctl start ordermate-backend
sudo systemctl status ordermate-backend
```

### 7.6. Frontend’i Nginx ile yayınlama (özet)

1. Nginx kurun:
   ```bash
   sudo apt install -y nginx
   ```

2. Build klasörünü Nginx’in kök dizinine kopyalayın (örnek):
   ```bash
   sudo mkdir -p /var/www/ordermate
   sudo cp -r /opt/ordermate/frontend/build/* /var/www/ordermate/
   ```

3. Nginx site tanımı (ör: `/etc/nginx/sites-available/ordermate`):

   ```nginx
   server {
       listen 80;
       server_name sizin-domaininiz.com;

       # Frontend (React build)
       root /var/www/ordermate;
       index index.html;

       location / {
           try_files $uri /index.html;
       }

       # Backend API proxy
       location /api {
           proxy_pass http://127.0.0.1:8001/api;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. Siteyi etkinleştirin:

   ```bash
   sudo ln -s /etc/nginx/sites-available/ordermate /etc/nginx/sites-enabled/ordermate
   sudo nginx -t
   sudo systemctl reload nginx
   ```

Bu kurulumla:
- Tarayıcıdan `http://sizin-domaininiz.com` → React arayüzü gelir.
- Frontend, `.env`’de tanımlı `REACT_APP_BACKEND_URL` üzerinden (ör. `https://sizin-domaininiz.com`) `/api` isteklerini Nginx aracılığıyla backend’e iletir.

---

## 8. Yaygın Hatalar ve Çözüm Önerileri

### 8.1. Frontend açılıyor ama veri gelmiyor

- Tarayıcı konsolunda `Network` sekmesinde `/api/...` isteklerine bakın.
- Genelde sebepler:
  - `REACT_APP_BACKEND_URL` yanlış (örneğin port farklı).
  - Backend çalışmıyor veya firewall engelliyor.

**Kontrol:**
```bash
# Backend API canlı mı?
curl http://localhost:8001/api/health  # (Varsa health endpoint’i)
```

### 8.2. "Invalid username or password" hatası

- Yanlış kullanıcı adı / şifre kombinasyonu.
- Varsayılan admin hesabı genelde:
  - `admin / admin123`
- Eğer bu hesap yoksa, MongoDB’de `users` koleksiyonuna yeni bir admin kullanıcı eklemeniz veya backend’in sağladığı kullanıcı oluşturma ekranını kullanmanız gerekebilir.

### 8.3. 422 Validation Error (Sipariş güncelleme / oluşturma)

- Backend’te sıkı doğrulamalar var:
  - Tüm siparişlerde **e-posta zorunlu**.
  - `showroom_satis` siparişlerinde **VKN/TC zorunlu**.
  - VKN 10 hane, TC 11 hane olmak zorunda.
  - VKN varsa **Firma Unvanı** zorunlu.
- Hata mesajları artık Türkçe ve detaylı biçimde ekranda görünür; gelen metne göre eksik alanı doldurun.

---

## 9. Son Notlar

- `.env` dosyalarındaki değerleri production’da **çok dikkatli** yönetin; özellikle `JWT_SECRET` ve `MONGO_URL` hassastır.
- Frontend yeni backend adresine taşınırsa, mutlaka `REACT_APP_BACKEND_URL` güncellenip **`yarn build`** tekrar alınmalıdır.
- Yeni özellik eklerken:
  - Backend için yeni endpoint’ler mutlaka `/api` ile başlamalıdır.
  - MongoDB’den dönen kayıtlarda `_id` alanı response’a dahil edilmemelidir.

Bu kılavuzdaki adımları takip ederek sistemi hem **lokalde geliştirme** hem de **basit bir production sunucusunda** sorunsuz şekilde çalıştırabilirsiniz. Herhangi bir adımda takılmanız halinde, takıldığınız komut / hata mesajı ile birlikte yazarsanız, ona özel ek yönlendirme yapabilirim.

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, model_validator
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import csv
import io
import base64
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from fastapi.responses import StreamingResponse

# Register UTF-8 font for Turkish characters
try:
    pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    FONT_NAME = 'DejaVuSans'
    FONT_NAME_BOLD = 'DejaVuSans-Bold'
except:
    # Fallback to Helvetica if DejaVu not available
    FONT_NAME = 'Helvetica'
    FONT_NAME_BOLD = 'Helvetica-Bold'

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserRole:
    SHOWROOM = "showroom"
    CORPORATE_SALES = "corporate_sales"
    WAREHOUSE = "warehouse"
    FINANCE = "finance"
    ACCOUNTING = "accounting"
    ADMIN = "admin"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: Optional[EmailStr] = None
    full_name: str
    role: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[EmailStr] = None
    full_name: str
    role: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: Optional[int] = None
    web_service_code: Optional[str] = None
    product_name: str
    supplier_product_code: Optional[str] = None
    barcode: Optional[str] = None
    stock: int = 0
    stock_unit: Optional[str] = None
    is_active: bool = True
    brand: Optional[str] = None
    supplier: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    product_id: Optional[int] = None
    web_service_code: Optional[str] = None
    product_name: str
    supplier_product_code: Optional[str] = None
    barcode: Optional[str] = None
    stock: int = 0
    stock_unit: Optional[str] = None
    is_active: bool = True
    brand: Optional[str] = None
    supplier: Optional[str] = None

class OrderType:
    SHOWROOM = "showroom_satis"
    CORPORATE = "cari_kurumsal"
    INCOMPLETE = "eksik_bilgili"

class OrderStatus:
    WAITING_INFO = "bilgi_bekliyor"
    IN_PROGRESS = "islemde"
    READY = "hazir"
    COMPLETED = "tamamlandi"

class InvoiceStatus:
    NOT_ISSUED = "kesilmedi"
    ISSUED = "kesildi"

class CargoStatus:
    NONE = "yok"
    PREPARING = "hazirlaniyor"
    IN_CARGO = "kargoda"
    DELIVERED = "teslim"

class DeliveryMethod:
    CARGO = "kargo"
    HAND = "elden"

# Waybill (İrsaliye) Status
class WaybillStatus:
    NOT_ISSUED = "kesilmedi"
    ISSUED = "kesildi"

# Order History Entry
class OrderHistoryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str  # status_change, note_added, item_added, item_removed, edited, waybill_issued, invoice_issued
    description: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    user_id: str
    user_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: int  # Sayısal numara (dahili)
    order_code: str = ""  # Görüntülenen kod (SÇ201226000001)
    order_type: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    tax_id_type: str = "vkn"  # 'vkn' veya 'tc'
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    company_name: Optional[str] = None  # VKN'ye kayıtlı firma/kurum adı
    # Kurumsal siparişler için ayrı adres bilgileri
    billing_address: Optional[Dict[str, Any]] = None  # Fatura adresi
    shipping_address: Optional[Dict[str, Any]] = None  # Kargo/Teslimat adresi
    same_address: bool = True  # Fatura ve teslimat adresi aynı mı?
    created_by: str  # user id
    created_by_name: str
    delivery_method: Optional[str] = None
    invoice_status: str = InvoiceStatus.NOT_ISSUED
    invoice_number: Optional[str] = None  # Fatura No (Fatura kesildi ise)
    waybill_status: str = WaybillStatus.NOT_ISSUED  # İrsaliye durumu
    cargo_status: str = CargoStatus.NONE
    cargo_company: Optional[str] = None  # Yurtiçi, MNG, Aras, PTT, etc.
    cargo_tracking_code: Optional[str] = None
    general_status: str = OrderStatus.WAITING_INFO
    # Ödeme ve Teslimat Durumları
    pos_payment: bool = False  # POS cihazından çekildi
    delivered_invoice_only: bool = False  # Teslim edildi sadece fatura
    site_payment: bool = False  # Siteden ödeme yapıldı
    online_payment_ref: Optional[str] = None  # Site ödemesi işlem numarası
    whatsapp_content: Optional[str] = None
    attachments: List[str] = []  # file URLs or base64
    notes: Optional[str] = None
    history: List[OrderHistoryEntry] = []  # Sipariş geçmişi
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShippingAddress(BaseModel):
    """Kargo/Teslimat adresi bilgileri"""
    recipient_name: str  # Alıcı Adı - Zorunlu
    recipient_phone: str  # Alıcı Telefon - Zorunlu
    address: str  # Adres - Zorunlu
    city: Optional[str] = None  # İl
    district: Optional[str] = None  # İlçe
    postal_code: Optional[str] = None  # Posta Kodu

class BillingAddress(BaseModel):
    """Fatura adresi bilgileri"""
    address: str  # Adres
    city: Optional[str] = None  # İl
    district: Optional[str] = None  # İlçe
    postal_code: Optional[str] = None  # Posta Kodu

class OrderCreate(BaseModel):
    order_type: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    tax_id_type: str = "vkn"  # 'vkn' veya 'tc'
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    company_name: Optional[str] = None  # VKN'ye kayıtlı firma/kurum adı
    # Kurumsal siparişler için ayrı adres bilgileri
    billing_address: Optional[BillingAddress] = None  # Fatura adresi
    shipping_address: Optional[ShippingAddress] = None  # Kargo/Teslimat adresi
    same_address: bool = True  # Fatura ve teslimat adresi aynı mı?
    delivery_method: Optional[str] = None
    invoice_status: str = InvoiceStatus.NOT_ISSUED
    invoice_number: Optional[str] = None  # Fatura No
    waybill_status: str = WaybillStatus.NOT_ISSUED
    cargo_status: str = CargoStatus.NONE
    cargo_company: Optional[str] = None
    cargo_tracking_code: Optional[str] = None
    general_status: str = OrderStatus.WAITING_INFO
    # Ödeme ve Teslimat Durumları
    pos_payment: bool = False  # POS cihazından çekildi
    delivered_invoice_only: bool = False  # Teslim edildi sadece fatura
    site_payment: bool = False  # Siteden ödeme yapıldı
    online_payment_ref: Optional[str] = None  # Site ödemesi işlem numarası (CRxxxxxx)
    whatsapp_content: Optional[str] = None
    notes: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_tax_and_email(self):
        tax_number = self.tax_number
        tax_id_type = self.tax_id_type
        order_type = self.order_type
        
        # Tüm siparişlerde e-posta zorunlu (fatura e-posta ile gönderilecek)
        if not self.customer_email:
            raise ValueError('E-posta adresi zorunludur (fatura gönderimi için)')
        
        # Showroom satış için VKN/TC zorunlu
        if order_type == 'showroom_satis':
            if not tax_number:
                raise ValueError('VKN veya TC Kimlik No zorunludur')
        
        if not tax_number:
            return self  # Diğer sipariş türleri için VKN/TC zorunlu değil
        
        # Sadece rakam kontrolü
        if not tax_number.isdigit():
            raise ValueError('VKN/TC sadece rakam içermelidir')
        
        if tax_id_type == 'vkn':
            if len(tax_number) != 10:
                raise ValueError('VKN 10 karakter olmalıdır')
            # VKN dolu ise firma unvanı gerekli
            if not self.company_name:
                raise ValueError('VKN girildiğinde Firma Unvanı zorunludur')
        elif tax_id_type == 'tc':
            if len(tax_number) != 11:
                raise ValueError('TC Kimlik No 11 karakter olmalıdır')
            if tax_number[0] == '0':
                raise ValueError('TC Kimlik No 0 ile başlayamaz')
            if int(tax_number[10]) % 2 != 0:
                raise ValueError('TC Kimlik No son hanesi çift rakam olmalıdır')
        
        return self

class ItemStatus:
    TO_BE_CONFIRMED = "netlesecek"
    IN_STOCK = "stokta"
    TO_BE_PROCURED = "temin_edilecek"
    IN_PRODUCTION = "uretimde"
    READY = "hazir"
    SENT = "gonderildi"
    CANCELLED = "iptal"

class ItemType:
    CATALOG = "katalog_urunu"
    MANUAL = "manuel"
    SERVICE = "hizmet"

class OrderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    unit_price: float = 0.0
    total_price: float = 0.0
    item_type: str = ItemType.CATALOG
    item_status: str = ItemStatus.TO_BE_CONFIRMED
    notes: Optional[str] = None
    supplier_info: Optional[str] = None
    estimated_ready_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderItemCreate(BaseModel):
    order_id: str
    product_id: Optional[str] = None
    product_name: str
    quantity: int
    unit_price: float = 0.0
    total_price: float = 0.0
    item_type: str = ItemType.CATALOG
    item_status: str = ItemStatus.TO_BE_CONFIRMED
    notes: Optional[str] = None
    supplier_info: Optional[str] = None
    estimated_ready_date: Optional[str] = None

class OrderWithItems(BaseModel):
    order: Order
    items: List[OrderItem] = []

# Settings Models
class OrderTypeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True
    order: int = 0

# Bank Account Model
class BankAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bank_name: str
    account_holder: str
    iban: str
    branch_code: Optional[str] = None
    account_number: Optional[str] = None
    currency: str = "TRY"
    is_active: bool = True

class BankAccountCreate(BaseModel):
    bank_name: str
    account_holder: str
    iban: str
    branch_code: Optional[str] = None
    account_number: Optional[str] = None
    currency: str = "TRY"
    is_active: bool = True

# PDF Template Settings
class PDFTemplateSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: "pdf_template_settings")
    title: str = "TEKLİF"
    company_name: str = "OrderMate"
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_tax_number: Optional[str] = None
    company_tax_office: Optional[str] = None
    company_website: Optional[str] = None
    logo_base64: Optional[str] = None  # Base64 encoded logo image
    header_color: str = "#000000"
    show_prices: bool = True
    show_customer_info: bool = True
    show_bank_accounts: bool = True
    footer_text: str = "OrderMate - Sipariş Takip Sistemi"
    notes: Optional[str] = None
    validity_days: int = 30  # Teklif geçerlilik süresi
    payment_terms: Optional[str] = None  # Ödeme koşulları
    delivery_terms: Optional[str] = None  # Teslimat koşulları
    bank_accounts: List[BankAccount] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PDFTemplateUpdate(BaseModel):
    title: Optional[str] = "TEKLİF"
    company_name: Optional[str] = "OrderMate"
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_tax_number: Optional[str] = None
    company_tax_office: Optional[str] = None
    company_website: Optional[str] = None
    logo_base64: Optional[str] = None
    header_color: Optional[str] = "#000000"
    show_prices: Optional[bool] = True
    show_customer_info: Optional[bool] = True
    show_bank_accounts: Optional[bool] = True
    footer_text: Optional[str] = "OrderMate - Sipariş Takip Sistemi"
    notes: Optional[str] = None
    validity_days: Optional[int] = 30
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None

# ==================== AUTH UTILITIES ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hashed_password
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    return user

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc.get('password', '')):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not user_doc.get('is_active', False):
        raise HTTPException(status_code=403, detail="User account is inactive")
    
    # Convert ISO string to datetime
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== USER ENDPOINTS ====================

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTING]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user['created_at'], str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update users")
    
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {
        "username": user_data.username,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "role": user_data.role
    }
    
    # Update password if provided
    if user_data.password:
        update_data['password'] = hash_password(user_data.password)
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return User(**updated)

@api_router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can toggle user status")
    
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not existing.get('is_active', True)
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    
    return {"message": f"User {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete users")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if search:
        query['$or'] = [
            {"product_name": {"$regex": search, "$options": "i"}},
            {"web_service_code": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
            {"supplier_product_code": {"$regex": search, "$options": "i"}}
        ]
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for product in products:
        if isinstance(product.get('created_at'), str):
            product['created_at'] = datetime.fromisoformat(product['created_at'])
    return products

# IMPORTANT: Static routes MUST come before dynamic {product_id} routes
class BulkDeleteRequest(BaseModel):
    ids: List[str]

@api_router.post("/products/bulk-delete")
async def bulk_delete_products(request: BulkDeleteRequest, current_user: User = Depends(get_current_user)):
    """Delete multiple products at once"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can bulk delete products")
    
    if not request.ids:
        raise HTTPException(status_code=400, detail="No product IDs provided")
    
    result = await db.products.delete_many({"id": {"$in": request.ids}})
    
    return {
        "message": f"{result.deleted_count} ürün silindi",
        "deleted_count": result.deleted_count
    }

@api_router.delete("/products/delete-all")
async def delete_all_products(current_user: User = Depends(get_current_user)):
    """Delete all products - USE WITH CAUTION"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete all products")
    
    result = await db.products.delete_many({})
    
    return {
        "message": f"Tüm ürünler silindi ({result.deleted_count} adet)",
        "deleted_count": result.deleted_count
    }

# Dynamic routes with {product_id} parameter - MUST come after static routes
@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return Product(**product)

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_data.model_dump()
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Product(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

# ==================== SETTINGS / ORDER TYPES ====================

@api_router.get("/settings/order-types", response_model=List[OrderTypeModel])
async def get_order_types(current_user: User = Depends(get_current_user)):
    order_types = await db.order_types.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    for ot in order_types:
        if isinstance(ot.get('created_at'), str):
            ot['created_at'] = datetime.fromisoformat(ot['created_at'])
    return order_types

@api_router.post("/settings/order-types", response_model=OrderTypeModel)
async def create_order_type(order_type_data: OrderTypeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage order types")
    
    # Check if code already exists
    existing = await db.order_types.find_one({"code": order_type_data.code}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Order type code already exists")
    
    order_type = OrderTypeModel(**order_type_data.model_dump())
    doc = order_type.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.order_types.insert_one(doc)
    return order_type

@api_router.put("/settings/order-types/{order_type_id}", response_model=OrderTypeModel)
async def update_order_type(order_type_id: str, order_type_data: OrderTypeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage order types")
    
    existing = await db.order_types.find_one({"id": order_type_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order type not found")
    
    update_data = order_type_data.model_dump()
    await db.order_types.update_one({"id": order_type_id}, {"$set": update_data})
    
    updated = await db.order_types.find_one({"id": order_type_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return OrderTypeModel(**updated)

@api_router.delete("/settings/order-types/{order_type_id}")
async def delete_order_type(order_type_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage order types")
    
    result = await db.order_types.delete_one({"id": order_type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order type not found")
    return {"message": "Order type deleted successfully"}

# ==================== MANUAL PRODUCT CREATION ====================

async def get_next_kodsuz_code() -> str:
    """Generate next KodsuzA#### code"""
    # Find the highest kodsuz code
    result = await db.products.find(
        {"web_service_code": {"$regex": "^KodsuzA"}},
        {"_id": 0, "web_service_code": 1}
    ).sort("web_service_code", -1).limit(1).to_list(1)
    
    if result:
        last_code = result[0]['web_service_code']
        # Extract number from KodsuzA0001
        number = int(last_code.replace('KodsuzA', ''))
        next_number = number + 1
    else:
        next_number = 1
    
    return f"KodsuzA{next_number:04d}"

class ManualProductCreate(BaseModel):
    product_name: str

@api_router.post("/products/create-manual", response_model=Product)
async def create_manual_product(data: ManualProductCreate, current_user: User = Depends(get_current_user)):
    """Create a manual product with auto-generated KodsuzA code"""
    kodsuz_code = await get_next_kodsuz_code()
    
    product = Product(
        product_name=data.product_name,
        web_service_code=kodsuz_code,
        stock=0,
        stock_unit="Adet",
        is_active=True
    )
    
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    
    return product

# ==================== PDF GENERATION ====================

@api_router.get("/settings/pdf-template", response_model=PDFTemplateSettings)
async def get_pdf_template(current_user: User = Depends(get_current_user)):
    """Get PDF template settings"""
    template = await db.pdf_settings.find_one({"id": "pdf_template_settings"}, {"_id": 0})
    if not template:
        # Return default settings
        return PDFTemplateSettings()
    
    if isinstance(template.get('updated_at'), str):
        template['updated_at'] = datetime.fromisoformat(template['updated_at'])
    return PDFTemplateSettings(**template)

@api_router.put("/settings/pdf-template", response_model=PDFTemplateSettings)
async def update_pdf_template(settings: PDFTemplateUpdate, current_user: User = Depends(get_current_user)):
    """Update PDF template settings"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update PDF template")
    
    # Check if exists
    existing = await db.pdf_settings.find_one({"id": "pdf_template_settings"}, {"_id": 0})
    
    update_data = settings.model_dump(exclude_none=True)
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.pdf_settings.update_one(
            {"id": "pdf_template_settings"},
            {"$set": update_data}
        )
    else:
        template = PDFTemplateSettings(**update_data)
        doc = template.model_dump()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.pdf_settings.insert_one(doc)
    
    updated = await db.pdf_settings.find_one({"id": "pdf_template_settings"}, {"_id": 0})
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return PDFTemplateSettings(**updated)

@api_router.get("/orders/{order_id}/pdf")
async def generate_order_pdf(order_id: str, current_user: User = Depends(get_current_user)):
    """Generate professional PDF quote for order with Turkish character support"""
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    
    # Get order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get order items
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(1000)
    
    # Get PDF template settings
    template_doc = await db.pdf_settings.find_one({"id": "pdf_template_settings"}, {"_id": 0})
    if template_doc:
        if isinstance(template_doc.get('updated_at'), str):
            template_doc['updated_at'] = datetime.fromisoformat(template_doc['updated_at'])
        # Handle bank_accounts if it's a list of dicts
        if 'bank_accounts' in template_doc and isinstance(template_doc['bank_accounts'], list):
            template_doc['bank_accounts'] = [BankAccount(**ba) if isinstance(ba, dict) else ba for ba in template_doc['bank_accounts']]
        template = PDFTemplateSettings(**template_doc)
    else:
        template = PDFTemplateSettings()
    
    # Get bank accounts from settings
    bank_accounts_docs = await db.bank_accounts.find({"is_active": True}, {"_id": 0}).to_list(100)
    bank_accounts = [BankAccount(**ba) for ba in bank_accounts_docs] if bank_accounts_docs else []
    
    # Create PDF in memory
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # ==================== HEADER SECTION ====================
    y_position = height - 1.5*cm
    
    # Draw Logo if exists
    logo_height = 0
    if template.logo_base64:
        try:
            from reportlab.lib.utils import ImageReader
            logo_data = base64.b64decode(template.logo_base64)
            logo_image = ImageReader(io.BytesIO(logo_data))
            logo_width_px = 120
            logo_height_px = 60
            pdf.drawImage(logo_image, 2*cm, y_position - logo_height_px + 15, width=logo_width_px, height=logo_height_px, preserveAspectRatio=True, mask='auto')
            logo_height = logo_height_px
        except Exception as e:
            logger.error(f"Logo render error: {e}")
    
    # Company Info (right side - top)
    pdf.setFont(FONT_NAME_BOLD, 14)
    company_x = width - 2*cm
    y_company = height - 1.5*cm
    
    if template.company_name:
        pdf.drawRightString(company_x, y_company, template.company_name)
        y_company -= 0.5*cm
    
    pdf.setFont(FONT_NAME, 9)
    if template.company_address:
        # Split address if too long
        address_lines = template.company_address.split('\n') if '\n' in template.company_address else [template.company_address]
        for line in address_lines:
            pdf.drawRightString(company_x, y_company, line.strip())
            y_company -= 0.4*cm
    
    if template.company_phone:
        pdf.drawRightString(company_x, y_company, f"Tel: {template.company_phone}")
        y_company -= 0.4*cm
    
    if template.company_email:
        pdf.drawRightString(company_x, y_company, f"E-posta: {template.company_email}")
        y_company -= 0.4*cm
    
    if template.company_website:
        pdf.drawRightString(company_x, y_company, template.company_website)
        y_company -= 0.4*cm
    
    if template.company_tax_office and template.company_tax_number:
        pdf.drawRightString(company_x, y_company, f"V.D: {template.company_tax_office} / {template.company_tax_number}")
        y_company -= 0.4*cm
    
    # ==================== TITLE SECTION ====================
    y_position = height - 4.5*cm
    
    # Title with underline
    pdf.setFont(FONT_NAME_BOLD, 18)
    title_width = pdf.stringWidth(template.title, FONT_NAME_BOLD, 18)
    title_x = (width - title_width) / 2
    pdf.drawString(title_x, y_position, template.title)
    
    # Underline
    pdf.setStrokeColor(colors.HexColor("#333333"))
    pdf.setLineWidth(1)
    pdf.line(title_x - 10, y_position - 5, title_x + title_width + 10, y_position - 5)
    
    # ==================== DOCUMENT INFO ====================
    y_position -= 1.5*cm
    
    # Info box background
    pdf.setFillColor(colors.HexColor("#f8f9fa"))
    pdf.rect(2*cm, y_position - 1.2*cm, width - 4*cm, 1.5*cm, fill=True, stroke=False)
    pdf.setFillColor(colors.black)
    
    pdf.setFont(FONT_NAME, 10)
    created_date = datetime.fromisoformat(order['created_at']).strftime('%d.%m.%Y')
    validity_date = (datetime.fromisoformat(order['created_at']) + timedelta(days=template.validity_days)).strftime('%d.%m.%Y')
    
    pdf.drawString(2.5*cm, y_position - 0.3*cm, f"Teklif No: {order['order_number']}")
    pdf.drawString(2.5*cm, y_position - 0.8*cm, f"Tarih: {created_date}")
    pdf.drawRightString(width - 2.5*cm, y_position - 0.3*cm, f"Geçerlilik: {template.validity_days} gün")
    pdf.drawRightString(width - 2.5*cm, y_position - 0.8*cm, f"Son Geçerlilik: {validity_date}")
    
    # ==================== CUSTOMER INFO ====================
    y_position -= 2.5*cm
    
    if template.show_customer_info and order.get('customer_name'):
        pdf.setFont(FONT_NAME_BOLD, 11)
        pdf.drawString(2*cm, y_position, "MÜŞTERİ BİLGİLERİ")
        y_position -= 0.5*cm
        
        pdf.setStrokeColor(colors.HexColor("#dee2e6"))
        pdf.setLineWidth(0.5)
        pdf.line(2*cm, y_position, width - 2*cm, y_position)
        y_position -= 0.5*cm
        
        pdf.setFont(FONT_NAME, 10)
        if order.get('customer_name'):
            pdf.drawString(2*cm, y_position, f"Firma/Müşteri: {order['customer_name']}")
            y_position -= 0.45*cm
        
        if order.get('customer_phone'):
            pdf.drawString(2*cm, y_position, f"Telefon: {order['customer_phone']}")
            y_position -= 0.45*cm
        
        if order.get('customer_email'):
            pdf.drawString(2*cm, y_position, f"E-posta: {order['customer_email']}")
            y_position -= 0.45*cm
        
        if order.get('customer_address'):
            pdf.drawString(2*cm, y_position, f"Adres: {order['customer_address']}")
            y_position -= 0.45*cm
        
        if order.get('tax_office') or order.get('tax_number'):
            tax_info = []
            if order.get('tax_office'):
                tax_info.append(f"V.D: {order['tax_office']}")
            if order.get('tax_number'):
                tax_info.append(f"V.No: {order['tax_number']}")
            pdf.drawString(2*cm, y_position, " / ".join(tax_info))
            y_position -= 0.45*cm
    
    # ==================== ITEMS TABLE ====================
    y_position -= 1*cm
    
    pdf.setFont(FONT_NAME_BOLD, 11)
    pdf.drawString(2*cm, y_position, "ÜRÜN/HİZMET DETAYLARI")
    y_position -= 0.5*cm
    
    # Table header
    table_data = []
    if template.show_prices:
        headers = ['S.No', 'Ürün/Hizmet Adı', 'Miktar', 'Birim', 'Birim Fiyat', 'Toplam']
        col_widths = [1*cm, 8*cm, 1.5*cm, 1.5*cm, 2.5*cm, 2.5*cm]
    else:
        headers = ['S.No', 'Ürün/Hizmet Adı', 'Miktar', 'Birim', 'Notlar']
        col_widths = [1*cm, 10*cm, 2*cm, 2*cm, 2*cm]
    
    table_data.append(headers)
    
    # Table rows
    grand_total = 0.0
    for idx, item in enumerate(items, 1):
        unit_price = item.get('unit_price', 0) or 0
        quantity = item.get('quantity', 0) or 0
        total = item.get('total_price', 0) or (quantity * unit_price)
        grand_total += total
        
        if template.show_prices:
            row = [
                str(idx),
                item['product_name'][:60],
                str(quantity),
                'Adet',
                f"{unit_price:,.2f} ₺",
                f"{total:,.2f} ₺"
            ]
        else:
            row = [
                str(idx),
                item['product_name'][:60],
                str(quantity),
                'Adet',
                item.get('notes', '')[:20] if item.get('notes') else ''
            ]
        table_data.append(row)
    
    # Create table
    table = Table(table_data, colWidths=col_widths)
    
    table_style = TableStyle([
        # Header style
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#343a40")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), FONT_NAME_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Body style
        ('FONTNAME', (0, 1), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # S.No centered
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),  # Quantity centered
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),  # Unit centered
        ('ALIGN', (-2, 1), (-1, -1), 'RIGHT'),  # Prices right aligned
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f9fa")]),
    ])
    table.setStyle(table_style)
    
    # Calculate table height and draw
    table_width, table_height = table.wrap(0, 0)
    
    # Check if table fits on page
    if y_position - table_height < 5*cm:
        pdf.showPage()
        y_position = height - 2*cm
    
    table.drawOn(pdf, 2*cm, y_position - table_height)
    y_position -= (table_height + 0.5*cm)
    
    # ==================== TOTALS SECTION ====================
    if template.show_prices:
        # Totals box
        totals_x = width - 7*cm
        
        pdf.setFont(FONT_NAME_BOLD, 10)
        pdf.setFillColor(colors.HexColor("#343a40"))
        pdf.rect(totals_x, y_position - 1*cm, 5*cm, 1*cm, fill=True, stroke=False)
        pdf.setFillColor(colors.white)
        pdf.drawString(totals_x + 0.3*cm, y_position - 0.65*cm, "GENEL TOPLAM:")
        pdf.drawRightString(totals_x + 4.7*cm, y_position - 0.65*cm, f"{grand_total:,.2f} ₺")
        pdf.setFillColor(colors.black)
        
        y_position -= 1.5*cm
    
    # ==================== TERMS SECTION ====================
    if template.payment_terms or template.delivery_terms:
        y_position -= 0.5*cm
        
        if y_position < 6*cm:
            pdf.showPage()
            y_position = height - 2*cm
        
        pdf.setFont(FONT_NAME_BOLD, 10)
        pdf.drawString(2*cm, y_position, "ŞARTLAR VE KOŞULLAR")
        y_position -= 0.4*cm
        
        pdf.setStrokeColor(colors.HexColor("#dee2e6"))
        pdf.line(2*cm, y_position, width - 2*cm, y_position)
        y_position -= 0.5*cm
        
        pdf.setFont(FONT_NAME, 9)
        
        if template.payment_terms:
            pdf.drawString(2*cm, y_position, f"Ödeme Koşulları: {template.payment_terms}")
            y_position -= 0.45*cm
        
        if template.delivery_terms:
            pdf.drawString(2*cm, y_position, f"Teslimat Koşulları: {template.delivery_terms}")
            y_position -= 0.45*cm
    
    # ==================== BANK ACCOUNTS SECTION ====================
    if template.show_bank_accounts and bank_accounts:
        y_position -= 0.8*cm
        
        if y_position < 5*cm:
            pdf.showPage()
            y_position = height - 2*cm
        
        pdf.setFont(FONT_NAME_BOLD, 10)
        pdf.drawString(2*cm, y_position, "BANKA HESAP BİLGİLERİ")
        y_position -= 0.4*cm
        
        pdf.setStrokeColor(colors.HexColor("#dee2e6"))
        pdf.line(2*cm, y_position, width - 2*cm, y_position)
        y_position -= 0.5*cm
        
        pdf.setFont(FONT_NAME, 9)
        
        for ba in bank_accounts:
            if y_position < 3*cm:
                pdf.showPage()
                y_position = height - 2*cm
            
            pdf.setFont(FONT_NAME_BOLD, 9)
            pdf.drawString(2*cm, y_position, f"{ba.bank_name}")
            y_position -= 0.4*cm
            
            pdf.setFont(FONT_NAME, 9)
            pdf.drawString(2*cm, y_position, f"Hesap Sahibi: {ba.account_holder}")
            y_position -= 0.35*cm
            pdf.drawString(2*cm, y_position, f"IBAN: {ba.iban}")
            y_position -= 0.35*cm
            
            if ba.branch_code or ba.account_number:
                extra_info = []
                if ba.branch_code:
                    extra_info.append(f"Şube: {ba.branch_code}")
                if ba.account_number:
                    extra_info.append(f"Hesap No: {ba.account_number}")
                pdf.drawString(2*cm, y_position, " / ".join(extra_info))
                y_position -= 0.35*cm
            
            y_position -= 0.3*cm
    
    # ==================== NOTES SECTION ====================
    if template.notes:
        y_position -= 0.5*cm
        
        if y_position < 4*cm:
            pdf.showPage()
            y_position = height - 2*cm
        
        pdf.setFont(FONT_NAME_BOLD, 10)
        pdf.drawString(2*cm, y_position, "NOTLAR")
        y_position -= 0.4*cm
        
        pdf.setStrokeColor(colors.HexColor("#dee2e6"))
        pdf.line(2*cm, y_position, width - 2*cm, y_position)
        y_position -= 0.5*cm
        
        pdf.setFont(FONT_NAME, 9)
        # Handle multi-line notes
        notes_lines = template.notes.split('\n')
        for line in notes_lines:
            if y_position < 2.5*cm:
                pdf.showPage()
                y_position = height - 2*cm
            pdf.drawString(2*cm, y_position, line[:100])
            y_position -= 0.4*cm
    
    # ==================== FOOTER ====================
    pdf.setFont(FONT_NAME, 8)
    pdf.setFillColor(colors.HexColor("#6c757d"))
    pdf.drawString(2*cm, 1.5*cm, template.footer_text)
    pdf.drawRightString(width - 2*cm, 1.5*cm, f"Sayfa 1")
    
    # Footer line
    pdf.setStrokeColor(colors.HexColor("#dee2e6"))
    pdf.line(2*cm, 1.8*cm, width - 2*cm, 1.8*cm)
    
    pdf.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=teklif_{order['order_number']}.pdf"
        }
    )

# ==================== BANK ACCOUNT ENDPOINTS ====================

@api_router.get("/settings/bank-accounts", response_model=List[BankAccount])
async def get_bank_accounts(current_user: User = Depends(get_current_user)):
    """Get all bank accounts"""
    accounts = await db.bank_accounts.find({}, {"_id": 0}).to_list(100)
    return accounts

@api_router.post("/settings/bank-accounts", response_model=BankAccount)
async def create_bank_account(account_data: BankAccountCreate, current_user: User = Depends(get_current_user)):
    """Create a new bank account"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage bank accounts")
    
    account = BankAccount(**account_data.model_dump())
    doc = account.model_dump()
    await db.bank_accounts.insert_one(doc)
    return account

@api_router.put("/settings/bank-accounts/{account_id}", response_model=BankAccount)
async def update_bank_account(account_id: str, account_data: BankAccountCreate, current_user: User = Depends(get_current_user)):
    """Update a bank account"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage bank accounts")
    
    existing = await db.bank_accounts.find_one({"id": account_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    update_data = account_data.model_dump()
    await db.bank_accounts.update_one({"id": account_id}, {"$set": update_data})
    
    updated = await db.bank_accounts.find_one({"id": account_id}, {"_id": 0})
    return BankAccount(**updated)

@api_router.delete("/settings/bank-accounts/{account_id}")
async def delete_bank_account(account_id: str, current_user: User = Depends(get_current_user)):
    """Delete a bank account"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can manage bank accounts")
    
    result = await db.bank_accounts.delete_one({"id": account_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"message": "Bank account deleted successfully"}

# ==================== LOGO UPLOAD ENDPOINT ====================

@api_router.post("/settings/upload-logo")
async def upload_logo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload company logo for PDF"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can upload logo")
    
    # Validate file type
    allowed_types = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PNG, JPEG, GIF, WEBP")
    
    # Read and encode to base64
    contents = await file.read()
    
    # Limit file size (max 500KB)
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 500KB allowed")
    
    logo_base64 = base64.b64encode(contents).decode('utf-8')
    
    # Update PDF settings with logo
    existing = await db.pdf_settings.find_one({"id": "pdf_template_settings"}, {"_id": 0})
    
    if existing:
        await db.pdf_settings.update_one(
            {"id": "pdf_template_settings"},
            {"$set": {"logo_base64": logo_base64, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        template = PDFTemplateSettings(logo_base64=logo_base64)
        doc = template.model_dump()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.pdf_settings.insert_one(doc)
    
    return {"message": "Logo uploaded successfully"}

@api_router.post("/products/upload-csv")
async def upload_products_csv(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload products from CSV file. Supports both comma (,) and semicolon (;) delimiters."""
    
    contents = await file.read()
    csv_text = contents.decode('utf-8-sig')  # Handle BOM
    
    # Auto-detect delimiter (semicolon or comma)
    first_line = csv_text.split('\n')[0]
    delimiter = ';' if ';' in first_line else ','
    
    logger.info(f"CSV Upload - Detected delimiter: '{delimiter}'")
    
    csv_reader = csv.DictReader(io.StringIO(csv_text), delimiter=delimiter)
    
    products_added = 0
    products_updated = 0
    errors = []
    
    for row_num, row in enumerate(csv_reader, start=2):  # start=2 because row 1 is header
        try:
            # Map CSV columns (Turkish) to our model - handle both Turkish and non-Turkish column names
            product_name = (
                row.get('Ürün Adı') or 
                row.get('Urun Adi') or 
                row.get('Product Name') or 
                ''
            ).strip()
            
            # Skip rows without product name
            if not product_name:
                continue
            
            # Parse product_id safely
            product_id_raw = row.get('Ürün İd') or row.get('Ürün Id') or row.get('Urun Id') or row.get('Product Id') or ''
            try:
                product_id = int(product_id_raw) if product_id_raw and str(product_id_raw).strip() else None
            except (ValueError, TypeError):
                product_id = None
            
            # Parse stock safely
            stock_raw = row.get('Stok') or row.get('Stock') or '0'
            try:
                stock = int(float(stock_raw)) if stock_raw and str(stock_raw).strip() else 0
            except (ValueError, TypeError):
                stock = 0
            
            product_data = {
                "product_id": product_id,
                "web_service_code": (row.get('Web Servis Kodu') or row.get('Web Service Code') or '').strip(),
                "product_name": product_name,
                "supplier_product_code": (row.get('Tedarikçi Ürün Kodu') or row.get('Tedarikci Urun Kodu') or row.get('Supplier Product Code') or '').strip(),
                "barcode": (row.get('Barkod') or row.get('Barcode') or '').strip(),
                "stock": stock,
                "stock_unit": (row.get('Stok Birimi') or row.get('Stock Unit') or 'Adet').strip(),
                "is_active": str(row.get('Aktif') or row.get('Active') or 'true').lower() in ['true', '1', 'yes', 'evet'],
                "brand": (row.get('Marka') or row.get('Brand') or '').strip(),
                "supplier": (row.get('Tedarikçi') or row.get('Tedarikci') or row.get('Supplier') or '').strip()
            }
            
            # Check if product exists by web_service_code or product_id
            existing = None
            if product_data['web_service_code']:
                existing = await db.products.find_one({"web_service_code": product_data['web_service_code']}, {"_id": 0})
            
            if existing:
                # Update existing
                await db.products.update_one(
                    {"id": existing['id']},
                    {"$set": product_data}
                )
                products_updated += 1
            else:
                # Create new
                product = Product(**product_data)
                doc = product.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                await db.products.insert_one(doc)
                products_added += 1
                
        except Exception as e:
            errors.append(f"Satır {row_num}: {str(e)}")
            logger.error(f"CSV row {row_num} error: {e}")
            continue
    
    result = {
        "message": "CSV yükleme tamamlandı",
        "products_added": products_added,
        "products_updated": products_updated,
        "total": products_added + products_updated
    }
    
    if errors:
        result["errors"] = errors[:10]  # Return first 10 errors only
        result["total_errors"] = len(errors)
    
    logger.info(f"CSV Upload completed: {products_added} added, {products_updated} updated, {len(errors)} errors")
    
    return result

# ==================== ORDER ENDPOINTS ====================

async def get_next_order_number() -> int:
    # Get the highest order number
    result = await db.orders.find_one(
        {},
        {"_id": 0, "order_number": 1},
        sort=[("order_number", -1)]
    )
    return (result['order_number'] if result else 0) + 1

def get_user_prefix(full_name: str) -> str:
    """Kullanıcı ad soyadından kısaltma oluştur (Furkan Kaya -> FK)"""
    if not full_name:
        return "XX"
    
    # Ad ve soyadı ayır
    parts = full_name.strip().split()
    if len(parts) >= 2:
        # İlk ad ve soyadın ilk harfleri
        prefix = (parts[0][0] + parts[-1][0]).upper()
    elif len(parts) == 1:
        # Sadece bir kelime varsa ilk 2 harf
        prefix = parts[0][:2].upper()
    else:
        prefix = "XX"
    
    return prefix

async def get_next_order_code(user_id: str, full_name: str) -> str:
    """Kullanıcı bazlı benzersiz sipariş kodu oluştur
    Format: KAggaayy000001
    KA = Kullanıcı Adı kısaltması (2 harf)
    gg = gün, aa = ay, yy = yıl
    000001 = 6 haneli sıra numarası
    Örnek: SÇ201226000001
    """
    prefix = get_user_prefix(full_name)
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%d%m%y")  # ggaayy formatı
    
    # Bu kullanıcının bugünkü son sipariş numarasını bul
    today_prefix = f"{prefix}{date_str}"
    result = await db.orders.find_one(
        {"order_code": {"$regex": f"^{today_prefix}"}},
        {"_id": 0, "order_code": 1},
        sort=[("order_code", -1)]
    )
    
    if result and result.get('order_code'):
        # Mevcut koddan sıra numarasını çıkar (son 6 hane)
        try:
            current_num = int(result['order_code'][-6:])
            next_num = current_num + 1
        except (IndexError, ValueError):
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{date_str}{next_num:06d}"

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    # Sipariş numarası kullanıcı bazlı oluşturuluyor (Ad Soyaddan kısaltma)
    order_number = await get_next_order_number()
    order_code = await get_next_order_code(current_user.id, current_user.full_name)
    
    order = Order(
        order_number=order_number,
        order_code=order_code,
        created_by=current_user.id,
        created_by_name=current_user.full_name,
        **order_data.model_dump()
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.orders.insert_one(doc)
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(
    order_type: Optional[str] = None,
    status: Optional[str] = None,
    invoice_status: Optional[str] = None,
    waybill_status: Optional[str] = None,
    cargo_status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.SHOWROOM:
        query['order_type'] = OrderType.SHOWROOM
    elif current_user.role == UserRole.CORPORATE_SALES:
        query['$or'] = [
            {"order_type": OrderType.CORPORATE},
            {"created_by": current_user.id}
        ]
    
    if order_type:
        query['order_type'] = order_type
    if status:
        query['general_status'] = status
    if invoice_status:
        query['invoice_status'] = invoice_status
    if waybill_status:
        query['waybill_status'] = waybill_status
    if cargo_status:
        query['cargo_status'] = cargo_status
    if search:
        query['$or'] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"order_number": {"$regex": search, "$options": "i"}}
        ]
    
    orders = await db.orders.find(query, {"_id": 0}).sort("order_number", -1).skip(skip).limit(limit).to_list(limit)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    return orders

@api_router.get("/orders/{order_id}", response_model=OrderWithItems)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    # order_id veya order_code ile arama yap
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        # order_code ile dene
        order = await db.orders.find_one({"order_code": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if isinstance(order.get('updated_at'), str):
        order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    # Get order items - order.id kullan
    actual_order_id = order.get('id')
    items = await db.order_items.find({"order_id": actual_order_id}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    
    return OrderWithItems(order=Order(**order), items=[OrderItem(**item) for item in items])

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    # order_id veya order_code ile arama yap
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        existing = await db.orders.find_one({"order_code": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = order_data.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Track changes in history
    history_entries = existing.get('history', [])
    changes = []
    
    # Check for status changes
    status_fields = {
        'general_status': 'Genel Durum',
        'invoice_status': 'Fatura Durumu',
        'waybill_status': 'İrsaliye Durumu',
        'cargo_status': 'Kargo Durumu'
    }
    
    for field, label in status_fields.items():
        old_val = existing.get(field)
        new_val = update_data.get(field)
        if old_val != new_val:
            changes.append(f"{label}: {old_val} → {new_val}")
            history_entry = {
                "id": str(uuid.uuid4()),
                "action": "status_change",
                "description": f"{label} değiştirildi",
                "old_value": old_val,
                "new_value": new_val,
                "user_id": current_user.id,
                "user_name": current_user.full_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            history_entries.append(history_entry)
    
    # Check for invoice number change
    old_invoice_num = existing.get('invoice_number')
    new_invoice_num = update_data.get('invoice_number')
    if old_invoice_num != new_invoice_num and new_invoice_num:
        history_entry = {
            "id": str(uuid.uuid4()),
            "action": "invoice_number",
            "description": f"Fatura No eklendi: {new_invoice_num}",
            "old_value": old_invoice_num,
            "new_value": new_invoice_num,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        history_entries.append(history_entry)
    
    # Check for payment changes
    payment_fields = {
        'pos_payment': 'POS Cihazından Çekildi',
        'delivered_invoice_only': 'Teslim Edildi Sadece Fatura',
        'site_payment': 'Siteden Ödeme Yapıldı'
    }
    
    for field, label in payment_fields.items():
        old_val = existing.get(field, False)
        new_val = update_data.get(field, False)
        if old_val != new_val:
            status = "işaretlendi" if new_val else "kaldırıldı"
            history_entry = {
                "id": str(uuid.uuid4()),
                "action": "payment_change",
                "description": f"Ödeme Durumu: {label} {status}",
                "old_value": str(old_val),
                "new_value": str(new_val),
                "user_id": current_user.id,
                "user_name": current_user.full_name,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            history_entries.append(history_entry)
    
    # Check for online payment ref change
    old_ref = existing.get('online_payment_ref')
    new_ref = update_data.get('online_payment_ref')
    if old_ref != new_ref and new_ref:
        history_entry = {
            "id": str(uuid.uuid4()),
            "action": "payment_ref",
            "description": f"Site Ödemesi İşlem No: {new_ref}",
            "old_value": old_ref,
            "new_value": new_ref,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        history_entries.append(history_entry)
    
    # Check for other field changes
    editable_fields = ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 
                      'tax_number', 'tax_office', 'delivery_method', 'cargo_company', 
                      'cargo_tracking_code', 'notes', 'order_type']
    
    for field in editable_fields:
        old_val = existing.get(field)
        new_val = update_data.get(field)
        if old_val != new_val:
            changes.append(f"{field}: güncellendi")
    
    # Add general edit history if there were changes
    if changes:
        history_entry = {
            "id": str(uuid.uuid4()),
            "action": "edited",
            "description": "Sipariş düzenlendi: " + ", ".join(changes[:3]) + ("..." if len(changes) > 3 else ""),
            "old_value": None,
            "new_value": None,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        # Only add if not already added a status change
        if not any(c.startswith(('Genel Durum', 'Fatura', 'İrsaliye', 'Kargo')) for c in changes):
            history_entries.append(history_entry)
    
    update_data['history'] = history_entries
    
    # Gerçek order id'yi kullan (order_code ile arama yapılmış olabilir)
    actual_id = existing.get('id')
    await db.orders.update_one({"id": actual_id}, {"$set": update_data})
    
    updated = await db.orders.find_one({"id": actual_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    
    # Parse history entries
    if 'history' in updated:
        for entry in updated['history']:
            if isinstance(entry.get('created_at'), str):
                entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    
    return Order(**updated)

# Sipariş geçmişine not ekleme
class AddHistoryNoteRequest(BaseModel):
    note: str

@api_router.post("/orders/{order_id}/add-note")
async def add_order_note(order_id: str, request: AddHistoryNoteRequest, current_user: User = Depends(get_current_user)):
    """Add a note to order history"""
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        existing = await db.orders.find_one({"order_code": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    actual_id = existing.get('id')
    history_entries = existing.get('history', [])
    history_entry = {
        "id": str(uuid.uuid4()),
        "action": "note_added",
        "description": request.note,
        "old_value": None,
        "new_value": None,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    history_entries.append(history_entry)
    
    await db.orders.update_one(
        {"id": actual_id}, 
        {"$set": {"history": history_entries, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Not eklendi", "entry": history_entry}

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: User = Depends(get_current_user)):
    """Delete an order and its items"""
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        existing = await db.orders.find_one({"order_code": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    actual_id = existing.get('id')
    
    # Sadece admin veya siparişi oluşturan kişi silebilir
    if current_user.role != UserRole.ADMIN and existing.get('created_by') != current_user.id:
        raise HTTPException(status_code=403, detail="Bu siparişi silme yetkiniz yok")
    
    # Sipariş kalemlerini sil
    await db.order_items.delete_many({"order_id": actual_id})
    
    # Siparişi sil
    result = await db.orders.delete_one({"id": actual_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": f"Sipariş #{existing.get('order_code', existing.get('order_number'))} silindi"}

# ==================== ORDER ITEM ENDPOINTS ====================

@api_router.post("/order-items", response_model=OrderItem)
async def create_order_item(item_data: OrderItemCreate, current_user: User = Depends(get_current_user)):
    item = OrderItem(**item_data.model_dump())
    doc = item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.order_items.insert_one(doc)
    return item

@api_router.get("/order-items", response_model=List[OrderItem])
async def get_order_items(
    order_id: Optional[str] = None,
    item_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if order_id:
        query['order_id'] = order_id
    if item_status:
        query['item_status'] = item_status
    
    items = await db.order_items.find(query, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.put("/order-items/{item_id}", response_model=OrderItem)
async def update_order_item(item_id: str, item_data: OrderItemCreate, current_user: User = Depends(get_current_user)):
    existing = await db.order_items.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order item not found")
    
    update_data = item_data.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.order_items.update_one({"id": item_id}, {"$set": update_data})
    
    updated = await db.order_items.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return OrderItem(**updated)

@api_router.delete("/order-items/{item_id}")
async def delete_order_item(item_id: str, current_user: User = Depends(get_current_user)):
    result = await db.order_items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order item not found")
    return {"message": "Order item deleted"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.SHOWROOM:
        query['order_type'] = OrderType.SHOWROOM
    elif current_user.role == UserRole.CORPORATE_SALES:
        query['$or'] = [
            {"order_type": OrderType.CORPORATE},
            {"created_by": current_user.id}
        ]
    
    total_orders = await db.orders.count_documents(query)
    
    waiting_info_query = {**query, "general_status": OrderStatus.WAITING_INFO}
    waiting_info = await db.orders.count_documents(waiting_info_query)
    
    in_progress_query = {**query, "general_status": OrderStatus.IN_PROGRESS}
    in_progress = await db.orders.count_documents(in_progress_query)
    
    ready_query = {**query, "general_status": OrderStatus.READY}
    ready = await db.orders.count_documents(ready_query)
    
    # Pending invoices (for accounting)
    pending_invoices = 0
    if current_user.role in [UserRole.ACCOUNTING, UserRole.FINANCE, UserRole.ADMIN]:
        pending_invoices = await db.orders.count_documents({"invoice_status": InvoiceStatus.NOT_ISSUED})
    
    # Items to procure (for warehouse/finance)
    items_to_procure = 0
    if current_user.role in [UserRole.WAREHOUSE, UserRole.FINANCE, UserRole.ADMIN]:
        items_to_procure = await db.order_items.count_documents({"item_status": ItemStatus.TO_BE_PROCURED})
    
    return {
        "total_orders": total_orders,
        "waiting_info": waiting_info,
        "in_progress": in_progress,
        "ready": ready,
        "pending_invoices": pending_invoices,
        "items_to_procure": items_to_procure
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Initialize default data on startup
@app.on_event("startup")
async def create_default_data():
    # Create default users
    count = await db.users.count_documents({})
    if count == 0:
        default_users = [
            {"username": "admin", "password": "admin123", "full_name": "Admin", "role": UserRole.ADMIN, "email": "admin@ordermate.com"},
            {"username": "showroom", "password": "showroom123", "full_name": "Showroom Çalışanı", "role": UserRole.SHOWROOM, "email": "showroom@ordermate.com"},
            {"username": "furkan", "password": "furkan123", "full_name": "Furkan Karaca", "role": UserRole.CORPORATE_SALES, "email": "furkan@ordermate.com"},
            {"username": "arif", "password": "arif123", "full_name": "Arif Yördem", "role": UserRole.CORPORATE_SALES, "email": "arif@ordermate.com"},
            {"username": "esat", "password": "esat123", "full_name": "Esat", "role": UserRole.WAREHOUSE, "email": "esat@ordermate.com"},
            {"username": "murat", "password": "murat123", "full_name": "Murat Tekin", "role": UserRole.FINANCE, "email": "murat@ordermate.com"},
            {"username": "ozgen", "password": "ozgen123", "full_name": "Özgen", "role": UserRole.ACCOUNTING, "email": "ozgen@ordermate.com"},
        ]
        
        for user_data in default_users:
            password = user_data.pop('password')
            hashed_password = hash_password(password)
            user = User(**user_data)
            doc = user.model_dump()
            doc['password'] = hashed_password
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc)
        
        logger.info("Default users created successfully")
    
    # Create default order types
    order_types_count = await db.order_types.count_documents({})
    if order_types_count == 0:
        default_order_types = [
            {"name": "Teklif Aşaması", "code": "teklif", "description": "Müşteriye teklif hazırlanıyor", "order": 1},
            {"name": "Showroom Satış (Perakende)", "code": "showroom_satis", "description": "Mağazadan perakende satış", "order": 2},
            {"name": "Kurumsal/Cari Hesap", "code": "kurumsal_cari", "description": "Kurumsal cari hesap satışı", "order": 3},
            {"name": "Kurumsal (Peşin Ödeme)", "code": "kurumsal_pesin", "description": "Kurumsal peşin ödemeli satış", "order": 4},
        ]
        
        for ot_data in default_order_types:
            order_type = OrderTypeModel(**ot_data)
            doc = order_type.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.order_types.insert_one(doc)
        
        logger.info("Default order types created successfully")
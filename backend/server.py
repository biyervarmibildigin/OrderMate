from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
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
from fastapi.responses import StreamingResponse

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

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: int
    order_type: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    created_by: str  # user id
    created_by_name: str
    delivery_method: Optional[str] = None
    invoice_status: str = InvoiceStatus.NOT_ISSUED
    cargo_status: str = CargoStatus.NONE
    cargo_company: Optional[str] = None  # Yurtiçi, MNG, Aras, PTT, etc.
    cargo_tracking_code: Optional[str] = None
    general_status: str = OrderStatus.WAITING_INFO
    whatsapp_content: Optional[str] = None
    attachments: List[str] = []  # file URLs or base64
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    order_type: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    tax_number: Optional[str] = None
    tax_office: Optional[str] = None
    delivery_method: Optional[str] = None
    invoice_status: str = InvoiceStatus.NOT_ISSUED
    cargo_status: str = CargoStatus.NONE
    cargo_company: Optional[str] = None
    cargo_tracking_code: Optional[str] = None
    whatsapp_content: Optional[str] = None
    notes: Optional[str] = None

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

@api_router.get("/orders/{order_id}/pdf")
async def generate_order_pdf(order_id: str, current_user: User = Depends(get_current_user)):
    """Generate PDF for order (mainly for teklif)"""
    # Get order
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get order items
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(1000)
    
    # Create PDF in memory
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Title
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(2*cm, height - 2*cm, "TEKLİF")
    
    # Order Info
    pdf.setFont("Helvetica", 10)
    y_position = height - 3*cm
    pdf.drawString(2*cm, y_position, f"Sipariş No: #{order['order_number']}")
    y_position -= 0.5*cm
    pdf.drawString(2*cm, y_position, f"Tarih: {datetime.fromisoformat(order['created_at']).strftime('%d.%m.%Y')}")
    
    if order.get('customer_name'):
        y_position -= 0.5*cm
        pdf.drawString(2*cm, y_position, f"Müşteri: {order['customer_name']}")
    
    if order.get('customer_phone'):
        y_position -= 0.5*cm
        pdf.drawString(2*cm, y_position, f"Telefon: {order['customer_phone']}")
    
    # Items table
    y_position -= 1.5*cm
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(2*cm, y_position, "Ürünler:")
    
    y_position -= 0.8*cm
    pdf.setFont("Helvetica", 9)
    
    # Table headers
    pdf.drawString(2*cm, y_position, "Ürün Adı")
    pdf.drawString(12*cm, y_position, "Adet")
    pdf.drawString(15*cm, y_position, "Durum")
    
    y_position -= 0.3*cm
    pdf.line(2*cm, y_position, width - 2*cm, y_position)
    
    # Table rows
    for item in items:
        y_position -= 0.6*cm
        if y_position < 3*cm:  # New page if needed
            pdf.showPage()
            y_position = height - 3*cm
        
        pdf.drawString(2*cm, y_position, item['product_name'][:60])
        pdf.drawString(12*cm, y_position, str(item['quantity']))
        pdf.drawString(15*cm, y_position, item['item_status'])
    
    # Footer
    y_position -= 2*cm
    if y_position < 3*cm:
        pdf.showPage()
        y_position = height - 3*cm
    
    pdf.setFont("Helvetica-Oblique", 8)
    pdf.drawString(2*cm, 2*cm, "OrderMate - Sipariş Takip Sistemi")
    
    pdf.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=teklif_{order['order_number']}.pdf"
        }
    )

@api_router.post("/products/upload-csv")
async def upload_products_csv(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    # Allow all authenticated users to upload products
    pass
    
    contents = await file.read()
    csv_text = contents.decode('utf-8-sig')  # Handle BOM
    csv_reader = csv.DictReader(io.StringIO(csv_text))
    
    products_added = 0
    products_updated = 0
    
    for row in csv_reader:
        # Map CSV columns (Turkish) to our model
        product_data = {
            "product_id": int(row.get('Ürün İd', row.get('Urun Id', 0))) if row.get('Ürün İd', row.get('Urun Id')) else None,
            "web_service_code": row.get('Web Servis Kodu', ''),
            "product_name": row.get('Ürün Adı', row.get('Urun Adi', '')),
            "supplier_product_code": row.get('Tedarikçi Ürün Kodu', row.get('Tedarikci Urun Kodu', '')),
            "barcode": row.get('Barkod', ''),
            "stock": int(row.get('Stok', 0)) if row.get('Stok') else 0,
            "stock_unit": row.get('Stok Birimi', ''),
            "is_active": row.get('Aktif', '').lower() in ['true', '1', 'yes', 'evet'],
            "brand": row.get('Marka', ''),
            "supplier": row.get('Tedarikçi', row.get('Tedarikci', ''))
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
    
    return {
        "message": "CSV uploaded successfully",
        "products_added": products_added,
        "products_updated": products_updated,
        "total": products_added + products_updated
    }

# ==================== ORDER ENDPOINTS ====================

async def get_next_order_number() -> int:
    # Get the highest order number
    result = await db.orders.find_one(
        {},
        {"_id": 0, "order_number": 1},
        sort=[("order_number", -1)]
    )
    return (result['order_number'] if result else 0) + 1

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    # Auto-assign order type as INCOMPLETE if missing delivery info
    if not order_data.delivery_method or not order_data.customer_name:
        order_data.order_type = OrderType.INCOMPLETE
    
    order_number = await get_next_order_number()
    order = Order(
        order_number=order_number,
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
    cargo_status: Optional[str] = None,
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
    if cargo_status:
        query['cargo_status'] = cargo_status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("order_number", -1).skip(skip).limit(limit).to_list(limit)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    return orders

@api_router.get("/orders/{order_id}", response_model=OrderWithItems)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if isinstance(order.get('updated_at'), str):
        order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    # Get order items
    items = await db.order_items.find({"order_id": order_id}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    
    return OrderWithItems(order=Order(**order), items=[OrderItem(**item) for item in items])

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = order_data.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return Order(**updated)

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
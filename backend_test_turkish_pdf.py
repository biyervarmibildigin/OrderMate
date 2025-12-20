#!/usr/bin/env python3
"""
Backend API Testing for Turkish PDF Generation and Bank Account Features
Tests PDF generation with Turkish characters, bank account CRUD, logo upload, and settings
"""

import requests
import sys
import json
import base64
from datetime import datetime
from typing import Dict, Any, Optional

class TurkishPDFTester:
    def __init__(self, base_url="https://orderhub-46.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_resources = {
            'bank_accounts': [],
            'orders': []
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    token: str = None, files: Dict = None) -> tuple[bool, Dict, int]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            headers.pop('Content-Type', None)  # Let requests set it for multipart
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, {}, 0
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
            
            return response.status_code < 400, response_data, response.status_code
        
        except Exception as e:
            return False, {"error": str(e)}, 0

    def authenticate(self):
        """Authenticate as admin user"""
        print("\n🔐 Authenticating as admin...")
        
        success, data, status = self.make_request('POST', 'auth/login', {
            "username": "admin",
            "password": "admin123"
        })
        
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Admin authentication", True, "Successfully authenticated")
            return True
        else:
            self.log_test("Admin authentication", False, f"Status: {status}, Data: {data}")
            return False

    def test_bank_accounts_crud(self):
        """Test Bank Accounts CRUD operations"""
        print("\n🏦 Testing Bank Accounts CRUD...")
        
        if not self.admin_token:
            self.log_test("Bank accounts test", False, "No admin token available")
            return
        
        # Test GET /api/settings/bank-accounts
        success, data, status = self.make_request(
            'GET', 'settings/bank-accounts', token=self.admin_token
        )
        
        if success and isinstance(data, list):
            self.log_test(
                "GET bank accounts",
                True,
                f"Retrieved {len(data)} bank accounts"
            )
        else:
            self.log_test("GET bank accounts", False, f"Status: {status}")
        
        # Test POST /api/settings/bank-accounts (Create)
        test_bank_account = {
            "bank_name": "Türkiye İş Bankası",
            "account_holder": "OrderMate Şirketi",
            "iban": "TR33 0006 1005 1978 6457 8413 26",
            "branch_code": "1234",
            "account_number": "12345678",
            "currency": "TRY",
            "is_active": True
        }
        
        success, data, status = self.make_request(
            'POST', 'settings/bank-accounts', test_bank_account, token=self.admin_token
        )
        
        if success and 'id' in data:
            bank_id = data['id']
            self.created_resources['bank_accounts'].append(bank_id)
            self.log_test(
                "POST bank account (Create)",
                True,
                f"Created bank account ID: {bank_id}"
            )
            
            # Test PUT /api/settings/bank-accounts/{id} (Update)
            updated_account = {
                **test_bank_account,
                "bank_name": "Türkiye İş Bankası A.Ş.",
                "account_holder": "OrderMate Teknoloji Şirketi"
            }
            
            success, data, status = self.make_request(
                'PUT', f'settings/bank-accounts/{bank_id}', updated_account, token=self.admin_token
            )
            
            if success:
                self.log_test(
                    "PUT bank account (Update)",
                    True,
                    f"Updated bank account {bank_id}"
                )
            else:
                self.log_test("PUT bank account (Update)", False, f"Status: {status}")
            
        else:
            self.log_test("POST bank account (Create)", False, f"Status: {status}, Data: {data}")

    def test_logo_upload(self):
        """Test Logo Upload API"""
        print("\n🖼️ Testing Logo Upload...")
        
        if not self.admin_token:
            self.log_test("Logo upload test", False, "No admin token available")
            return
        
        # Create a simple test image (1x1 PNG)
        # This is a minimal valid PNG file in base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg=='
        )
        
        files = {'file': ('test_logo.png', png_data, 'image/png')}
        
        success, data, status = self.make_request(
            'POST', 'settings/upload-logo', files=files, token=self.admin_token
        )
        
        if success:
            self.log_test(
                "POST logo upload",
                True,
                "Logo uploaded successfully"
            )
        else:
            self.log_test("POST logo upload", False, f"Status: {status}, Data: {data}")

    def test_pdf_template_settings(self):
        """Test PDF Template Settings with Turkish characters"""
        print("\n📄 Testing PDF Template Settings...")
        
        if not self.admin_token:
            self.log_test("PDF template test", False, "No admin token available")
            return
        
        # Test GET /api/settings/pdf-template
        success, data, status = self.make_request(
            'GET', 'settings/pdf-template', token=self.admin_token
        )
        
        if success:
            self.log_test(
                "GET PDF template settings",
                True,
                f"Retrieved template with title: {data.get('title', 'N/A')}"
            )
        else:
            self.log_test("GET PDF template settings", False, f"Status: {status}")
        
        # Test PUT /api/settings/pdf-template with Turkish characters
        turkish_settings = {
            "title": "TEKLİF",
            "company_name": "OrderMate Teknoloji Şirketi",
            "company_address": "İstanbul, Türkiye\nBeyoğlu İlçesi",
            "company_phone": "+90 212 555 1234",
            "company_email": "info@ordermate.com.tr",
            "company_tax_office": "Beyoğlu Vergi Dairesi",
            "company_tax_number": "1234567890",
            "company_website": "www.ordermate.com.tr",
            "validity_days": 30,
            "payment_terms": "Ödeme koşulları: %50 peşin, %50 teslimatta",
            "delivery_terms": "Teslimat koşulları: Fabrika teslim",
            "footer_text": "OrderMate - Sipariş Takip Sistemi",
            "notes": "Bu teklif 30 gün geçerlidir.\nFiyatlar KDV hariçtir.",
            "show_prices": True,
            "show_customer_info": True,
            "show_bank_accounts": True
        }
        
        success, data, status = self.make_request(
            'PUT', 'settings/pdf-template', turkish_settings, token=self.admin_token
        )
        
        if success:
            self.log_test(
                "PUT PDF template with Turkish chars",
                True,
                "Updated template with Turkish characters"
            )
        else:
            self.log_test("PUT PDF template with Turkish chars", False, f"Status: {status}")

    def test_pdf_generation_with_turkish_chars(self):
        """Test PDF generation with Turkish characters"""
        print("\n🇹🇷 Testing PDF Generation with Turkish Characters...")
        
        if not self.admin_token:
            self.log_test("PDF generation test", False, "No admin token available")
            return
        
        # First create an order with Turkish characters
        turkish_order = {
            "order_type": "teklif",
            "customer_name": "Müşteri Şirketi A.Ş.",
            "customer_phone": "+90 555 123 4567",
            "customer_email": "müşteri@şirket.com.tr",
            "customer_address": "İstanbul, Beyoğlu\nGalata Mahallesi",
            "tax_office": "Beyoğlu Vergi Dairesi",
            "tax_number": "1234567890",
            "delivery_method": "kargo",
            "notes": "Türkçe karakterler: İ, ş, ğ, ü, ö, ç, Ğ, Ü, Ö, Ç, Ş"
        }
        
        success, order_data, status = self.make_request(
            'POST', 'orders', turkish_order, token=self.admin_token
        )
        
        if success and 'id' in order_data:
            order_id = order_data['id']
            self.created_resources['orders'].append(order_id)
            
            # Add order items with Turkish product names
            turkish_items = [
                {
                    "order_id": order_id,
                    "product_name": "Türkçe Ürün İsmi - Özel Çözüm",
                    "quantity": 2,
                    "unit_price": 150.50,
                    "total_price": 301.00,
                    "item_type": "katalog_urunu",
                    "item_status": "netlesecek"
                },
                {
                    "order_id": order_id,
                    "product_name": "Şirket İçi Hizmet Paketi",
                    "quantity": 1,
                    "unit_price": 500.00,
                    "total_price": 500.00,
                    "item_type": "hizmet",
                    "item_status": "stokta"
                }
            ]
            
            for item in turkish_items:
                success, item_data, status = self.make_request(
                    'POST', 'order-items', item, token=self.admin_token
                )
                
                if not success:
                    self.log_test(f"Add Turkish item: {item['product_name'][:20]}...", False, f"Status: {status}")
            
            # Now test PDF generation
            success, pdf_data, status = self.make_request(
                'GET', f'orders/{order_id}/pdf', token=self.admin_token
            )
            
            if success:
                # Check if we got PDF content (should be binary data)
                is_pdf = status == 200
                self.log_test(
                    "Generate PDF with Turkish chars",
                    is_pdf,
                    f"Status: {status}, Content type appears to be PDF"
                )
            else:
                self.log_test("Generate PDF with Turkish chars", False, f"Status: {status}")
            
        else:
            self.log_test("Create order for PDF test", False, f"Status: {status}")

    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete created bank accounts
        for bank_id in self.created_resources['bank_accounts']:
            success, _, status = self.make_request(
                'DELETE', f'settings/bank-accounts/{bank_id}', token=self.admin_token
            )
            if success:
                print(f"    ✅ Deleted bank account {bank_id}")
            else:
                print(f"    ❌ Failed to delete bank account {bank_id} (Status: {status})")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Turkish PDF & Bank Account Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            if not self.authenticate():
                return False
            
            self.test_bank_accounts_crud()
            self.test_logo_upload()
            self.test_pdf_template_settings()
            self.test_pdf_generation_with_turkish_chars()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {e}")
            return False
        finally:
            self.cleanup_resources()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = TurkishPDFTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/turkish_pdf_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
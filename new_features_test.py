#!/usr/bin/env python3
"""
Test script for newly added features in WhatsApp Order Tracking System:
1. Dashboard task cards - "Kargo Barkodu Yazdırılmamış" and "Bana Atanan Siparişler"
2. Payment term information display in order details
3. External URL links for manual product items
4. Responsible user assignment functionality
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class NewFeaturesAPITester:
    def __init__(self, base_url="https://msgorder.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.warehouse_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
                    token: str = None) -> tuple[bool, Dict, int]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
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

    def setup_authentication(self):
        """Setup authentication tokens"""
        print("🔐 Setting up authentication...")
        
        # Login as admin
        success, data, status = self.make_request('POST', 'auth/login', {
            "username": "admin",
            "password": "admin123"
        })
        
        if success and 'access_token' in data:
            self.admin_token = data['access_token']
            self.log_test("Admin login", True, "Admin token obtained")
        else:
            self.log_test("Admin login", False, f"Status: {status}")
            return False

        # Login as warehouse user
        success, data, status = self.make_request('POST', 'auth/login', {
            "username": "esat",
            "password": "esat123"
        })
        
        if success and 'access_token' in data:
            self.warehouse_token = data['access_token']
            self.log_test("Warehouse login", True, "Warehouse token obtained")
        else:
            self.log_test("Warehouse login", False, f"Status: {status}")

        return True

    def test_dashboard_new_stats(self):
        """Test new dashboard statistics: cargo_barcode_not_printed and my_assigned_orders"""
        print("\n📊 Testing New Dashboard Stats...")
        
        if not self.admin_token:
            self.log_test("Dashboard stats test", False, "No admin token")
            return

        success, data, status = self.make_request(
            'GET', 'dashboard/stats', token=self.admin_token
        )
        
        if success:
            # Check for new stats fields
            has_cargo_barcode = 'cargo_barcode_not_printed' in data
            has_my_assigned = 'my_assigned_orders' in data
            
            self.log_test(
                "Dashboard has cargo_barcode_not_printed stat",
                has_cargo_barcode,
                f"Value: {data.get('cargo_barcode_not_printed', 'NOT FOUND')}"
            )
            
            self.log_test(
                "Dashboard has my_assigned_orders stat",
                has_my_assigned,
                f"Value: {data.get('my_assigned_orders', 'NOT FOUND')}"
            )
            
            # Test with warehouse user (should see cargo barcode stats)
            if self.warehouse_token:
                success, warehouse_data, status = self.make_request(
                    'GET', 'dashboard/stats', token=self.warehouse_token
                )
                
                if success:
                    warehouse_has_cargo = 'cargo_barcode_not_printed' in warehouse_data
                    self.log_test(
                        "Warehouse user sees cargo barcode stats",
                        warehouse_has_cargo,
                        f"Warehouse cargo stat: {warehouse_data.get('cargo_barcode_not_printed', 'NOT FOUND')}"
                    )
        else:
            self.log_test("Dashboard stats request", False, f"Status: {status}")

    def test_order_filtering_new_params(self):
        """Test new order filtering parameters: my_orders and cargo_barcode_status"""
        print("\n🔍 Testing New Order Filtering...")
        
        if not self.admin_token:
            self.log_test("Order filtering test", False, "No admin token")
            return

        # Test my_orders filter
        success, data, status = self.make_request(
            'GET', 'orders?my_orders=true', token=self.admin_token
        )
        
        if success and isinstance(data, list):
            self.log_test(
                "my_orders filter works",
                True,
                f"Retrieved {len(data)} orders assigned to current user"
            )
        else:
            self.log_test("my_orders filter", False, f"Status: {status}")

        # Test cargo_barcode_status filter
        success, data, status = self.make_request(
            'GET', 'orders?cargo_barcode_status=yazdirilmadi', token=self.admin_token
        )
        
        if success and isinstance(data, list):
            self.log_test(
                "cargo_barcode_status filter works",
                True,
                f"Retrieved {len(data)} orders with unprinted cargo barcodes"
            )
        else:
            self.log_test("cargo_barcode_status filter", False, f"Status: {status}")

    def test_user_assignment_functionality(self):
        """Test responsible user assignment functionality"""
        print("\n👤 Testing User Assignment...")
        
        if not self.admin_token:
            self.log_test("User assignment test", False, "No admin token")
            return

        # Get list of users first
        success, users_data, status = self.make_request(
            'GET', 'users', token=self.admin_token
        )
        
        if not success or not isinstance(users_data, list) or len(users_data) == 0:
            self.log_test("Get users for assignment", False, f"Status: {status}")
            return

        # Find a user to assign
        target_user = None
        for user in users_data:
            if user.get('is_active') and user.get('role') in ['warehouse', 'corporate_sales']:
                target_user = user
                break

        if not target_user:
            self.log_test("Find assignable user", False, "No suitable user found")
            return

        # Create a test order with user assignment
        test_order = {
            "order_type": "showroom_satis",
            "customer_name": f"Test Assignment {datetime.now().strftime('%H%M%S')}",
            "customer_phone": "+90 555 123 4567",
            "customer_email": "assignment@example.com",
            "tax_id_type": "tc",
            "tax_number": "12345678902",
            "tax_office": "Test Vergi Dairesi",
            "delivery_method": "kargo",
            "assigned_user_id": target_user['id'],
            "assigned_user_name": target_user['full_name'],
            "notes": "Test order for user assignment"
        }
        
        success, data, status = self.make_request(
            'POST', 'orders', test_order, token=self.admin_token
        )
        
        if success and 'id' in data:
            order_id = data['id']
            assigned_user_id = data.get('assigned_user_id')
            assigned_user_name = data.get('assigned_user_name')
            
            self.log_test(
                "Create order with user assignment",
                assigned_user_id == target_user['id'],
                f"Assigned to: {assigned_user_name} (ID: {assigned_user_id})"
            )
            
            # Test updating assignment
            update_data = {
                **test_order,
                "assigned_user_id": None,
                "assigned_user_name": None
            }
            
            success, update_response, status = self.make_request(
                'PUT', f'orders/{order_id}', update_data, token=self.admin_token
            )
            
            if success:
                self.log_test(
                    "Update order assignment (unassign)",
                    True,
                    "Successfully unassigned user from order"
                )
            else:
                self.log_test("Update order assignment", False, f"Status: {status}")
                
        else:
            self.log_test("Create order with user assignment", False, f"Status: {status}")

    def test_payment_term_functionality(self):
        """Test payment term information display"""
        print("\n💰 Testing Payment Term Functionality...")
        
        if not self.admin_token:
            self.log_test("Payment term test", False, "No admin token")
            return

        # Create order with payment terms
        test_order = {
            "order_type": "kurumsal_cari",
            "customer_name": f"Test Payment Terms {datetime.now().strftime('%H%M%S')}",
            "customer_phone": "+90 555 123 4567",
            "customer_email": "payment@example.com",
            "tax_id_type": "vkn",
            "tax_number": "1234567890",
            "tax_office": "Test Vergi Dairesi",
            "company_name": "Test Payment Company",
            "delivery_method": "kargo",
            "payment_term_days": 30,
            "payment_start_at": datetime.now().isoformat(),
            "notes": "Test order with payment terms"
        }
        
        success, data, status = self.make_request(
            'POST', 'orders', test_order, token=self.admin_token
        )
        
        if success and 'id' in data:
            order_id = data['id']
            payment_term_days = data.get('payment_term_days')
            payment_start_at = data.get('payment_start_at')
            
            self.log_test(
                "Create order with payment terms",
                payment_term_days == 30,
                f"Payment term: {payment_term_days} days, Start: {payment_start_at}"
            )
            
            # Get order details to verify payment term display
            success, order_data, status = self.make_request(
                'GET', f'orders/{order_id}', token=self.admin_token
            )
            
            if success and 'order' in order_data:
                order = order_data['order']
                has_payment_term = order.get('payment_term_days') is not None
                has_start_date = order.get('payment_start_at') is not None
                
                self.log_test(
                    "Order details include payment terms",
                    has_payment_term and has_start_date,
                    f"Payment term days: {order.get('payment_term_days')}, Start date: {order.get('payment_start_at')}"
                )
            else:
                self.log_test("Get order with payment terms", False, f"Status: {status}")
        else:
            self.log_test("Create order with payment terms", False, f"Status: {status}")

    def test_external_url_functionality(self):
        """Test external URL links for manual product items"""
        print("\n🔗 Testing External URL Functionality...")
        
        if not self.admin_token:
            self.log_test("External URL test", False, "No admin token")
            return

        # First create an order to add items to
        test_order = {
            "order_type": "showroom_satis",
            "customer_name": f"Test External URL {datetime.now().strftime('%H%M%S')}",
            "customer_phone": "+90 555 123 4567",
            "customer_email": "external@example.com",
            "tax_id_type": "tc",
            "tax_number": "12345678902",
            "tax_office": "Test Vergi Dairesi",
            "delivery_method": "kargo",
            "notes": "Test order for external URL items"
        }
        
        success, order_data, status = self.make_request(
            'POST', 'orders', test_order, token=self.admin_token
        )
        
        if not success or 'id' not in order_data:
            self.log_test("Create order for external URL test", False, f"Status: {status}")
            return

        order_id = order_data['id']

        # Add manual item with external URL
        test_item = {
            "order_id": order_id,
            "product_name": "Test Manual Product with URL",
            "quantity": 1,
            "unit_price": 100.0,
            "total_price": 100.0,
            "item_type": "manuel_urun",
            "item_status": "netlesecek",
            "external_url": "https://example.com/product/test-item"
        }
        
        success, item_data, status = self.make_request(
            'POST', 'order-items', test_item, token=self.admin_token
        )
        
        if success and 'id' in item_data:
            item_id = item_data['id']
            external_url = item_data.get('external_url')
            item_type = item_data.get('item_type')
            
            self.log_test(
                "Create manual item with external URL",
                external_url == test_item['external_url'] and item_type == 'manuel_urun',
                f"Item ID: {item_id}, URL: {external_url}, Type: {item_type}"
            )
            
            # Verify the item is saved with external URL
            success, order_details, status = self.make_request(
                'GET', f'orders/{order_id}', token=self.admin_token
            )
            
            if success and 'items' in order_details:
                items = order_details['items']
                url_item = next((item for item in items if item['id'] == item_id), None)
                
                if url_item:
                    has_url = url_item.get('external_url') == test_item['external_url']
                    is_manual = url_item.get('item_type') == 'manuel_urun'
                    
                    self.log_test(
                        "Manual item with URL saved correctly",
                        has_url and is_manual,
                        f"URL preserved: {has_url}, Manual type: {is_manual}"
                    )
                else:
                    self.log_test("Find item with URL in order", False, "Item not found in order")
            else:
                self.log_test("Get order items with URL", False, f"Status: {status}")
        else:
            self.log_test("Create manual item with external URL", False, f"Status: {status}")

    def test_cargo_barcode_status_functionality(self):
        """Test cargo barcode status functionality"""
        print("\n📦 Testing Cargo Barcode Status...")
        
        if not self.admin_token:
            self.log_test("Cargo barcode test", False, "No admin token")
            return

        # Create order with cargo delivery
        test_order = {
            "order_type": "showroom_satis",
            "customer_name": f"Test Cargo Barcode {datetime.now().strftime('%H%M%S')}",
            "customer_phone": "+90 555 123 4567",
            "customer_email": "cargo@example.com",
            "tax_id_type": "tc",
            "tax_number": "12345678902",
            "tax_office": "Test Vergi Dairesi",
            "delivery_method": "kargo",
            "cargo_company": "Test Kargo",
            "cargo_tracking_code": "TEST123456",
            "cargo_barcode_status": "yazdirilmadi",
            "notes": "Test order for cargo barcode"
        }
        
        success, data, status = self.make_request(
            'POST', 'orders', test_order, token=self.admin_token
        )
        
        if success and 'id' in data:
            order_id = data['id']
            cargo_barcode_status = data.get('cargo_barcode_status')
            
            self.log_test(
                "Create order with cargo barcode status",
                cargo_barcode_status == "yazdirilmadi",
                f"Cargo barcode status: {cargo_barcode_status}"
            )
            
            # Update cargo barcode status to printed
            update_data = {
                **test_order,
                "cargo_barcode_status": "yazdirildi"
            }
            
            success, update_response, status = self.make_request(
                'PUT', f'orders/{order_id}', update_data, token=self.admin_token
            )
            
            if success:
                updated_status = update_response.get('cargo_barcode_status')
                self.log_test(
                    "Update cargo barcode status",
                    updated_status == "yazdirildi",
                    f"Updated status: {updated_status}"
                )
            else:
                self.log_test("Update cargo barcode status", False, f"Status: {status}")
        else:
            self.log_test("Create order with cargo barcode status", False, f"Status: {status}")

    def run_all_tests(self):
        """Run all new feature tests"""
        print("🚀 Starting New Features API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            if not self.setup_authentication():
                print("❌ Authentication setup failed")
                return False
                
            self.test_dashboard_new_stats()
            self.test_order_filtering_new_params()
            self.test_user_assignment_functionality()
            self.test_payment_term_functionality()
            self.test_external_url_functionality()
            self.test_cargo_barcode_status_functionality()
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {e}")
            return False
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 New Features Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All new feature tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = NewFeaturesAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/new_features_test_results.json', 'w') as f:
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
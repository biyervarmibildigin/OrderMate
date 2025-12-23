import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings as SettingsIcon,
  LogOut,
  Menu
} from 'lucide-react';
  Bell,

import { Button } from './ui/button';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleColor = (role) => {
    const colors = {
      showroom: 'text-emerald-600',
      corporate_sales: 'text-indigo-600',
      warehouse: 'text-amber-600',
      finance: 'text-pink-600',
      accounting: 'text-purple-600',
      admin: 'text-zinc-900'
    };
    return colors[role] || 'text-zinc-600';
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      showroom: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      corporate_sales: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      warehouse: 'bg-amber-100 text-amber-800 border-amber-200',
      finance: 'bg-pink-100 text-pink-800 border-pink-200',
      accounting: 'bg-purple-100 text-purple-800 border-purple-200',
      admin: 'bg-zinc-100 text-zinc-800 border-zinc-200'
    };
    return colors[role] || 'bg-zinc-100 text-zinc-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      showroom: 'Showroom',
      corporate_sales: 'Kurumsal Satış',
      warehouse: 'Depo',
      finance: 'Finans',
      accounting: 'Muhasebe',
      admin: 'Admin'
    };
    return labels[role] || role;
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Siparişler', href: '/orders', icon: ShoppingCart },
    { name: 'Ürünler', href: '/products', icon: Package },
  ];

  // Add Users menu for admin and accounting
  if (user?.role === 'admin' || user?.role === 'accounting') {
    navigation.push({ name: 'Kullanıcılar', href: '/users', icon: Users });
  }

  // Add Settings menu for admin only
  if (user?.role === 'admin') {
    navigation.push({ name: 'Ayarlar', href: '/settings', icon: SettingsIcon });
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-zinc-200">
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-center h-16 border-b border-zinc-200 px-6">
            <h1 className="text-2xl font-bold font-heading tracking-tight text-zinc-900">
              OrderMate
            </h1>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                             (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" strokeWidth={1.5} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-zinc-200">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-semibold text-zinc-700">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {user?.full_name}
                </p>
                <p className={`text-xs font-mono truncate ${getRoleColor(user?.role)}`}>
                  {getRoleLabel(user?.role)}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="w-full justify-start"
              data-testid="logout-button"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Çıkış
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-zinc-200 z-10 flex items-center justify-between px-4">
        <h1 className="text-xl font-bold font-heading tracking-tight text-zinc-900">
          OrderMate
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center h-16 border-b border-zinc-200">
              <h1 className="text-xl font-bold font-heading tracking-tight text-zinc-900">
                OrderMate
              </h1>
            </div>
            <nav className="px-4 py-6 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-200">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center font-semibold text-zinc-700">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{user?.full_name}</p>
                  <p className={`text-xs font-mono ${getRoleColor(user?.role)}`}>
                    {getRoleLabel(user?.role)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto md:mt-0 mt-16">
        <div className="p-6 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

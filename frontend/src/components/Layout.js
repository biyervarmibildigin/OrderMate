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
  Menu,
  Bell
} from 'lucide-react';
import axios from 'axios';
import { toast } from './ui/sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

import { Button } from './ui/button';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifOpen, setNotifOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const response = await axios.get(`${API_URL}/notifications?limit=20`);
        setNotifications(response.data || []);
        setUnreadCount(response.data.filter((n) => !n.read).length);
      } catch (error) {
        console.error('Bildirimler alınamadı', error);
      }
    };

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async (notif) => {
    try {
      await axios.post(`${API_URL}/notifications/mark-read`, {
        notification_ids: [notif.id],
      });
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - (notif.read ? 0 : 1)));
      if (notif.order_code) {
        navigate(`/orders/${notif.order_code}`);
      }
    } catch (error) {
      console.error('Bildirim güncellenemedi', error);
    }
  };

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
            <div className="flex items-center justify-between w-full">
              <h1 className="text-2xl font-bold font-heading tracking-tight text-zinc-900">
                OrderMate
              </h1>
              {user && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((prev) => !prev)}
                    className="relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50"
                  >
                    <Bell className="h-4 w-4 text-zinc-700" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-96 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 text-left">
                      <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-600">Bildirimler</span>
                        <span className="text-[10px] text-zinc-400">Son 20</span>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-zinc-500">Henüz bildiriminiz yok.</div>
                      ) : (
                        <ul className="max-h-80 overflow-auto text-sm">
                          {notifications.map((n) => (
                            <li
                              key={n.id}
                              onClick={() => {
                                setNotifOpen(false);
                                handleNotificationClick(n);
                              }}
                              className={`px-3 py-2.5 border-b border-zinc-100 cursor-pointer hover:bg-zinc-50 ${
                                !n.read ? 'bg-zinc-50' : 'bg-white'
                              }`}
                              title={n.message}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-zinc-800 truncate">
                                    {n.created_by_name || 'Bir kullanıcı'} sizi {n.order_code || 'bir siparişte'} etiketledi.
                                  </p>
                                  {n.order_code && (
                                    <p className="text-[11px] text-zinc-500 mt-0.5">Sipariş: {n.order_code}</p>
                                  )}
                                  <p className="text-[11px] text-zinc-500 truncate" title={n.message}>
                                    {n.message}
                                  </p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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

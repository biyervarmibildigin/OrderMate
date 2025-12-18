import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
      toast.success('Giriş başarılı!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1597681317170-9a0f5a350454?crop=entropy&cs=srgb&fm=jpg&q=85)',
        }}
      >
        <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
      </div>

      <Card className="w-full max-w-md mx-4 p-8 relative z-10 shadow-2xl border-zinc-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-heading tracking-tight text-zinc-900 mb-2">
            OrderMate
          </h1>
          <p className="text-sm text-zinc-600">Sipariş Takip Sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium text-zinc-700">
              Kullanıcı Adı
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Kullanıcı adınızı girin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="username-input"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Şifre
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Şifrenizi girin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="password-input"
              className="h-11"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11"
            disabled={loading}
            data-testid="login-button"
          >
            {loading ? (
              'Giriş yapılıyor...'
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Giriş Yap
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-zinc-50 rounded-md border border-zinc-200">
          <p className="text-xs text-zinc-600 mb-2 font-medium">Test Hesapları:</p>
          <div className="space-y-1 text-xs text-zinc-500 font-mono">
            <div>admin / admin123</div>
            <div>showroom / showroom123</div>
            <div>furkan / furkan123</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;

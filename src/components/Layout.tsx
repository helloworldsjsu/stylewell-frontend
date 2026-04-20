import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Zap, Sparkles, LogOut, ShoppingBag } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import logoNameImg from '../../assets/logon.png';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const NAVIGATION = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/wardrobe', label: 'Wardrobe', icon: Zap },
  { path: '/matching', label: 'Matching', icon: Sparkles },
  { path: '/suggestions', label: 'Suggestions', icon: ShoppingBag },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleLogoClick = () => {
    window.location.assign('/');
  };

  const handleSignOut = async () => {
    try {
      setSignOutError(null);
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
      setSignOutError(message || 'Failed to sign out. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <nav className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button
                type="button"
                onClick={handleLogoClick}
                className="flex items-center gap-3 rounded-lg focus:outline-none"
              >
                <img src={logoImg} alt="DressSense" className="w-12 h-12" />
                <img src={logoNameImg} alt="DressSense" className="h-8 w-auto" />
              </button>

              <div className="hidden md:flex items-center gap-1">
                {NAVIGATION.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Signed in as</p>
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden border-t border-gray-200">
          <div className="flex items-center justify-around py-2">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-6 lg:py-8">
        {signOutError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {signOutError}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

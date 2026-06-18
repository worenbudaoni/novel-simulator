import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold text-gray-900">
              Novel Simulator
            </Link>
            {user && (
              <>
                <Link to="/player" className="text-sm text-gray-600 hover:text-gray-900">
                  作品列表
                </Link>
                {user.roles.includes('ADMIN') && (
                  <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">
                    管理后台
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600">
                  {user.nickname}
                  <span className="ml-1 text-xs text-gray-400">
                    ({user.roles.join(', ')})
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  退出
                </button>
              </>
            ) : (
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

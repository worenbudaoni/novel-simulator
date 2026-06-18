import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

const PlayerHome = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold">作品列表</h1>
    <p className="text-gray-500 mt-2">P2 实现</p>
  </div>
);

const AdminHome = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold">管理后台</h1>
    <p className="text-gray-500 mt-2">P2 实现</p>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/player" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/player" element={<PlayerHome />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute permissions={['novel:read', 'user:read']}>
              <AdminHome />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

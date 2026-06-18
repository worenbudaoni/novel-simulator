import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
        <p className="text-gray-600 mb-4">页面不存在</p>
        <Link to="/" className="text-blue-600 hover:underline">返回首页</Link>
      </div>
    </div>
  );
}

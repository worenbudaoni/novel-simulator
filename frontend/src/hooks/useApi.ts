import axios from 'axios';
import { toast } from 'sonner';
import type { ApiResult } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('sessionId');
  if (sessionId) {
    config.headers.Authorization = `Bearer ${sessionId}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResult<unknown>;
    if (data.code !== 200) {
      toast.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('userInfo');
      toast.error('登录已过期，请重新登录');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
      return Promise.reject(error);
    }
    if (error.response?.status === 403) {
      toast.error('没有权限执行此操作');
      return Promise.reject(error);
    }
    const msg = error.response?.data?.message || '网络错误';
    toast.error(msg);
    return Promise.reject(error);
  }
);

export default api;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'src/components/ui/card';
import { Badge } from 'src/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import api from '@/hooks/useApi';
import { BookOpenIcon } from 'lucide-react';

interface NovelItem {
  id: number;
  title: string;
  author: string;
  worldView: string;
  contentType: number;
  coverUrl: string;
}

export default function PlayerNovelsPage() {
  const [novels, setNovels] = useState<NovelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/player/novel/list').then(res => {
      if (res.data.code === 200) setNovels(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const typeLabel = (t: number) => ['小说', '动漫', '漫画'][t] || '未知';

  const startGame = (novelId: number, novelTitle?: string) => {
    navigate(`/player/settings/${novelId}`, { state: { novelTitle } });
  };

  if (loading) {
    return (
      <div>
        <div className="h-7 w-24 bg-muted rounded animate-pulse mb-1" />
        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-card animate-pulse">
              <div className="p-4 pb-2 space-y-2">
                <div className="h-5 w-24 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
              <div className="p-4 space-y-2">
                <div className="h-12 bg-muted rounded" />
                <div className="h-9 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">作品列表</h2>
      <p className="text-sm text-muted-foreground mb-6">选择一部作品开始你的冒险</p>

      {novels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpenIcon className="size-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">暂无可见作品</p>
          <p className="text-sm mt-1 max-w-xs text-center">
            {user
              ? '当前没有已发布的作品，请联系管理员导入并发布作品'
              : '登录后可查看更多作品，或等待管理员添加公开作品'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {novels.map(novel => (
            <Card key={novel.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => startGame(novel.id, novel.title)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{novel.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px] shrink-0">{typeLabel(novel.contentType)}</Badge>
                </div>
                {novel.author && <CardDescription className="text-xs">{novel.author}</CardDescription>}
              </CardHeader>
              <CardContent>
                {novel.worldView ? (
                  <p className="text-xs text-muted-foreground line-clamp-3">{novel.worldView}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50">暂无简介</p>
                )}
                <Button size="sm" className="w-full mt-3">开始冒险</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!user && (
        <p className="text-center text-xs text-muted-foreground mt-6">
          当前为游客模式，登录后可永久保存进度
        </p>
      )}
    </div>
  );
}

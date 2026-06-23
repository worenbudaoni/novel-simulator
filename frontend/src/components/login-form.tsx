import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from "src/lib/utils"
import { Button } from "src/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { useAuth } from '@/hooks/useAuth';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ username, password });
      navigate('/player');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">登录</h1>
          <p className="text-sm text-balance text-muted-foreground">
            登录继续你的冒险
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            type="text"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '登录中...' : '登录'}
          </Button>
        </Field>
        <Field>
          <p className="text-center text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link to="/register" className="font-medium text-primary underline underline-offset-4">
              注册
            </Link>
          </p>
        </Field>
      </FieldGroup>
    </form>
  )
}

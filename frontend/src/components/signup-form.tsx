import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from "src/lib/utils"
import { Button } from "src/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "src/components/ui/field"
import { Input } from "src/components/ui/input"
import { useAuth } from '@/hooks/useAuth';

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await register({ username, password });
      navigate('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">注册</h1>
          <p className="text-sm text-balance text-muted-foreground">
            创建账号开始你的故事之旅
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
            placeholder="3-50 个字符"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            required
          />
          <FieldDescription>3-50 个字符，字母、数字或下划线</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <FieldDescription>至少 6 个字符</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">确认密码</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            placeholder="再次输入密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '注册中...' : '注册'}
          </Button>
        </Field>
        <Field>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link to="/login" className="font-medium text-primary underline underline-offset-4">
              登录
            </Link>
          </p>
        </Field>
      </FieldGroup>
    </form>
  )
}

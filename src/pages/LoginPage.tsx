import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Hash,
  KeyRound,
  Languages,
  LockKeyhole,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { login as apiLogin, setupPassword } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { errorMessage } from '../lib/format';
import { Badge, Button, Field, Spinner } from '../components/ui';

type Mode = 'login' | 'setup';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, lang, toggleLang } = useI18n();

  const features = [
    {
      icon: <Hash className="h-4 w-4" />,
      title: t('login.featureDetect'),
      text: t('login.featureDetectText'),
    },
    {
      icon: <LockKeyhole className="h-4 w-4" />,
      title: t('login.featureQuarantine'),
      text: t('login.featureQuarantineText'),
    },
    {
      icon: <Fingerprint className="h-4 w-4" />,
      title: t('login.featureLedger'),
      text: t('login.featureLedgerText'),
    },
    {
      icon: <Radio className="h-4 w-4" />,
      title: t('login.featureNotify'),
      text: t('login.featureNotifyText'),
    },
  ];

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (mode === 'setup') {
        if (password.length < 8) {
          setError(t('login.pwdMin8'));
          return;
        }
        if (password !== confirmPassword) {
          setError(t('login.pwdMismatch'));
          return;
        }
        await setupPassword(username.trim(), password);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setNotice(t('login.adminCreated'));
        return;
      }

      const res = await apiLogin(username.trim(), password);
      // Respons login tidak lagi berisi token (cookie HttpOnly): cukup role.
      login(res.data.role);
      navigate('/dashboard');
    } catch (err) {
      const raw = errorMessage(err, t('login.authFailed'));
      if (raw.includes('invalid credentials')) {
        setError(t('login.invalidCreds'));
      } else if (raw.includes('password already configured')) {
        setError(t('login.alreadyConfigured'));
      } else if (raw.includes('password must be at least 8')) {
        setError(t('login.pwdMin8'));
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-10 lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse at 25% 30%, black, transparent 72%)',
          }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">FIM-IPL</p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                {t('app.tagline')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t('nav.language')}
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === 'id' ? 'ID' : 'EN'}
          </button>
        </div>

        <div className="relative max-w-xl">
          <Badge tone="accent" className="mb-5">
            {t('login.heroBadge')}
          </Badge>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground xl:text-4xl">
            {t('login.heroTitle')}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t('login.heroSubtitle')}
          </p>

          <div className="mt-8 space-y-3.5">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-accent">
                  {feature.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{feature.title}</p>
                  <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-[10px] text-muted-foreground">
          <span>{t('login.footerEnv')}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>v1.1.0</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="animate-rise w-full max-w-sm">
          <div className="mb-7 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
                <ShieldCheck className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">FIM-IPL</p>
                <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  {t('app.tagline')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('nav.language')}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === 'id' ? 'ID' : 'EN'}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-5">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-accent">
                {t('login.secureGate')}
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {mode === 'login' ? t('login.signInTitle') : t('login.setupTitle')}
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {mode === 'login' ? t('login.signInSubtitle') : t('login.setupSubtitle')}
              </p>
            </div>

            {notice && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-[11px] text-success">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-[11px] text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label={t('login.username')} htmlFor="username">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background/70 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
                  placeholder={
                    mode === 'setup'
                      ? t('login.usernameSetupPlaceholder')
                      : t('login.usernamePlaceholder')
                  }
                  required
                  autoComplete="username"
                  autoFocus
                />
              </Field>

              <Field label={t('login.password')} htmlFor="password">
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background/70 px-3 py-2.5 pr-10 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
                    placeholder={t('login.passwordPlaceholder')}
                    required
                    autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showPassword ? t('login.hidePassword') : t('login.showPassword')
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </Field>

              {mode === 'setup' && (
                <Field label={t('login.confirmPassword')} htmlFor="confirm-password">
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-input bg-background/70 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
                    placeholder={t('login.confirmPlaceholder')}
                    required
                    autoComplete="new-password"
                  />
                </Field>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={loading}
                icon={loading ? undefined : <ArrowRight className="h-3.5 w-3.5" />}
              >
                {mode === 'login' ? t('login.signIn') : t('login.createAdmin')}
              </Button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" />
                JWT · bcrypt
              </span>
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'setup' : 'login')}
                className="font-medium text-accent transition-colors hover:text-accent/80"
              >
                {mode === 'login' ? t('login.firstSetup') : t('login.backToSignIn')}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="font-semibold text-foreground">{t('role.superAdmin')}</p>
              <p className="mt-0.5 text-muted-foreground">{t('login.superAdminAccess')}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="font-semibold text-foreground">{t('role.auditor')}</p>
              <p className="mt-0.5 text-muted-foreground">{t('login.auditorAccess')}</p>
            </div>
          </div>

          <p className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground/70">
            {t('login.securityNote')}
          </p>
        </div>
      </section>

      {loading && (
        <div className="pointer-events-none fixed bottom-4 right-4">
          <Spinner className="h-3 w-3 text-accent" />
        </div>
      )}
    </div>
  );
}

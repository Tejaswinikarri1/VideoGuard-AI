import { ArrowRight, BarChart3, Brain, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authErrorMessage } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { validateEmail } from '../auth/validation';
import { ShieldLogo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { email: validateEmail(email) ?? undefined, password: password ? undefined : 'Password is required.' };
    setErrors(next); setFormError(null);
    if (next.email || next.password) return;
    setBusy(true);
    try { await signIn(email.trim(), password, remember); nav('/dashboard', { replace: true }); }
    catch (err) { setFormError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <section className="auth__hero" aria-label="Product overview">
        <div className="auth__brand">
          <ShieldLogo size={150} />
          <h1>VideoGuard <span>AI</span></h1>
          <p className="auth__tagline">Smarter Surveillance<br />Safer Spaces</p>
        </div>
        <div className="auth__features">
          <div className="auth__feature"><div className="ico"><Brain size={26} /></div>AI Powered Analysis</div>
          <div className="auth__feature"><div className="ico"><BarChart3 size={26} /></div>Real-time Insights</div>
          <div className="auth__feature"><div className="ico"><ShieldCheck size={26} /></div>Secure &amp; Reliable</div>
        </div>
      </section>
      <main className="auth__panel">
        <form className="auth__card" onSubmit={submit} noValidate>
          <ThemeToggle className="auth__theme" />
          <h2 style={{ marginTop: 64 }}>Welcome Back</h2>
          <p className="auth__sub">Sign in to your account</p>
          {params.get('expired') && !formError && <div className="form-error" role="alert">Your session has expired. Please sign in again.</div>}
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <TextField id="email" label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com"
            icon={<Mail size={22} />} error={errors.email} autoComplete="email" />
          <TextField id="password" label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password"
            icon={<Lock size={22} />} error={errors.password} autoComplete="current-password" />
          <div className="row">
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me</label>
            {/* Password reset is not implemented in the backend yet: the link explains that instead of failing silently. */}
            <button type="button" className="link-btn" onClick={() => setFormError('Password reset by email is not available yet. Please ask an administrator to reset your password.')}>Forgot password?</button>
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : <>Sign In <ArrowRight size={22} /></>}</button>
          <div className="divider">OR</div>
          <p className="auth__alt">Don&apos;t have an account? <Link to="/register">Create new account</Link></p>
        </form>
      </main>
    </div>
  );
}

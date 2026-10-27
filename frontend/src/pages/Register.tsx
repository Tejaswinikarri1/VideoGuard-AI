import { ArrowRight, Crosshair, Database, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authErrorMessage } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { PASSWORD_HINT, validateRegister, type RegisterForm } from '../auth/validation';
import { ShieldLogo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Register() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState<RegisterForm>({ name: '', email: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RegisterForm>(k: K) => (v: RegisterForm[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateRegister(f);
    setErrors(errs); setFormError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await signUp(f.name.trim(), f.email.trim(), f.password); nav('/dashboard', { replace: true }); }
    catch (err) { setFormError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth auth--register">
      <section className="auth__hero" aria-label="Product overview">
        <div className="auth__brand"><ShieldLogo size={64} /><h1>VideoGuard <span>AI</span></h1></div>
        <p className="auth__tagline">Smarter Surveillance. Safer Spaces.</p>
        <div className="auth__list">
          <div><Crosshair size={34} color="#29a3ff" /><span><b>AI-Powered Analysis</b><small>Detect and prevent suspicious activities</small></span></div>
          <div><ShieldCheck size={34} color="#29a3ff" /><span><b>Real-Time Monitoring</b><small>Stay ahead of potential risks</small></span></div>
          <div><Database size={34} color="#29a3ff" /><span><b>Secure &amp; Reliable</b><small>Your data, our priority</small></span></div>
        </div>
      </section>
      <main className="auth__panel">
        <ThemeToggle className="auth__theme" />
        <form className="auth__card" onSubmit={submit} noValidate>
          <h2>Create Account</h2>
          <p className="auth__sub">Join VideoGuard AI and start securing your world.</p>
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <TextField id="name" label="Full name" value={f.name} onChange={set('name')} placeholder="Enter your full name" icon={<User size={22} />} error={errors.name} autoComplete="name" />
          <TextField id="email" label="Email address" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" icon={<Mail size={22} />} error={errors.email} autoComplete="email" />
          <TextField id="password" label="Password" type="password" value={f.password} onChange={set('password')} placeholder="Enter your password" icon={<Lock size={22} />} error={errors.password} hint={PASSWORD_HINT} autoComplete="new-password" />
          <TextField id="confirm" label="Confirm password" type="password" value={f.confirm} onChange={set('confirm')} placeholder="Confirm your password" icon={<Lock size={22} />} error={errors.confirm} autoComplete="new-password" />
          <div className="row" style={{ margin: '0 0 22px' }}>
            <label className="check" style={{ fontSize: 15 }}>
              <input type="checkbox" checked={f.agree} onChange={(e) => set('agree')(e.target.checked)} />
              {/* Terms and Privacy pages do not exist yet. */}
              <span>I agree to the <span className="link-btn" title="Not yet implemented">Terms of Service</span> and <span className="link-btn" title="Not yet implemented">Privacy Policy</span></span>
            </label>
          </div>
          {errors.agree && <div className="field__error" role="alert" style={{ marginTop: -14, marginBottom: 14 }}>{errors.agree}</div>}
          <button className="btn-primary" type="submit" disabled={busy} style={{ height: 60 }}>{busy ? 'Creating account…' : <>Create Account <ArrowRight size={22} /></>}</button>
          <p className="auth__alt">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </main>
    </div>
  );
}

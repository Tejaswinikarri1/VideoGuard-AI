import { Eye, EyeOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface Props { id: string; label: string; type?: 'text' | 'email' | 'password'; value: string; onChange: (v: string) => void;
  placeholder: string; icon: ReactNode; error?: string | null; hint?: string; autoComplete?: string }

export function TextField({ id, label, type = 'text', value, onChange, placeholder, icon, error, hint, autoComplete }: Props) {
  const [shown, setShown] = useState(false);
  const isPw = type === 'password';
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__box">
        {icon}
        <input id={id} type={isPw && shown ? 'text' : type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
        {isPw && (
          <button type="button" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown((s) => !s)}>
            {shown ? <Eye size={22} /> : <EyeOff size={22} />}
          </button>
        )}
      </div>
      {error ? <div id={`${id}-err`} className="field__error" role="alert">{error}</div> : hint ? <div id={`${id}-hint`} className="field__hint">{hint}</div> : null}
    </div>
  );
}

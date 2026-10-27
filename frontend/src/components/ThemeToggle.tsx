import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={`theme-toggle ${className}`} role="group" aria-label="Theme">
      <button type="button" aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={20} /></button>
      <button type="button" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={20} /></button>
    </div>
  );
}

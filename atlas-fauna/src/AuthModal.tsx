// src/AuthModal.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from './types';
import { apiUrl } from './utils/api';
import './App.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
}

type Mode = 'login' | 'register' | 'forgot';

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  
  // Поля формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Индикаторы требований к паролю
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  if (!isOpen) return null;

  // Сброс полей при переключении вкладок
  const resetForm = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPasswordChecks({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    });
  };

  // Проверка требований к паролю в реальном времени
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    
    if (mode === 'register') {
      setPasswordChecks({
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /[0-9]/.test(value),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Валидация на клиенте (только для регистрации)
    if (mode === 'register') {
      if (password.length < 8) {
        setError("Пароль должен содержать минимум 8 символов");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Пароль должен содержать хотя бы одну заглавную букву");
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Пароль должен содержать хотя бы одну строчную букву");
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Пароль должен содержать хотя бы одну цифру");
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        setError("Пароль должен содержать хотя бы один специальный символ");
        return;
      }
      if (password !== confirmPassword) {
        setError("Пароли не совпадают");
        return;
      }
    }

    // Заглушка для восстановления пароля
    if (mode === 'forgot') {
      alert("Функция восстановления пароля будет доступна позже. Обратитесь к администратору.");
      return;
    }

    setIsLoading(true);

    // 2. Выбираем правильный адрес на сервере
    const endpoint = mode === 'login' ? '/api/login' : '/api/register';

    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      // === БЕЗОПАСНАЯ ОБРАБОТКА ОТВЕТА ===
      const contentType = response.headers.get("content-type");
      
      // Если ответ не JSON (например, HTML страница ошибки 404/500)
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error('Получен не-JSON ответ от сервера:', text);
        throw new Error(`Ошибка сервера (${response.status}). Проверьте консоль.`);
      }

      const data = await response.json();

      if (!response.ok) {
        // Сервер вернул ошибку в формате JSON (напр. "Неверный пароль")
        throw new Error(data.error || "Произошла ошибка");
      }

      const responseUser = data?.user ?? data;
      const normalizedUser = {
        id: Number(responseUser?.id),
        email: String(responseUser?.email || ''),
        role: String(responseUser?.role || 'user')
      };

      if (!Number.isFinite(normalizedUser.id) || !normalizedUser.email) {
        throw new Error('Некорректный ответ сервера');
      }

      // 3. Успех
      onLogin(normalizedUser); 
      onClose();
      resetForm('login'); // Сбрасываем форму на будущее

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ошибка соединения с сервером");
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = (
    <div className="auth-overlay" onClick={onClose}>
      <div 
        className="auth-window" 
        onClick={(e) => e.stopPropagation()}      // Чтобы клик внутри не закрывал окно
        onMouseDown={(e) => e.stopPropagation()}  // Чтобы выделение текста не закрывало окно
      >
        <button className="close-btn" onClick={onClose} style={{ top: 15, right: 15, position: 'absolute' }}>×</button>

        {/* ЗАГОЛОВОК */}
        <h2 style={{ textAlign: 'center', marginBottom: 20, marginTop: 0 }}>
          {mode === 'login' && 'Вход в Атлас'}
          {mode === 'register' && 'Регистрация'}
          {mode === 'forgot' && 'Восстановление'}
        </h2>

        {/* ПЕРЕКЛЮЧАТЕЛИ (Табы) */}
        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => resetForm('login')}
            >
              Вход
            </button>
            <button 
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => resetForm('register')}
            >
              Создать аккаунт
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* EMAIL */}
          <div className="auth-input-group">
            <label>Email</label>
            <input 
              type="email" 
              className="auth-input" 
              placeholder="name@example.com" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* PASSWORD */}
          {mode !== 'forgot' && (
            <div className="auth-input-group">
              <label>Пароль</label>
              <input 
                type="password" 
                className="auth-input"
                placeholder={mode === 'register' ? "Минимум 8 символов" : "Введите пароль"} 
                required
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
              />
            </div>
          )}

          {/* ИНДИКАТОР ТРЕБОВАНИЙ К ПАРОЛЮ (только для регистрации) */}
          {mode === 'register' && password.length > 0 && (
            <div style={{ 
              background: '#f5f5f5', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '15px',
              fontSize: '12px'
            }}>
              {/* Прогресс-бар силы пароля */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ 
                  height: '8px', 
                  background: '#e0e0e0', 
                  borderRadius: '4px', 
                  overflow: 'hidden',
                  marginBottom: '6px'
                }}>
                  <div style={{ 
                    width: `${(Object.values(passwordChecks).filter(v => v).length / Object.keys(passwordChecks).length) * 100}%`, 
                    height: '100%', 
                    background: (() => {
                      const percent = (Object.values(passwordChecks).filter(v => v).length / Object.keys(passwordChecks).length) * 100;
                      if (percent === 100) return '#4caf50';
                      if (percent >= 60) return '#ff9800';
                      return '#d32f2f';
                    })(),
                    transition: 'all 0.3s ease'
                  }} />
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: (() => {
                    const percent = (Object.values(passwordChecks).filter(v => v).length / Object.keys(passwordChecks).length) * 100;
                    if (percent === 100) return '#4caf50';
                    if (percent >= 60) return '#ff9800';
                    return '#d32f2f';
                  })(),
                  fontWeight: 'bold'
                }}>
                  {(() => {
                    const percent = (Object.values(passwordChecks).filter(v => v).length / Object.keys(passwordChecks).length) * 100;
                    const count = Object.values(passwordChecks).filter(v => v).length;
                    const total = Object.keys(passwordChecks).length;
                    if (percent === 100) return `Отличный пароль (${count}/${total})`;
                    if (percent >= 60) return `Средний пароль (${count}/${total})`;
                    if (percent > 0) return `Слабый пароль (${count}/${total})`;
                    return 'Введите пароль';
                  })()}
                </div>
              </div>

              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>
                Требования к паролю:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <PasswordRequirement 
                  met={passwordChecks.length} 
                  text="Минимум 8 символов" 
                />
                <PasswordRequirement 
                  met={passwordChecks.uppercase} 
                  text="Заглавная буква (A-Z)" 
                />
                <PasswordRequirement 
                  met={passwordChecks.lowercase} 
                  text="Строчная буква (a-z)" 
                />
                <PasswordRequirement 
                  met={passwordChecks.number} 
                  text="Цифра (0-9)" 
                />
                <PasswordRequirement 
                  met={passwordChecks.special} 
                  text="Спецсимвол (!@#$%...)" 
                />
              </div>
            </div>
          )}

          {/* CONFIRM PASSWORD (Только для регистрации) */}
          {mode === 'register' && (
            <div className="auth-input-group">
              <label>Повторите пароль</label>
              <input 
                type="password" 
                className={`auth-input ${error === 'Пароли не совпадают' ? 'error' : ''}`}
                placeholder="Тот же самый пароль" 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {/* БЛОК ОШИБОК */}
          {error && (
            <div style={{ 
              color: '#d32f2f', 
              background: '#ffebee', 
              padding: '10px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              marginBottom: '15px', 
              textAlign: 'center' 
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* КНОПКА ОТПРАВКИ */}
          <button 
            type="submit" 
            className="submit-btn" 
            disabled={isLoading || (mode === 'register' && !Object.values(passwordChecks).every(v => v))}
            style={{
              opacity: (isLoading || (mode === 'register' && !Object.values(passwordChecks).every(v => v))) ? 0.5 : 1
            }}
          >
            {isLoading ? 'Загрузка...' : (
              mode === 'login' ? 'Войти' : 
              mode === 'register' ? 'Зарегистрироваться' : 'Сбросить пароль'
            )}
          </button>

          {/* КНОПКА "ЗАБЫЛИ ПАРОЛЬ" */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" className="forgot-btn" onClick={() => setMode('forgot')}>
                Забыли пароль?
              </button>
            </div>
          )}

          {/* КНОПКА "НАЗАД" ДЛЯ ВОССТАНОВЛЕНИЯ */}
          {mode === 'forgot' && (
            <div style={{ textAlign: 'center' }}>
              <button type="button" className="forgot-btn" onClick={() => setMode('login')}>
                Вернуться ко входу
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Компонент для отображения одного требования к паролю
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      color: met ? '#2e7d32' : '#d32f2f',
      fontWeight: met ? '500' : '400'
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>
        {met ? '✅' : '❌'}
      </span>
      <span style={{ lineHeight: '1.2' }}>{text}</span>
    </div>
  );
}

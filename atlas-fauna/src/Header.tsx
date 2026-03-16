// src/Header.tsx
import { memo, useEffect, useState } from 'react';
import type { User } from './types';
import './App.css';

interface HeaderProps {
  user: User | null;
  onHomeClick: () => void;
  onRegionSelectorClick: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onProfileClick: () => void;
  isAdminMode: boolean;
  onToggleAdmin: () => void;
  showAdminToggle?: boolean;
  showRegionSearch: boolean;
  regionSearchTerm: string;
  onRegionSearchChange: (value: string) => void;
  selectedRegionLabel?: string | null;
}

function Header({
  user,
  onHomeClick,
  onRegionSelectorClick,
  onLoginClick,
  onLogoutClick,
  onProfileClick,
  isAdminMode,
  onToggleAdmin,
  showAdminToggle = true,
  showRegionSearch,
  regionSearchTerm,
  onRegionSearchChange,
  selectedRegionLabel
}: HeaderProps) {
  const isAdminUser = user?.role === 'admin';
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!showRegionSearch) {
      setIsSearchOpen(false);
    }
  }, [showRegionSearch]);

  return (
    <header className="app-header">
      <div className="header-breadcrumbs">
        <button type="button" className="header-crumb-btn" onClick={onHomeClick}>
          Главная
        </button>
        <span className="material-icons header-crumb-separator" aria-hidden>
          chevron_right
        </span>
        {selectedRegionLabel ? (
          <>
            <button type="button" className="header-crumb-btn" onClick={onRegionSelectorClick}>
              Выбор региона
            </button>
            <span className="material-icons header-crumb-separator" aria-hidden>
              chevron_right
            </span>
            <span className="header-crumb-current header-crumb-static">{selectedRegionLabel}</span>
          </>
        ) : (
          <button type="button" className="header-crumb-current" onClick={onRegionSelectorClick}>
            Выбор региона
          </button>
        )}
      </div>

      <div className="header-right">
        {showRegionSearch && (
          <div className={`header-region-search ${isSearchOpen ? 'open' : ''}`}>
            {isSearchOpen && (
              <input
                type="text"
                className="header-region-search-input"
                placeholder="Поиск по регионам..."
                value={regionSearchTerm}
                onChange={(e) => onRegionSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                  }
                }}
                autoFocus
              />
            )}
            <button
              type="button"
              className="header-icon-btn"
              aria-label="Поиск регионов"
              onClick={() => setIsSearchOpen((prev) => !prev)}
            >
              <span className="material-icons" aria-hidden>
                search
              </span>
            </button>
          </div>
        )}

        {isAdminUser && showAdminToggle && (
          <button
            type="button"
            className={`admin-toggle-btn ${isAdminMode ? 'active' : ''}`}
            onClick={onToggleAdmin}
          >
            {isAdminMode ? 'Выйти из редактора' : 'Редактор'}
          </button>
        )}

        {user ? (
          <div className="user-profile">
            <button type="button" className="user-name" onClick={onProfileClick}>
              {user.email}
            </button>
            <button type="button" className="logout-btn" onClick={onLogoutClick}>
              Выйти
            </button>
          </div>
        ) : (
          <button type="button" className="login-btn" onClick={onLoginClick}>
            Войти
          </button>
        )}
      </div>
    </header>
  );
}

export default memo(Header);

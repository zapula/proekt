import type { RefObject } from 'react';
import type { AnimalCategory, DietType } from '../animals';

interface SearchPanelProps {
  top: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeCategory: AnimalCategory;
  onCategoryChange: (category: AnimalCategory) => void;
  dietFilter: DietType | 'all';
  onDietFilterChange: (diet: DietType | 'all') => void;
  redBookOnly: boolean;
  onRedBookOnlyChange: (value: boolean) => void;
  isFilterMenuOpen: boolean;
  onToggleFilterMenu: () => void;
  onCloseFilterMenu: () => void;
  onChangeRegion: () => void;
  isAdminMode: boolean;
  onExportCsv: () => void;
  filterMenuRef: RefObject<HTMLDivElement | null>;
}

export default function SearchPanel({
  top,
  searchTerm,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  dietFilter,
  onDietFilterChange,
  redBookOnly,
  onRedBookOnlyChange,
  isFilterMenuOpen,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onChangeRegion,
  isAdminMode,
  onExportCsv,
  filterMenuRef
}: SearchPanelProps) {
  return (
    <div className="search-panel" style={{ top }}>
      <div className="map-toolbar-row">
        <label className="map-search-field">
          <span className="material-icons map-search-icon" aria-hidden>
            search
          </span>
          <input
            type="text"
            placeholder="Поиск по животным..."
            className="search-input map-search-input"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>

        <div className="filter-menu-wrapper" ref={filterMenuRef}>
          <button
            type="button"
            className={`map-toolbar-btn filter-toggle-btn ${isFilterMenuOpen ? 'active' : ''}`}
            onClick={onToggleFilterMenu}
            aria-expanded={isFilterMenuOpen}
            aria-haspopup="menu"
          >
            <span className="material-icons" aria-hidden>
              tune
            </span>
            <span>Фильтры</span>
          </button>

          {isFilterMenuOpen && (
            <div className="filter-menu-popover" role="menu" aria-label="Фильтрация животных">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={activeCategory === 'all'}
                className={`filter-menu-item ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => {
                  onCategoryChange('all');
                  onCloseFilterMenu();
                }}
              >
                Все
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={activeCategory === 'mammal'}
                className={`filter-menu-item ${activeCategory === 'mammal' ? 'active' : ''}`}
                onClick={() => {
                  onCategoryChange('mammal');
                  onCloseFilterMenu();
                }}
              >
                Звери
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={activeCategory === 'bird'}
                className={`filter-menu-item ${activeCategory === 'bird' ? 'active' : ''}`}
                onClick={() => {
                  onCategoryChange('bird');
                  onCloseFilterMenu();
                }}
              >
                Птицы
              </button>

              <div className="advanced-filters">
                <select
                  value={dietFilter}
                  onChange={(e) => onDietFilterChange(e.target.value as DietType | 'all')}
                  aria-label="Фильтр по питанию"
                >
                  <option value="all">Все типы питания</option>
                  <option value="herbivore">Травоядные</option>
                  <option value="carnivore">Хищники</option>
                  <option value="omnivore">Всеядные</option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={redBookOnly}
                    onChange={(e) => onRedBookOnlyChange(e.target.checked)}
                  />
                  Только Красная книга
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="button" className="map-toolbar-btn map-region-change-btn" onClick={onChangeRegion}>
        <span className="material-icons" aria-hidden>
          map
        </span>
        Сменить регион
      </button>

      {isAdminMode && (
        <button type="button" className="map-toolbar-btn map-region-change-btn" onClick={onExportCsv}>
          <span className="material-icons" aria-hidden>
            download
          </span>
          Экспорт CSV
        </button>
      )}
    </div>
  );
}

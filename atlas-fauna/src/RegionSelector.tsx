import { useEffect, useMemo, useRef, useState } from 'react';
import Russia from '@react-map/russia';

interface RegionSelectorRegion {
  code: string;
  label: string;
  subtitle: string;
  photoFolder: string;
  speciesCount: number;
  redBookCount: number | null;
  nearbyRegions: string[];
}

interface RegionSelectorProps {
  highlightedRegions: string[];
  regions: RegionSelectorRegion[];
  searchTerm: string;
  onSelectRegion: (regionCode: string) => void;
  onUnavailableRegionSelect: () => void;
}

interface TooltipState {
  title: string;
  x: number;
  y: number;
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_MARGIN = 8;
const NEARBY_MARKER_COLORS = ['#6CA463', '#406157', '#B4FFE4', '#C0F7FD'];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCodeFromPath(path: SVGPathElement) {
  const dataCode = path.getAttribute('data-code');
  if (dataCode) return dataCode;

  if (!path.id) return null;
  const splitIndex = path.id.lastIndexOf('-');
  if (splitIndex <= 0) return null;

  return path.id.slice(0, splitIndex);
}

export default function RegionSelector({
  highlightedRegions,
  regions,
  searchTerm,
  onSelectRegion,
  onUnavailableRegionSelect
}: RegionSelectorProps) {
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [activeRegionCode, setActiveRegionCode] = useState<string | null>(
    highlightedRegions[0] ?? null
  );
  const [mapSize, setMapSize] = useState(() => {
    if (typeof window === 'undefined') return 940;
    const maxWidth = window.innerWidth < 1100 ? window.innerWidth * 0.94 : window.innerWidth * 0.78;
    return Math.max(380, Math.min(1160, Math.floor(maxWidth)));
  });

  useEffect(() => {
    const handleResize = () => {
      const maxWidth = window.innerWidth < 1100 ? window.innerWidth * 0.94 : window.innerWidth * 0.78;
      setMapSize(Math.max(380, Math.min(1160, Math.floor(maxWidth))));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!activeRegionCode || !highlightedRegions.includes(activeRegionCode)) {
      setActiveRegionCode(highlightedRegions[0] ?? null);
    }
  }, [activeRegionCode, highlightedRegions]);

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return;

    const match = regions.find((region) => region.label.toLowerCase().includes(normalizedSearch));
    if (match) {
      setActiveRegionCode(match.code);
    }
  }, [searchTerm, regions]);

  const regionsByCode = useMemo(() => {
    return regions.reduce<Record<string, RegionSelectorRegion>>((acc, region) => {
      acc[region.code] = region;
      return acc;
    }, {});
  }, [regions]);

  const activeRegion = activeRegionCode ? regionsByCode[activeRegionCode] : null;
  const activeRegionCoverSrc = activeRegion ? `${activeRegion.photoFolder}/cover.jpg` : null;
  const [isRegionCoverUnavailable, setIsRegionCoverUnavailable] = useState(false);

  useEffect(() => {
    setIsRegionCoverUnavailable(false);
  }, [activeRegion?.code]);

  const nearbyRegions = useMemo(() => {
    if (!activeRegion) return [];

    return activeRegion.nearbyRegions
      .map((code) => regionsByCode[code])
      .filter((region): region is RegionSelectorRegion => Boolean(region))
      .slice(0, 3);
  }, [activeRegion, regionsByCode]);

  const cityColors = useMemo(() => {
    return highlightedRegions.reduce<Record<string, string>>((acc, regionCode) => {
      acc[regionCode] = regionCode === activeRegionCode ? '#406157' : '#6ca463';
      return acc;
    }, {});
  }, [highlightedRegions, activeRegionCode]);

  const hasSearchMatch = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return regions.some((region) => region.label.toLowerCase().includes(normalizedSearch));
  }, [searchTerm, regions]);

  useEffect(() => {
    const host = mapWrapRef.current;
    if (!host) return;

    const decorateMap = () => {
      const svg = host.querySelector('svg');
      if (!svg) return;

      const paths = svg.querySelectorAll<SVGPathElement>('path');
      paths.forEach((path) => {
        const regionCode = getCodeFromPath(path);
        if (regionCode && !path.getAttribute('data-code')) {
          path.setAttribute('data-code', regionCode);
        }

        const label = regionCode ? regionsByCode[regionCode]?.label : null;
        if (label) {
          path.setAttribute('data-title', label);
        }

        const isSelectable = Boolean(regionCode && highlightedRegions.includes(regionCode));
        const isActive = Boolean(regionCode && regionCode === activeRegionCode && isSelectable);

        path.classList.toggle('rf-selectable', isSelectable);
        path.classList.toggle('rf-active', isActive);
        path.classList.toggle('rf-muted', Boolean(regionCode && isSelectable && !isActive));

        path.style.cursor = isSelectable ? 'pointer' : 'default';
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof SVGPathElement)) {
        setTooltip(null);
        return;
      }

      const regionCode = target.getAttribute('data-code') || getCodeFromPath(target);
      if (!regionCode || !highlightedRegions.includes(regionCode)) {
        setTooltip(null);
        return;
      }

      const title = target.getAttribute('data-title') || regionsByCode[regionCode]?.label;
      if (!title) {
        setTooltip(null);
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const tooltipWidth = tooltipRef.current?.offsetWidth ?? 220;
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 38;

      const minX = TOOLTIP_MARGIN;
      const minY = TOOLTIP_MARGIN;
      const maxX = Math.max(minX, hostRect.width - tooltipWidth - TOOLTIP_MARGIN);
      const maxY = Math.max(minY, hostRect.height - tooltipHeight - TOOLTIP_MARGIN);

      const x = clamp(event.clientX - hostRect.left + TOOLTIP_OFFSET, minX, maxX);
      const y = clamp(event.clientY - hostRect.top + TOOLTIP_OFFSET, minY, maxY);

      setTooltip((previous) => {
        if (previous && previous.title === title && previous.x === x && previous.y === y) {
          return previous;
        }
        return { title, x, y };
      });
    };

    const handleMouseLeave = () => {
      setTooltip(null);
    };

    const handleMapClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof SVGPathElement)) return;

      const regionCode = target.getAttribute('data-code') || getCodeFromPath(target);
      if (!regionCode) return;
      if (!highlightedRegions.includes(regionCode)) {
        onUnavailableRegionSelect();
        return;
      }

      setActiveRegionCode(regionCode);
    };

    decorateMap();
    host.addEventListener('mousemove', handleMouseMove);
    host.addEventListener('mouseleave', handleMouseLeave);
    host.addEventListener('click', handleMapClick);

    let decorateTimeoutId: number | null = null;
    const scheduleDecorateMap = () => {
      if (decorateTimeoutId !== null) return;
      decorateTimeoutId = window.setTimeout(() => {
        decorateTimeoutId = null;
        decorateMap();
      }, 16);
    };

    const observer = new MutationObserver(() => {
      scheduleDecorateMap();
    });

    observer.observe(host, { childList: true, subtree: true });

    return () => {
      host.removeEventListener('mousemove', handleMouseMove);
      host.removeEventListener('mouseleave', handleMouseLeave);
      host.removeEventListener('click', handleMapClick);
      if (decorateTimeoutId !== null) {
        window.clearTimeout(decorateTimeoutId);
      }
      observer.disconnect();
    };
  }, [activeRegionCode, highlightedRegions, mapSize, onUnavailableRegionSelect, regionsByCode]);

  return (
    <div className="region-selector-screen">
      <div className="region-selector-layout">
        <aside className="region-selector-sidebar">
          <div className="region-sidebar-header">
            <div className="region-sidebar-badge">
              <span className="dot" />
              Атлас фауны
            </div>
            <h1>{activeRegion?.label || 'Выберите регион'}</h1>
            <p>
              {activeRegion?.subtitle ||
                'Нажмите на регион в SVG-карте, чтобы увидеть статистику и перейти к исследованию.'}
            </p>
          </div>

          <div className="region-sidebar-scroll">
            {!hasSearchMatch && searchTerm.trim() && (
              <div className="region-search-warning">Регион по запросу не найден. Попробуйте другое название.</div>
            )}

            {activeRegionCoverSrc && !isRegionCoverUnavailable && (
              <figure className="region-cover-card">
                <img
                  key={activeRegionCoverSrc}
                  src={activeRegionCoverSrc}
                  alt={activeRegion?.label || 'Region'}
                  className="region-cover-image"
                  loading="lazy"
                  onError={() => setIsRegionCoverUnavailable(true)}
                />
              </figure>
            )}

            <div className="region-stat-grid">
              <div className="region-stat-card">
                <span className="label">Всего видов</span>
                <span className="value">{activeRegion?.speciesCount ?? 0}</span>
              </div>
              <div className="region-stat-card">
                <span className="label">Краснокнижных</span>
                <span className="value danger">{activeRegion?.redBookCount ?? 'Скоро'}</span>
              </div>
            </div>

            <button
              type="button"
              className="region-explore-btn"
              disabled={!activeRegion}
              onClick={() => {
                if (!activeRegion) return;
                onSelectRegion(activeRegion.code);
              }}
            >
              Исследовать регион
              <span className="material-icons" aria-hidden>
                arrow_forward
              </span>
            </button>

            <div className="region-nearby-block">
              <h3>Другие регионы</h3>
              <ul>
                {nearbyRegions.map((region, index) => (
                  <li key={region.code}>
                    <button
                      type="button"
                      className="region-nearby-item"
                      onClick={() => setActiveRegionCode(region.code)}
                    >
                      <span
                        className="marker"
                        style={{
                          backgroundColor:
                            NEARBY_MARKER_COLORS[index % NEARBY_MARKER_COLORS.length]
                        }}
                      />
                      <span>{region.label}</span>
                      <span className="material-icons" aria-hidden>
                        chevron_right
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="region-selector-map-panel">
          <div className="region-selector-map-wrap" ref={mapWrapRef}>
            <Russia
              type="select-single"
              size={mapSize}
              mapColor="#dce7db"
              strokeColor="#ffffff"
              strokeWidth={0.7}
              hoverColor="#89b287"
              selectColor="#406157"
              cityColors={cityColors}
              borderStyle="solid"
              disableClick
            />

            {tooltip && (
              <div
                ref={tooltipRef}
                className="region-map-tooltip"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                {tooltip.title}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

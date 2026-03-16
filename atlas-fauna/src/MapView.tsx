import { memo, useCallback, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { YMaps, Map, Placemark, Clusterer, Circle } from '@pbe/react-yandex-maps';
import type { IAnimal } from './animals';
import { ANIMAL_MARKER_SIZE } from './constants/map';

interface SelectedRegionConfig {
  center: [number, number];
  zoom: number;
}

interface MapViewProps {
  selectedRegion: string | null;
  selectedRegionConfig: SelectedRegionConfig | null;
  selectedAnimalLocationId: number | null;
  isAdminMode: boolean;
  yandexMapRef: MutableRefObject<any>;
  onMapClick: (e: any) => void;
  regionFilteredAnimals: IAnimal[];
  markerHaloRadiusByLocationId: Record<number, number>;
  haloEditorLocationId: number | null;
  isHaloEditorOpen: boolean;
  isHaloEditorDirty: boolean;
  isHaloEditorSavePending: boolean;
  minAnimalMarkerHaloRadius: number;
  maxAnimalMarkerHaloRadius: number;
  defaultAnimalMarkerHaloRadius: number;
  onAnimalMarkerHaloRadiusChangeForLocation: (locationId: number, radius: number) => void;
  onAnimalMarkerHaloRadiusResetForLocation: (locationId: number) => void;
  onSaveAnimalMarkerHaloRadiusForLocation: (locationId: number) => void;
  onCloseHaloEditor: () => void;
  onDragEnd: (e: any, locationId: number) => void;
  onSelectAnimal: (animal: IAnimal) => void;
  placeLocationCoords: number[] | null;
  onMapZoom: (direction: 'in' | 'out') => void;
}

const MARKER_ICON_OFFSET = -(ANIMAL_MARKER_SIZE / 2);
const HALO_RADIUS_PRESET_METERS = [500, 1000, 2000, 5000, 10000, 25000, 50000];
const HALO_RADIUS_STEP_METERS = 500;
const HALO_ACTIVE_Z_INDEX = 10000;
const HALO_VISIBILITY_MIN_ZOOM = 8;
const HALO_FILL_MIN_ZOOM = 11;

const getSteppedHaloRadius = (
  currentRadius: number,
  direction: 'down' | 'up',
  minRadius: number,
  maxRadius: number
) => {
  if (direction === 'up') {
    const snappedUp = Math.ceil(currentRadius / HALO_RADIUS_STEP_METERS) * HALO_RADIUS_STEP_METERS;
    const nextRadius = snappedUp === currentRadius ? currentRadius + HALO_RADIUS_STEP_METERS : snappedUp;
    return Math.min(maxRadius, Math.max(minRadius, nextRadius));
  }

  const snappedDown = Math.floor(currentRadius / HALO_RADIUS_STEP_METERS) * HALO_RADIUS_STEP_METERS;
  const nextRadius = snappedDown === currentRadius ? currentRadius - HALO_RADIUS_STEP_METERS : snappedDown;
  return Math.min(maxRadius, Math.max(minRadius, nextRadius));
};

const formatHaloPresetLabel = (meters: number) => {
  if (meters >= 1000) {
    const km = meters / 1000;
    const kmLabel = Number.isInteger(km) ? String(km) : km.toFixed(1).replace('.0', '');
    return `${kmLabel} км`;
  }
  return `${meters} м`;
};

function MapViewComponent({
  selectedRegion,
  selectedRegionConfig,
  selectedAnimalLocationId,
  isAdminMode,
  yandexMapRef,
  onMapClick,
  regionFilteredAnimals,
  markerHaloRadiusByLocationId,
  haloEditorLocationId,
  isHaloEditorOpen,
  isHaloEditorDirty,
  isHaloEditorSavePending,
  minAnimalMarkerHaloRadius,
  maxAnimalMarkerHaloRadius,
  defaultAnimalMarkerHaloRadius,
  onAnimalMarkerHaloRadiusChangeForLocation,
  onAnimalMarkerHaloRadiusResetForLocation,
  onSaveAnimalMarkerHaloRadiusForLocation,
  onCloseHaloEditor,
  onDragEnd,
  onSelectAnimal,
  placeLocationCoords,
  onMapZoom
}: MapViewProps) {
  const isMapEmpty = regionFilteredAnimals.length === 0;
  const initialZoom = selectedRegionConfig?.zoom ?? 6;
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [hoveredHaloLocationId, setHoveredHaloLocationId] = useState<number | null>(null);

  const haloEditorAnimal = useMemo(() => {
    if (haloEditorLocationId == null) return null;
    return regionFilteredAnimals.find((animal) => animal.locationId === haloEditorLocationId) ?? null;
  }, [haloEditorLocationId, regionFilteredAnimals]);

  const haloEditorRadius = haloEditorAnimal
    ? markerHaloRadiusByLocationId[haloEditorAnimal.locationId] ?? defaultAnimalMarkerHaloRadius
    : defaultAnimalMarkerHaloRadius;
  const [haloEditorInputValue, setHaloEditorInputValue] = useState(() => String(haloEditorRadius));

  useEffect(() => {
    setHaloEditorInputValue(String(haloEditorRadius));
  }, [haloEditorRadius]);

  useEffect(() => {
    setCurrentZoom(initialZoom);
  }, [initialZoom]);

  useEffect(() => {
    if (hoveredHaloLocationId == null) return;
    if (!regionFilteredAnimals.some((animal) => animal.locationId === hoveredHaloLocationId)) {
      setHoveredHaloLocationId(null);
    }
  }, [hoveredHaloLocationId, regionFilteredAnimals]);

  const handleMapBoundsChange = useCallback(
    (event: any) => {
      const nextZoom = event?.get?.('newZoom');
      if (Number.isFinite(nextZoom)) {
        setCurrentZoom(nextZoom);
        return;
      }

      const mapInstance = yandexMapRef.current;
      if (!mapInstance || typeof mapInstance.getZoom !== 'function') {
        return;
      }

      const mapZoom = mapInstance.getZoom();
      if (Number.isFinite(mapZoom)) {
        setCurrentZoom(mapZoom);
      }
    },
    [yandexMapRef]
  );

  const sortedAnimalsForHalos = useMemo(() => {
    const animals = [...regionFilteredAnimals];
    animals.sort((a, b) => {
      const radiusA = markerHaloRadiusByLocationId[a.locationId] ?? defaultAnimalMarkerHaloRadius;
      const radiusB = markerHaloRadiusByLocationId[b.locationId] ?? defaultAnimalMarkerHaloRadius;
      if (radiusB !== radiusA) {
        return radiusB - radiusA;
      }
      return a.locationId - b.locationId;
    });
    return animals;
  }, [defaultAnimalMarkerHaloRadius, markerHaloRadiusByLocationId, regionFilteredAnimals]);

  const activeHaloLocationId = hoveredHaloLocationId ?? selectedAnimalLocationId ?? haloEditorLocationId;

  const handleHaloMouseEnter = useCallback((locationId: number) => {
    setHoveredHaloLocationId((prev) => (prev === locationId ? prev : locationId));
  }, []);

  const handleHaloMouseLeave = useCallback((locationId: number) => {
    setHoveredHaloLocationId((prev) => (prev === locationId ? null : prev));
  }, []);

  const clustererOptions = useMemo(
    () => ({ preset: 'islands#invertedDarkBlueClusterIcons', groupByCoordinates: false }),
    []
  );

  const markerPlacemarks = useMemo(
    () =>
      regionFilteredAnimals.map((animal) => {
        const iconHref = `/icons/${animal.iconFile}`;

        return (
          <Placemark
            key={animal.locationId}
            geometry={animal.coordinates}
            properties={{
              hintContent: animal.isRedBook
                ? `${animal.name} \u2022 \u041A\u0440\u0430\u0441\u043D\u0430\u044F \u043A\u043D\u0438\u0433\u0430`
                : animal.name
            }}
            options={{
              iconLayout: 'default#image',
              iconImageHref: iconHref,
              iconImageSize: [ANIMAL_MARKER_SIZE, ANIMAL_MARKER_SIZE],
              iconImageOffset: [MARKER_ICON_OFFSET, MARKER_ICON_OFFSET],
              iconShape: {
                type: 'Circle',
                coordinates: [0, 0],
                radius: ANIMAL_MARKER_SIZE / 2
              },
              draggable: isAdminMode
            } as any}
            onDragEnd={(e: any) => onDragEnd(e, animal.locationId)}
            onMouseEnter={() => handleHaloMouseEnter(animal.locationId)}
            onMouseLeave={() => handleHaloMouseLeave(animal.locationId)}
            onClick={() => onSelectAnimal(animal)}
          />
        );
      }),
    [handleHaloMouseEnter, handleHaloMouseLeave, isAdminMode, onDragEnd, onSelectAnimal, regionFilteredAnimals]
  );

  const handleHaloEditorRadiusChange = (radius: number) => {
    if (!haloEditorAnimal) return;
    onAnimalMarkerHaloRadiusChangeForLocation(haloEditorAnimal.locationId, radius);
  };

  const commitHaloEditorInputValue = () => {
    const normalizedInput = haloEditorInputValue.trim();
    if (!normalizedInput) {
      setHaloEditorInputValue(String(haloEditorRadius));
      return;
    }

    const nextValue = Number(normalizedInput);
    if (!Number.isFinite(nextValue)) {
      setHaloEditorInputValue(String(haloEditorRadius));
      return;
    }

    handleHaloEditorRadiusChange(nextValue);
  };

  const handleHaloEditorStep = (direction: 'down' | 'up') => {
    handleHaloEditorRadiusChange(
      getSteppedHaloRadius(
        haloEditorRadius,
        direction,
        minAnimalMarkerHaloRadius,
        maxAnimalMarkerHaloRadius
      )
    );
  };

  const handleHaloEditorReset = () => {
    if (!haloEditorAnimal) return;
    onAnimalMarkerHaloRadiusResetForLocation(haloEditorAnimal.locationId);
  };

  const handleHaloEditorSave = () => {
    if (!haloEditorAnimal) return;
    onSaveAnimalMarkerHaloRadiusForLocation(haloEditorAnimal.locationId);
  };

  const shouldShowHalos = currentZoom >= HALO_VISIBILITY_MIN_ZOOM;
  const shouldShowHaloFill = currentZoom >= HALO_FILL_MIN_ZOOM;

  return (
    <div
      className="map-container"
      style={{
        height: 'calc(100% - var(--app-header-height))',
        top: 'var(--app-header-height)',
        cursor: isAdminMode ? 'crosshair' : 'default'
      }}
    >
      <YMaps query={{ lang: 'ru_RU' }}>
        <Map
          key={selectedRegion || 'none'}
          defaultState={{
            center: selectedRegionConfig?.center || [52.0, 138.5],
            zoom: selectedRegionConfig?.zoom || 6,
            behaviors: ['drag', 'dblClickZoom', 'multiTouch', 'scrollZoom'],
            controls: []
          }}
          width="100%"
          height="100%"
          instanceRef={yandexMapRef}
          onClick={onMapClick}
          onBoundsChange={handleMapBoundsChange}
        >
          {shouldShowHalos &&
            sortedAnimalsForHalos.map((animal, index) => {
              const markerHaloRadius = markerHaloRadiusByLocationId[animal.locationId] ?? defaultAnimalMarkerHaloRadius;
              const isActiveHalo = activeHaloLocationId === animal.locationId;
              const baseZIndex = index + 1;

              return (
                <Circle
                  key={`halo-${animal.locationId}`}
                  geometry={[animal.coordinates, markerHaloRadius]}
                  options={{
                    fillColor: shouldShowHaloFill
                      ? isActiveHalo
                        ? animal.isRedBook
                          ? 'rgba(255, 235, 238, 0.38)'
                          : 'rgba(255, 255, 255, 0.30)'
                        : animal.isRedBook
                          ? 'rgba(255, 235, 238, 0.08)'
                          : 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0)',
                    strokeColor: isActiveHalo
                      ? animal.isRedBook
                        ? 'rgba(198, 40, 40, 0.95)'
                        : 'rgba(20, 57, 40, 0.90)'
                      : animal.isRedBook
                        ? 'rgba(198, 40, 40, 0.35)'
                        : 'rgba(20, 57, 40, 0.25)',
                    strokeWidth: isActiveHalo ? 3 : 1,
                    interactivityModel: 'default#geoObject',
                    zIndex: isActiveHalo ? HALO_ACTIVE_Z_INDEX : baseZIndex
                  } as any}
                  onMouseEnter={() => handleHaloMouseEnter(animal.locationId)}
                  onMouseLeave={() => handleHaloMouseLeave(animal.locationId)}
                />
              );
            })}

          <Clusterer options={clustererOptions}>{markerPlacemarks}</Clusterer>

          {placeLocationCoords && <Placemark geometry={placeLocationCoords} options={{ preset: 'islands#redDotIcon' }} />}
        </Map>
      </YMaps>

      <div className="map-zoom-controls" role="group" aria-label="Масштаб карты">
        <button type="button" className="map-zoom-btn" onClick={() => onMapZoom('in')} aria-label="Приблизить">
          <span className="material-icons" aria-hidden>
            add
          </span>
        </button>
        <button type="button" className="map-zoom-btn" onClick={() => onMapZoom('out')} aria-label="Отдалить">
          <span className="material-icons" aria-hidden>
            remove
          </span>
        </button>
      </div>

      {isAdminMode && isHaloEditorOpen && (
        <section className="map-halo-admin-panel" aria-label="Настройка ореола метки">
          <div className="map-halo-admin-header">
            <div className="map-halo-admin-title">
              <strong>Ореол метки</strong>
              <span>Для выбранного животного. Изменения применяются после сохранения.</span>
            </div>
            <button type="button" className="map-halo-close-btn" onClick={onCloseHaloEditor}>
              Закрыть
            </button>
          </div>

          {!haloEditorAnimal ? (
            <div className="map-halo-admin-note">
              Метка не найдена в текущем регионе. Откройте карточку животного и запустите настройку заново.
            </div>
          ) : (
            <>
              <label className="map-halo-admin-label">
                <span>Животное</span>
                <output>{haloEditorAnimal.name}</output>
              </label>

              <label className="map-halo-admin-label">
                <span>ID точки</span>
                <output>#{haloEditorAnimal.locationId}</output>
              </label>

              <div className="map-halo-admin-note">
                Радиус ореола для этой метки задается в метрах. Подберите значение и нажмите «Сохранить».
              </div>

              <div className="map-halo-presets" role="group" aria-label="Быстрые пресеты радиуса">
                {HALO_RADIUS_PRESET_METERS.map((presetMeters) => (
                  <button
                    key={presetMeters}
                    type="button"
                    className={`map-halo-preset-btn${haloEditorRadius === presetMeters ? ' is-active' : ''}`}
                    onClick={() => handleHaloEditorRadiusChange(presetMeters)}
                    disabled={isHaloEditorSavePending}
                    aria-pressed={haloEditorRadius === presetMeters}
                    title={`Установить ${presetMeters} м`}
                  >
                    {formatHaloPresetLabel(presetMeters)}
                  </button>
                ))}
              </div>

              <label className="map-halo-admin-label" htmlFor="marker-halo-radius-range">
                <span>Радиус ореола</span>
                <output>{haloEditorRadius} м</output>
              </label>

              <input
                id="marker-halo-radius-range"
                type="range"
                min={minAnimalMarkerHaloRadius}
                max={maxAnimalMarkerHaloRadius}
                step={50}
                value={haloEditorRadius}
                onChange={(e) => handleHaloEditorRadiusChange(Number(e.target.value))}
                className="map-halo-admin-slider"
                disabled={isHaloEditorSavePending}
              />

              <div className="map-halo-admin-row">
                <button
                  type="button"
                  className="map-halo-step-btn"
                  onClick={() => handleHaloEditorStep('down')}
                  aria-label="Уменьшить радиус"
                  disabled={isHaloEditorSavePending}
                >
                  -500
                </button>

                <input
                  type="number"
                  min={minAnimalMarkerHaloRadius}
                  max={maxAnimalMarkerHaloRadius}
                  step={50}
                  value={haloEditorInputValue}
                  inputMode="numeric"
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (/^\d*$/.test(nextValue)) {
                      setHaloEditorInputValue(nextValue);
                    }
                  }}
                  onBlur={commitHaloEditorInputValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitHaloEditorInputValue();
                      e.currentTarget.blur();
                      return;
                    }

                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setHaloEditorInputValue(String(haloEditorRadius));
                      e.currentTarget.blur();
                    }
                  }}
                  className="map-halo-admin-input"
                  aria-label="Радиус ореола"
                  disabled={isHaloEditorSavePending}
                />
                <span className="map-halo-admin-unit">м</span>

                <button
                  type="button"
                  className="map-halo-step-btn"
                  onClick={() => handleHaloEditorStep('up')}
                  aria-label="Увеличить радиус"
                  disabled={isHaloEditorSavePending}
                >
                  +500
                </button>
              </div>

              <div className={`map-halo-status ${isHaloEditorDirty ? 'is-dirty' : 'is-saved'}`}>
                {isHaloEditorSavePending
                  ? 'Сохранение...'
                  : isHaloEditorDirty
                    ? 'Есть несохраненные изменения'
                    : 'Изменения сохранены'}
              </div>

              <div className="map-halo-actions">
                <button
                  type="button"
                  className="map-halo-reset-btn"
                  onClick={handleHaloEditorReset}
                  disabled={isHaloEditorSavePending}
                >
                  Сбросить к значению по умолчанию
                </button>
                <button
                  type="button"
                  className="map-halo-save-btn"
                  onClick={handleHaloEditorSave}
                  disabled={isHaloEditorSavePending || !isHaloEditorDirty}
                >
                  {isHaloEditorSavePending ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {isMapEmpty && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'rgba(22, 44, 32, 0.9)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
            maxWidth: 'min(92vw, 520px)',
            pointerEvents: 'none'
          }}
        >
          Животные не найдены. Измените фильтры или выберите другой регион.
        </div>
      )}
    </div>
  );
}

const MapView = memo(MapViewComponent);

export default MapView;

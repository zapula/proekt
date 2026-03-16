// src/App.tsx
import { lazy, Suspense, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Импорты компонентов
import { type IAnimal, type AnimalCategory, type DietType } from './animals'; 
import Header from './Header';
import AuthModal from './AuthModal';
import ProfileModal from './ProfileModal';
import RegionSelector from './RegionSelector';
import MapView from './MapView';
import { Tab, type User, type WikiData } from './types';
import { useAnimalProgress } from './hooks/useAnimalProgress';
import { useGallery } from './hooks/useGallery';
import { useSpeciesCreatorState } from './hooks/useSpeciesCreatorState';
import { useVoice } from './hooks/useVoice';
import { useSearch } from './hooks/useSearch';
import { useDebounce } from './hooks/useDebounce';
import { useFavorites } from './hooks/useFavorites';
import { useMapSpeciesData } from './hooks/useMapSpeciesData';
import { useUrlFilterSync } from './hooks/useUrlFilterSync';
import { useAppContext } from './contexts/AppContext';
import { animalSchema, wikiSchema } from './validation/schemas';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  getRegionByCoordinates,
  isPointInsideRegionBounds,
  isSupportedRegionCode,
  REGION_CONFIG,
  REGION_NEARBY,
  REGION_SHOWCASE,
  SUPPORTED_REGION_CODES,
  type RegionCode,
} from './regions';
import {
  DEFAULT_ANIMAL_MARKER_HALO_RADIUS,
  LANDING_SESSION_LOCK_KEY,
  MAX_ANIMAL_MARKER_HALO_RADIUS,
  MIN_ANIMAL_MARKER_HALO_RADIUS,
  clampAnimalMarkerHaloRadius
} from './constants/map';
import { createAuthHeaders } from './utils/auth';
import { apiUrl } from './utils/api';
import {
  ADMIN_SESSION_EXPIRED_MESSAGE,
  createApiRequestError,
  getApiRequestErrorMessage,
  isAdminSessionExpiredError
} from './utils/apiErrors';
import { fetchWithRetry } from './utils/fetchWithRetry';
import { normalizeModelUrl, pickPreferredModelUrl, toFolderName } from './utils/speciesUtils';
import './App.css';

interface LandingFeaturedAnimal {
  id: number;
  locationId: number;
  name: string;
  isRedBook: boolean;
  image: string;
  fallbackIcon: string;
}

interface RegionSelectorDetails {
  code: RegionCode;
  label: string;
  subtitle: string;
  photoFolder: string;
  speciesCount: number;
  redBookCount: number | null;
  nearbyRegions: RegionCode[];
}

type AppPage = 'home' | 'about';

const AnimalCard = lazy(() => import('./AnimalCard'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const Landing = lazy(() => import('./components/Landing'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));
function App() {
  // ============================================
  // Р”РђРќРќР«Р•
  // ============================================
  const { mapAnimals, setMapAnimals, speciesList, setSpeciesList, isDataLoading, dataLoadError, fetchData } = useMapSpeciesData();
  const [isWikiLoading, setIsWikiLoading] = useState(false);

  const {
    user,
    setUser,
    selectedAnimal,
    setSelectedAnimal,
    selectedRegion,
    setSelectedRegion,
    isAdminMode,
    setIsAdminMode
  } = useAppContext();
  const hasAuthSession = Boolean(user);

  // ============================================
  // ПОИСК И ФИЛЬТРЫ
  // ============================================
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { filters, setFilters, filteredAnimals } = useSearch(mapAnimals, debouncedSearchTerm);
  const [regionSearchTerm, setRegionSearchTerm] = useState('');
  const debouncedRegionSearchTerm = useDebounce(regionSearchTerm, 300);
  const activeCategory = filters.category;
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Game);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  // ============================================
  // СОСТОЯНИЕ ТАМАГОЧИ
  // ============================================
  const {
    satiety,
    setSatiety,
    isAdult,
    setIsAdult,
    timesGrown,
    setTimesGrown,
    loadProgress,
    saveProgressToDb,
    resetProgress
  } = useAnimalProgress({
    user,
    selectedAnimal
  });
  const [hasPhoto, setHasPhoto] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [lastAction, setLastAction] = useState<'feed' | 'drink' | null>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);

  // ============================================
  // КАРТА
  // ============================================
  const yandexMapRef = useRef<any>(null);
  const [isHaloEditorOpen, setIsHaloEditorOpen] = useState(false);
  const [haloEditorLocationId, setHaloEditorLocationId] = useState<number | null>(null);
  const [dirtyMarkerHaloLocationIds, setDirtyMarkerHaloLocationIds] = useState<Record<number, true>>({});
  const [savingMarkerHaloLocationIds, setSavingMarkerHaloLocationIds] = useState<Record<number, true>>({});
  const markerHaloRadiusByLocationId = useMemo(
    () =>
      mapAnimals.reduce<Record<number, number>>((acc, animal) => {
        if (animal.markerHaloRadius == null) {
          return acc;
        }
        const radius = Number(animal.markerHaloRadius);
        if (Number.isFinite(radius)) {
          acc[animal.locationId] = clampAnimalMarkerHaloRadius(radius);
        }
        return acc;
      }, {}),
    [mapAnimals]
  );
  const [appPage, setAppPage] = useState<AppPage>(() => (
    typeof window !== 'undefined' && window.location.pathname.startsWith('/about') ? 'about' : 'home'
  ));
  const homeUrlRef = useRef(
    typeof window !== 'undefined' && !window.location.pathname.startsWith('/about')
      ? `${window.location.pathname}${window.location.search}` || '/'
      : '/'
  );
  const [isLandingOpen, setIsLandingOpen] = useState(true);
  const [landingFeaturedAnimals, setLandingFeaturedAnimals] = useState<LandingFeaturedAnimal[]>([]);
  const [landingArrows, setLandingArrows] = useState({ canPrev: false, canNext: false });
  const landingPhotoCacheRef = useRef<globalThis.Map<number, string>>(new globalThis.Map());
  const landingCreaturesRef = useRef<HTMLElement | null>(null);
  const landingCardsRef = useRef<HTMLDivElement | null>(null);
  const isAboutPageOpen = appPage === 'about';
  const isHomePage = appPage === 'home';

  // ============================================
  // МОДАЛЬНЫЕ ОКНА
  // ============================================
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const setActiveCategory = useCallback(
    (category: AnimalCategory) => {
      setFilters((prev) => ({ ...prev, category }));
    },
    [setFilters]
  );
  const setDietFilter = useCallback(
    (diet: DietType | 'all') => {
      setFilters((prev) => ({ ...prev, diet }));
    },
    [setFilters]
  );
  const setRedBookOnly = useCallback(
    (redBook: boolean) => {
      setFilters((prev) => ({ ...prev, redBook }));
    },
    [setFilters]
  );

  useUrlFilterSync({
    selectedRegion,
    activeCategory,
    dietFilter: filters.diet,
    redBookOnly: filters.redBook,
    searchTerm,
    isEnabled: isHomePage,
    setSelectedRegion,
    setIsLandingOpen,
    setActiveCategory,
    setDietFilter,
    setRedBookOnly,
    setSearchTerm,
    isSupportedRegionCode
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isHomePage) {
      homeUrlRef.current = `${window.location.pathname}${window.location.search}` || '/';
    }
  }, [activeCategory, filters.diet, filters.redBook, isHomePage, searchTerm, selectedRegion]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const isAboutRoute = window.location.pathname.startsWith('/about');
      if (!isAboutRoute) {
        homeUrlRef.current = `${window.location.pathname}${window.location.search}` || '/';
      }
      setAppPage(isAboutRoute ? 'about' : 'home');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // ============================================
  // АДМИН-ПАНЕЛЬ
  // ============================================
  const {
    placeLocationCoords,
    setPlaceLocationCoords,
    selectedSpeciesId,
    setSelectedSpeciesId,
    isSpeciesCreatorOpen,
    setIsSpeciesCreatorOpen,
    newSpeciesForm,
    setNewSpeciesForm,
    isFolderTouched,
    setIsFolderTouched,
    speciesFormError,
    setSpeciesFormError,
    isSpeciesSaving,
    setIsSpeciesSaving,
    iconFile,
    setIconFile,
    photoFiles,
    setPhotoFiles
  } = useSpeciesCreatorState();

  // === РЕДАКТОР ВИКИ ===
  const [isEditingWiki, setIsEditingWiki] = useState(false);
  const [wikiData, setWikiData] = useState<WikiData>({
    text: '',
    habitat: '',
    food: '',
    size: '',
    trait: ''
  });

  // === ОЗВУЧКА ===
  const {
    isSpeaking,
    voiceError,
    stopSpeech,
    toggleSpeech: toggleSpeechInternal
  } = useVoice({
    wikiText: wikiData.text
  });

  // Загрузка моделей (бейби/взрослая)
  const [modelChildFile, setModelChildFile] = useState<File | null>(null);
  const [modelAdultFile, setModelAdultFile] = useState<File | null>(null);
  const [isModelUploading, setIsModelUploading] = useState(false);
  const [modelUploadError, setModelUploadError] = useState<string | null>(null);
  const adminSessionNoticeAtRef = useRef(0);

  const handleAdminSessionExpired = useCallback(() => {
    const now = Date.now();
    setUser(null);
    setIsAdminMode(false);
    setIsHaloEditorOpen(false);
    setHaloEditorLocationId(null);
    setIsSpeciesCreatorOpen(false);
    setPlaceLocationCoords(null);
    setIsAuthOpen(true);

    if (now - adminSessionNoticeAtRef.current > 4000) {
      adminSessionNoticeAtRef.current = now;
      toast.error(ADMIN_SESSION_EXPIRED_MESSAGE);
    }
  }, [
    setIsAdminMode,
    setIsAuthOpen,
    setIsHaloEditorOpen,
    setHaloEditorLocationId,
    setIsSpeciesCreatorOpen,
    setPlaceLocationCoords,
    setUser
  ]);

  const handleAdminRequestError = useCallback(
    (
      error: unknown,
      fallbackMessage: string,
      options?: {
        setInlineError?: (message: string) => void;
        showToast?: boolean;
      }
    ) => {
      const isExpiredSession = isAdminSessionExpiredError(error);
      const message = isExpiredSession
        ? ADMIN_SESSION_EXPIRED_MESSAGE
        : getApiRequestErrorMessage(error, fallbackMessage);

      if (isExpiredSession) {
        handleAdminSessionExpired();
      } else if (options?.showToast ?? !options?.setInlineError) {
        toast.error(message);
      }

      options?.setInlineError?.(message);
      return message;
    },
    [handleAdminSessionExpired]
  );

  const selectedModelUrl = useMemo(() => {
    if (!selectedAnimal) return '';

    const fromSelected = pickPreferredModelUrl(selectedAnimal, isAdult);
    if (fromSelected) return fromSelected;

    const fallbackSpecies = speciesList.find((species) => species.id === selectedAnimal.id);
    if (fallbackSpecies) {
      return pickPreferredModelUrl(fallbackSpecies, isAdult);
    }

    return '';
  }, [selectedAnimal, isAdult, speciesList]);
  const hasSelectedModel = Boolean(selectedModelUrl);

  // ============================================
  // ОБРАБОТЧИКИ - ГАЛЕРЕЯ
  // ============================================
  const {
    galleryUploadFiles,
    setGalleryUploadFiles,
    galleryUploadError,
    setGalleryUploadError,
    isGalleryUploading,
    galleryImages,
    galleryPreviewUrls,
    clearGalleryImages,
    fetchGalleryImages,
    handleUploadGalleryPhotos,
    handleDeleteGalleryPhoto
  } = useGallery({
    selectedAnimal,
    isAuthenticated: hasAuthSession,
    onAnimalMetaUpdate: ({ photoCount, imageFolder }) => {
      setSelectedAnimal((prev) => (prev ? { ...prev, photoCount, imageFolder } : prev));
    },
    refreshMapData: fetchData,
    onAuthorizationExpired: handleAdminSessionExpired
  });

  const { toggleFavorite, isFavorite } = useFavorites(user);

  useEffect(() => {
    const controller = new AbortController();

    const restoreSession = async () => {
      try {
        const res = await fetchWithRetry(apiUrl('/api/auth/me'), {
          signal: controller.signal
        });

        if (controller.signal.aborted) return;

        if (res.status === 401 || res.status === 403) {
          setUser(null);
          setIsAdminMode(false);
          return;
        }

        if (!res.ok) {
          throw new Error(`auth_me_failed_${res.status}`);
        }

        const data = await res.json();
        const responseUser = data?.user ?? data;
        if (!Number.isFinite(Number(responseUser?.id)) || !responseUser?.email) {
          throw new Error('auth_me_invalid_response');
        }

        setUser({
          id: Number(responseUser.id),
          email: String(responseUser.email),
          role: String(responseUser.role || 'user')
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Session restore failed:', error);
        setUser(null);
        setIsAdminMode(false);
      }
    };

    void restoreSession();
    return () => controller.abort();
  }, [setIsAdminMode, setUser]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const selectedAnimalName = selectedAnimal?.name;

  // ЗАГРУЗКА ДАННЫХ ВИКИ ПРИ ОТКРЫТИИ ЖИВОТНОГО
  useEffect(() => {
    if (!selectedAnimalName) {
      setIsWikiLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsEditingWiki(false);
    setIsWikiLoading(true);
    // Сброс пока не придёт ответ с сервера
    setWikiData({ text: '', habitat: '', food: '', size: '', trait: '' });

    const encodedName = encodeURIComponent(selectedAnimalName);

    const loadWiki = async () => {
      try {
        const res = await fetchWithRetry(apiUrl(`/api/species/${encodedName}`), {
          signal: abortController.signal
        });
        if (!res.ok) {
          throw new Error(`wiki_load_failed_${res.status}`);
        }
        const data = await res.json();
        if (abortController.signal.aborted) return;
        if (data && data.name) {
          setWikiData({
            text: data.wiki_text || '',
            habitat: data.passport_habitat || '',
            food: data.passport_food || '',
            size: data.passport_size || '',
            trait: data.passport_trait || ''
          });
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('Ошибка загрузки вики:', err);
        toast.error('Не удалось загрузить информацию о животном');
      } finally {
        if (!abortController.signal.aborted) {
          setIsWikiLoading(false);
        }
      }
    };

    void loadWiki();
    return () => abortController.abort();
  }, [selectedAnimalName]);

  useEffect(() => {
    if (!selectedAnimal) {
      clearGalleryImages();
      return;
    }
    if (activeTab === Tab.Gallery) {
      fetchGalleryImages(selectedAnimal.id);
    }
  }, [activeTab, clearGalleryImages, fetchGalleryImages, selectedAnimal]);

  // АВТОПУСК ВИДЕО при смене src
  useEffect(() => {
    if (activeVideoSrc && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        setIsVideoPlaying(false);
      });
    }
  }, [activeVideoSrc]);

  // ============================================
  // ОБРАБОТЧИКИ - АДМИН
  // ============================================
  const handleMapClick = useCallback((e: any) => {
    if (!isAdminMode) return; 
    const coords = e.get('coords'); 
    setPlaceLocationCoords(coords); 
    setSelectedSpeciesId(""); 
  }, [isAdminMode]);

  /**
   * Создает новую точку вида на карте.
   * @param speciesId ID РІРёРґР°.
   * @param coords Координаты [lat, lng].
   * @returns true если локация создана, иначе false.
   */
  const createLocation = useCallback(async (speciesId: number, coords: number[]) => {
    if (!hasAuthSession) {
      toast.error('Требуется авторизация администратора');
      return false;
    }

    try {
      const res = await fetchWithRetry(apiUrl('/api/locations'), {
        method: 'POST',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          species_id: speciesId,
          lat: coords[0],
          lng: coords[1]
        })
      });

      if (!res.ok) {
        throw await createApiRequestError(res, 'Не удалось добавить точку на карту.');
      }

      toast.success('Точка успешно добавлена на карту!', { icon: '📍' });
      setPlaceLocationCoords(null);
      void fetchData();
      return true;
    } catch (error) {
      handleAdminRequestError(error, 'Не удалось добавить точку на карту.');
      return false;
    }
  }, [fetchData, handleAdminRequestError, hasAuthSession, setPlaceLocationCoords]);

  const handleSaveLocation = useCallback(async () => {
    if (!placeLocationCoords) {
      toast.error("Сначала кликните на карту");
      return;
    }
    if (!selectedSpeciesId) {
      toast.error("Выберите вид животного");
      return;
    }
    await createLocation(parseInt(selectedSpeciesId, 10), placeLocationCoords);
  }, [createLocation, placeLocationCoords, selectedSpeciesId]);

  const handleDragEnd = useCallback(async (e: any, locationId: number) => {
    if (!hasAuthSession) {
      toast.error('Требуется авторизация администратора');
      return;
    }

    const newCoords = e.get('target').geometry.getCoordinates();
    const [newLat, newLng] = newCoords;

    try {
      const res = await fetchWithRetry(apiUrl(`/api/locations/${locationId}`), {
        method: 'PUT',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ lat: newLat, lng: newLng })
      });

      if (!res.ok) {
        throw await createApiRequestError(res, 'Не удалось переместить метку.');
      }

      toast.success('Метка перемещена!', { icon: '📍' });
      setMapAnimals((prev) => prev.map((animal) =>
        animal.locationId === locationId ? { ...animal, coordinates: [newLat, newLng] } : animal
      ));
    } catch (error) {
      handleAdminRequestError(error, 'Не удалось переместить метку.');
      void fetchData();
    }
  }, [fetchData, handleAdminRequestError, hasAuthSession, setMapAnimals]);

  const handleDeleteLocation = useCallback(async () => {
    if (!selectedAnimal) return;
    if (!hasAuthSession) {
      toast.error('Требуется авторизация администратора');
      return;
    }
    const confirmDelete = window.confirm(`Вы уверены, что хотите удалить эту точку (${selectedAnimal.name})?`);
    if (!confirmDelete) return;

    try {
      const res = await fetchWithRetry(apiUrl(`/api/locations/${selectedAnimal.locationId}`), {
        method: 'DELETE',
        headers: createAuthHeaders()
      });

      if (!res.ok) {
        throw await createApiRequestError(res, 'Не удалось удалить точку.');
      }

      toast.success('Точка удалена', { icon: '🗑️' });
      setSelectedAnimal(null);
      void fetchData();
    } catch (error) {
      handleAdminRequestError(error, 'Не удалось удалить точку.');
    }
  }, [fetchData, handleAdminRequestError, hasAuthSession, selectedAnimal, setSelectedAnimal]);

  const uploadFile = async (url: string, file: File) => {
    if (!hasAuthSession) {
      throw new Error('unauthorized');
    }
    const form = new FormData();
    form.append('file', file);
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: createAuthHeaders(),
      body: form
    });
    if (!res.ok) {
      throw await createApiRequestError(res, 'Ошибка загрузки файла.');
    }
    return res.json();
  };

  const uploadPhotos = async (folder: string, files: File[]) => {
    if (!hasAuthSession) {
      throw new Error('unauthorized');
    }
    if (files.length === 0) return { folder, count: 0 };
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    const res = await fetchWithRetry(apiUrl(`/api/uploads/photos?folder=${encodeURIComponent(folder)}`), {
      method: 'POST',
      headers: createAuthHeaders(),
      body: form
    });
    if (!res.ok) {
      throw await createApiRequestError(res, 'Ошибка загрузки фото.');
    }
    return res.json();
  };

  const handleCreateSpecies = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSpeciesSaving) return;
    setSpeciesFormError(null);

    const baseValidation = animalSchema.omit({ coordinates: true }).safeParse({
      name: newSpeciesForm.name,
      category: newSpeciesForm.category,
      diet: newSpeciesForm.diet,
      isRedBook: newSpeciesForm.isRedBook
    });
    if (!baseValidation.success) {
      setSpeciesFormError(baseValidation.error.issues[0]?.message || 'Проверьте введённые данные');
      return;
    }

    if (placeLocationCoords && placeLocationCoords.length === 2) {
      const coordsValidation = animalSchema.shape.coordinates.safeParse([
        Number(placeLocationCoords[0]),
        Number(placeLocationCoords[1])
      ]);
      if (!coordsValidation.success) {
        setSpeciesFormError(coordsValidation.error.issues[0]?.message || 'Некорректные координаты');
        return;
      }
    }

    if (!iconFile) {
      setSpeciesFormError('Выберите файл иконки.');
      return;
    }
    if (!hasAuthSession) {
      setSpeciesFormError('Требуется авторизация администратора.');
      return;
    }
    const folderInput = newSpeciesForm.imageFolder.trim() || toFolderName(newSpeciesForm.name);

    try {
      setIsSpeciesSaving(true);
      const checkRes = await fetchWithRetry(apiUrl(`/api/uploads/check?name=${encodeURIComponent(newSpeciesForm.name)}&folder=${encodeURIComponent(folderInput)}`), {
        headers: createAuthHeaders()
      });
      if (!checkRes.ok) {
        throw await createApiRequestError(checkRes, 'Не удалось проверить название вида.');
      }
      const check = await checkRes.json();
      if (check.nameExists) {
        setSpeciesFormError('Такой вид уже существует. Измените название.');
        return;
      }
      if (check.folderExists && check.folderUsedBySpecies) {
        setSpeciesFormError('Папка с фото уже используется другим видом. Укажите другое имя папки.');
        return;
      }

      const iconData = await uploadFile(apiUrl('/api/uploads/icon'), iconFile);
      const photosData = await uploadPhotos(check.folder || folderInput, photoFiles);

      const payload = {
        name: newSpeciesForm.name,
        category: newSpeciesForm.category,
        diet: newSpeciesForm.diet,
        is_red_book: newSpeciesForm.isRedBook,
        icon_file: iconData.file,
        model_url: '',
        image_folder: photosData.folder
      };

      const res = await fetchWithRetry(apiUrl('/api/species'), {
        method: 'POST',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw await createApiRequestError(res, 'Не удалось создать вид.');
      }

      const created = await res.json();
      toast.success(`Вид "${newSpeciesForm.name}" создан!`, { icon: '✨' });
      setIsSpeciesCreatorOpen(false);
      let didCreateLocation = false;
      if (created?.id) {
        setSelectedSpeciesId(String(created.id));
        if (placeLocationCoords) {
          didCreateLocation = await createLocation(created.id, placeLocationCoords);
        } else {
          toast('Вид создан. Кликните на карту и нажмите "Поставить".', { icon: '📌' });
        }
      }
      setNewSpeciesForm({ name: '', category: 'mammal', diet: 'herbivore', isRedBook: false, imageFolder: '' });
      setIsFolderTouched(false);
      setIconFile(null);
      setPhotoFiles([]);
      if (!didCreateLocation) void fetchData();
    } catch (error) {
      handleAdminRequestError(error, 'Не удалось создать вид.', { setInlineError: setSpeciesFormError });
    } finally {
      setIsSpeciesSaving(false);
    }
  }, [
    createLocation,
    fetchData,
    handleAdminRequestError,
    hasAuthSession,
    iconFile,
    isSpeciesSaving,
    newSpeciesForm,
    photoFiles,
    placeLocationCoords,
    setIconFile,
    setIsFolderTouched,
    setIsSpeciesCreatorOpen,
    setIsSpeciesSaving,
    setNewSpeciesForm,
    setPhotoFiles,
    setSelectedSpeciesId,
    setSpeciesFormError,
    uploadFile,
    uploadPhotos
  ]);
  // --- СОХРАНЕНИЕ ВИКИ ---
  const handleSaveWiki = useCallback(async () => {
    if (!selectedAnimal) return;
    if (!hasAuthSession) {
      toast.error('Требуется авторизация администратора');
      return;
    }

    const validation = wikiSchema.safeParse(wikiData);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || 'Проверьте поля энциклопедии');
      return;
    }

    const encodedName = encodeURIComponent(selectedAnimal.name);

    try {
      const res = await fetchWithRetry(apiUrl(`/api/species/${encodedName}`), {
        method: 'PUT',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          wiki_text: validation.data.text,
          habitat: validation.data.habitat,
          food: validation.data.food,
          size: validation.data.size,
          trait: validation.data.trait,
          category: selectedAnimal.category,
          diet: selectedAnimal.diet
        })
      });

      if (!res.ok) {
        throw await createApiRequestError(res, 'Ошибка сохранения энциклопедии.');
      }

      setIsEditingWiki(false);
      toast.success('Энциклопедия обновлена!');
    } catch (error) {
      console.error('Ошибка сохранения энциклопедии:', error);
      handleAdminRequestError(error, 'Ошибка сохранения энциклопедии.');
    }
  }, [handleAdminRequestError, hasAuthSession, selectedAnimal, wikiData]);

  // ============================================
  // ОБРАБОТЧИКИ - ТАМАГОЧИ
  // ============================================
  const handleAction = useCallback(async (type: 'gallery' | 'voice') => {
    if (!user) return;
    try {
      const res = await fetchWithRetry(apiUrl('/api/action'), {
         method: 'POST',
         headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
         body: JSON.stringify({ type })
      });
      const data = await res.json();
        if (data.newAchievements && data.newAchievements.length > 0) {
           data.newAchievements.forEach((ach: any) => {
              toast(`🎉 Достижение: ${ach.title}`, { 
                 duration: 5000,
                 icon: '🏆', 
                 style: { 
                   border: '1px solid #fbc02d', 
                   background: '#fff9c4',       
                   color: '#000000',            
                   fontWeight: '500'
                 } 
              });
           });
           confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    } catch (e) {
      console.error('Не удалось записать действие пользователя:', e);
    }
 }, [user]);

  // ============================================
  // ОБРАБОТЧИКИ - ЖИВОТНЫЕ
  // ============================================
  const handleSelect = useCallback((animal: IAnimal) => {
    stopSpeech();
    setSelectedAnimal(animal);
    setActiveTab(Tab.Game);
    setHasPhoto(false); 
    setIsVideoPlaying(false);
    setLastAction(null);
    setActiveVideoSrc(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
    if (user) loadProgress(animal.locationId);
    else resetProgress();
  }, [loadProgress, resetProgress, stopSpeech, user]);

  const careForAnimal = (amount: number) => {
    if (isAdult) return;
    const newSatiety = Math.min(100, satiety + amount);
    setSatiety(newSatiety);
    saveProgressToDb(newSatiety, isAdult, timesGrown);
  };

  // --- ВИДЕО ЛОГИКА ---
  const playActionVideo = (action: 'feed' | 'drink') => {
    if (isVideoPlaying || isAdult || satiety >= 100) return;
    if (lastAction === action) return;

    const folder = selectedAnimal?.imageFolder;
    if (!folder) return;

    const filename = action === 'feed' ? 'feed.mp4' : 'drink.mp4';
    const src = `/videos/${folder}/${filename}`;

    setActiveVideoSrc(src);
    setIsVideoPlaying(true);
    setLastAction(action);

    const amount = action === 'feed' ? 15 : 10;
    careForAnimal(amount);
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
  };

  const uploadSpeciesModel = async (type: 'child' | 'adult', file: File) => {
    if (!selectedAnimal) return;
    if (!hasAuthSession) {
      setModelUploadError('Требуется авторизация администратора.');
      return;
    }
    setModelUploadError(null);
    setIsModelUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetchWithRetry(apiUrl(`/api/species/${selectedAnimal.id}/model/${type}`), {
        method: 'POST',
        headers: createAuthHeaders(),
        body: form
      });
      if (!res.ok) {
        throw await createApiRequestError(res, 'Ошибка загрузки модели.');
      }
      const data = await res.json();
      setSelectedAnimal((prev) => {
        if (!prev) return prev;
        if (type === 'child') return { ...prev, modelUrlChild: normalizeModelUrl(data.url) };
        return { ...prev, modelUrlAdult: normalizeModelUrl(data.url) };
      });
      void fetchData();
      toast.success(type === 'child' ? 'Модель детёныша загружена' : 'Модель взрослого загружена');
    } catch (error) {
      handleAdminRequestError(error, 'Ошибка загрузки модели.', { setInlineError: setModelUploadError });
    } finally {
      setIsModelUploading(false);
    }
  };

  const clearSpeciesModel = async (type: 'child' | 'adult') => {
    if (!selectedAnimal) return;
    if (!hasAuthSession) {
      setModelUploadError('Требуется авторизация администратора.');
      return;
    }
    setModelUploadError(null);
    setIsModelUploading(true);
    try {
      const res = await fetchWithRetry(apiUrl(`/api/species/${selectedAnimal.id}/model/${type}`), {
        method: 'DELETE',
        headers: createAuthHeaders()
      });
      if (!res.ok) {
        throw await createApiRequestError(res, 'Ошибка очистки модели.');
      }
      setSelectedAnimal((prev) => {
        if (!prev) return prev;
        if (type === 'child') return { ...prev, modelUrlChild: '' };
        return { ...prev, modelUrlAdult: '' };
      });
      void fetchData();
      toast.success(type === 'child' ? 'Модель детёныша очищена' : 'Модель взрослого очищена');
    } catch (error) {
      handleAdminRequestError(error, 'Ошибка очистки модели.', { setInlineError: setModelUploadError });
    } finally {
      setIsModelUploading(false);
    }
  };

  const handleTakePhoto = () => {
    toast.success("Фото сохранено в журнал!", { icon: '📸' });
    setHasPhoto(true);
  };

  const handleEvolution = () => {
    if (!user) { 
        toast('Сначала нужно войти в аккаунт!', { icon: '🔒' });
        setIsAuthOpen(true); 
        return; 
    }
    let newIsAdult = isAdult;
    let newSatiety = satiety;
    let newTimesGrown = timesGrown;
    
    if (!isAdult) {
      if (satiety >= 100) { 
          newIsAdult = true; 
          setIsAdult(true); 
          toast.success("Животное выросло! Теперь вы можете сделать фото.", { duration: 4000, icon: '🌟' });
      }
    } else {
      newIsAdult = false; 
      newSatiety = 0; 
      newTimesGrown += 1;
      setIsAdult(false); 
      setSatiety(0); 
      setTimesGrown(newTimesGrown);
      setHasPhoto(false);
      setIsVideoPlaying(false);
      setLastAction(null);
      setActiveVideoSrc(null);
      
      toast.success(
        `Вы выпустили животное в лес!\nВсего выращено: ${newTimesGrown}`, 
        { 
          duration: 5000, 
          icon: '🌲',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        }
      );
    }
    saveProgressToDb(newSatiety, newIsAdult, newTimesGrown);
  };

  const toggleSpeech = useCallback(() => {
    if (!isSpeaking && selectedAnimal) {
      handleAction('voice');
    }
    void toggleSpeechInternal();
  }, [handleAction, isSpeaking, selectedAnimal, toggleSpeechInternal]);

  const getFoodInfo = (diet: DietType) => {
    switch (diet) {
      case 'carnivore': return { icon: '🥩', text: 'Питается: мясом' };
      case 'herbivore': return { icon: '🌿', text: 'Питается: растениями' };
      case 'omnivore': return { icon: '🥩🥕', text: 'Питается: мясом и растениями' }; 
    }
  };

  const selectedRegionConfig = useMemo(
    () => (selectedRegion ? REGION_CONFIG[selectedRegion] : null),
    [selectedRegion]
  );

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filterMenuRef.current) return;
      if (!filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterMenuOpen]);

  useEffect(() => {
    if (!selectedRegion) {
      setIsFilterMenuOpen(false);
    }
  }, [selectedRegion]);

  const regionFilteredAnimals = useMemo(() => {
    if (!selectedRegionConfig) return [];
    return filteredAnimals.filter((animal) => isPointInsideRegionBounds(animal.coordinates, selectedRegionConfig.bounds));
  }, [filteredAnimals, selectedRegionConfig]);

  const exportFilteredAnimalsToCsv = useCallback(() => {
    if (!selectedRegion || regionFilteredAnimals.length === 0) {
      toast('Нет данных для экспорта', { icon: 'ℹ️' });
      return;
    }

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const headers = ['Название', 'Категория', 'Питание', 'Регион'];
    const rows = regionFilteredAnimals.map((animal) => [
      animal.name,
      animal.category === 'mammal' ? 'Млекопитающее' : 'Птица',
      animal.diet,
      REGION_CONFIG[selectedRegion].label
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `animals-${selectedRegion}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV-файл экспортирован');
  }, [regionFilteredAnimals, selectedRegion]);

  const regionSelectorRegions = useMemo<RegionSelectorDetails[]>(() => {
    return SUPPORTED_REGION_CODES.map((regionCode) => {
      const regionAnimals = mapAnimals.filter((animal) =>
        isPointInsideRegionBounds(animal.coordinates, REGION_CONFIG[regionCode].bounds)
      );
      const uniqueSpecies = new Set(regionAnimals.map((animal) => animal.id));
      const redBookSpecies = new Set(
        regionAnimals.filter((animal) => Boolean(animal.isRedBook)).map((animal) => animal.id)
      );

      return {
        code: regionCode,
        label: REGION_CONFIG[regionCode].label,
        subtitle: REGION_SHOWCASE[regionCode].subtitle,
        photoFolder: REGION_SHOWCASE[regionCode].photoFolder,
        speciesCount: uniqueSpecies.size,
        redBookCount: redBookSpecies.size,
        nearbyRegions: REGION_NEARBY[regionCode]
      };
    });
  }, [mapAnimals]);

  const landingStats = useMemo(() => {
    return [
      { label: 'Регионов', value: SUPPORTED_REGION_CODES.length, icon: '/icons/stats/regions.svg', color: '#2196f3' },
      { label: 'Точек наблюдения', value: mapAnimals.length, icon: '/icons/stats/locations.svg', color: '#4caf50' },
      { label: 'Видов животных', value: speciesList.length, icon: '/icons/stats/species.svg', color: '#ff9800' }
    ];
  }, [mapAnimals.length, speciesList.length]);

  useEffect(() => {
    if (!isLandingOpen) return;

    if (mapAnimals.length === 0) {
      setLandingFeaturedAnimals([]);
      return;
    }

    const shuffledLocations = [...mapAnimals].sort(() => Math.random() - 0.5);
    const uniqueSpeciesLocationMap = new globalThis.Map<number, IAnimal>();
    shuffledLocations.forEach((location) => {
      if (!uniqueSpeciesLocationMap.has(location.id)) {
        uniqueSpeciesLocationMap.set(location.id, location);
      }
    });
    const pickedLocations = Array.from(uniqueSpeciesLocationMap.values()).slice(
      0,
      Math.min(12, uniqueSpeciesLocationMap.size)
    );
    const speciesById = new globalThis.Map(speciesList.map((species) => [species.id, species]));
    let cancelled = false;

    const loadLandingFeatured = async () => {
      const uniqueSpeciesIds = Array.from(new Set(pickedLocations.map((location) => location.id)));

      await Promise.all(
        uniqueSpeciesIds.map(async (speciesId) => {
          if (landingPhotoCacheRef.current.has(speciesId)) return;

          const locationForIcon = pickedLocations.find((location) => location.id === speciesId);
          const speciesForIcon = speciesById.get(speciesId);
          const iconFile = locationForIcon?.iconFile || speciesForIcon?.iconFile || '';
          const fallbackIcon = iconFile ? `/icons/${iconFile}` : '/favicon-512.png';
          let image = fallbackIcon;

          try {
            const res = await fetchWithRetry(apiUrl(`/api/species/${speciesId}/photos`));
            if (res.ok) {
              const data = await res.json();
              const files: string[] = Array.isArray(data.files) ? data.files : [];
              if (files.length > 0) {
                const sortedFiles = [...files].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
                const randomIndex = Math.floor(Math.random() * sortedFiles.length);
                image = `/images/${data.folder}/${sortedFiles[randomIndex]}`;
              }
            }
          } catch (error) {
            // keep icon fallback
          }

          landingPhotoCacheRef.current.set(speciesId, image);
        })
      );

      const cards = pickedLocations.map((location) => {
        const species = speciesById.get(location.id);
        const iconFile = location.iconFile || species?.iconFile || '';
        const fallbackIcon = iconFile ? `/icons/${iconFile}` : '/favicon-512.png';
        const image = landingPhotoCacheRef.current.get(location.id) || fallbackIcon;
        const isRedBook = Boolean(location.isRedBook || species?.isRedBook);

        return {
          id: location.id,
          locationId: location.locationId,
          name: location.name,
          isRedBook,
          image,
          fallbackIcon
        };
      });

      if (!cancelled) {
        const preparedCards = cards.filter((card): card is LandingFeaturedAnimal => card !== null);
        setLandingFeaturedAnimals(preparedCards);
      }
    };

    loadLandingFeatured().catch(() => {
      if (!cancelled) setLandingFeaturedAnimals([]);
    });

    return () => {
      cancelled = true;
    };
  }, [isLandingOpen, mapAnimals, speciesList]);

  // ============================================
  // ОБРАБОТЧИКИ - ЛЕНДИНГ
  // ============================================
  const navigateToPage = useCallback((nextPage: AppPage, historyMode: 'push' | 'replace' = 'push') => {
    if (typeof window !== 'undefined') {
      const updateHistory = historyMode === 'replace' ? window.history.replaceState : window.history.pushState;

      if (nextPage === 'about') {
        if (!window.location.pathname.startsWith('/about')) {
          homeUrlRef.current = `${window.location.pathname}${window.location.search}` || '/';
          updateHistory.call(window.history, null, '', '/about');
        }
      } else {
        const targetHomeUrl = homeUrlRef.current.startsWith('/about') ? '/' : homeUrlRef.current || '/';
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl !== targetHomeUrl) {
          updateHistory.call(window.history, null, '', targetHomeUrl);
        }
      }
    }

    setAppPage(nextPage);
  }, []);

  const closeLanding = useCallback(() => {
    setIsLandingOpen(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LANDING_SESSION_LOCK_KEY, '1');
    }
  }, []);

  const resetSearchFilters = useCallback(() => {
    setActiveCategory('all');
    setDietFilter('all');
    setRedBookOnly(false);
    setSearchTerm('');
    setRegionSearchTerm('');
    setIsFilterMenuOpen(false);
  }, [setActiveCategory, setDietFilter, setRedBookOnly, setSearchTerm]);

  const applyFiltersForAnimal = useCallback((animal: IAnimal) => {
    setActiveCategory(animal.category);
    setDietFilter(animal.diet);
    setRedBookOnly(Boolean(animal.isRedBook));
    setSearchTerm(animal.name);
    setRegionSearchTerm('');
    setIsFilterMenuOpen(false);
  }, [setActiveCategory, setDietFilter, setRedBookOnly, setSearchTerm]);

  const openAboutPage = useCallback(() => {
    setSelectedAnimal(null);
    setPlaceLocationCoords(null);
    navigateToPage('about');
  }, [navigateToPage, setPlaceLocationCoords, setSelectedAnimal]);

  const openRegionSelector = useCallback(() => {
    homeUrlRef.current = '/';
    navigateToPage('home');
    closeLanding();
    setSelectedRegion(null);
    setSelectedAnimal(null);
    setPlaceLocationCoords(null);
    setActiveTab(Tab.Game);
    resetSearchFilters();
  }, [closeLanding, navigateToPage, resetSearchFilters, setSelectedRegion, setSelectedAnimal]);

  const goToLanding = useCallback(() => {
    homeUrlRef.current = '/';
    navigateToPage('home');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(LANDING_SESSION_LOCK_KEY);
    }
    setIsLandingOpen(true);
    setSelectedRegion(null);
    setSelectedAnimal(null);
    setPlaceLocationCoords(null);
    setActiveTab(Tab.Game);
    resetSearchFilters();
  }, [navigateToPage, resetSearchFilters, setSelectedRegion, setSelectedAnimal]);

  const openAnimalFromLanding = useCallback((locationId: number) => {
    const targetAnimal = mapAnimals.find((animal) => animal.locationId === locationId);
    if (!targetAnimal) {
      openRegionSelector();
      return;
    }

    const regionForAnimal = getRegionByCoordinates(targetAnimal.coordinates);
    if (!regionForAnimal) {
      toast.error('Не удалось определить регион для этого животного.');
      return;
    }

    closeLanding();
    navigateToPage('home');
    setSelectedRegion(regionForAnimal);
    setSelectedAnimal(targetAnimal);
    setPlaceLocationCoords(null);
    setActiveTab(Tab.Game);
    applyFiltersForAnimal(targetAnimal);
  }, [applyFiltersForAnimal, closeLanding, mapAnimals, navigateToPage, openRegionSelector, setSelectedRegion, setSelectedAnimal]);

  // ============================================
  // ОБРАБОТЧИКИ - ВЫБОР РЕГИОНА
  // ============================================
  const handleRegionSelect = useCallback((regionFromSvg: string) => {
    if (!isSupportedRegionCode(regionFromSvg)) {
      toast.error('Этот регион пока не настроен в атласе. Выберите подсвеченный регион.');
      return;
    }

    setSelectedRegion(regionFromSvg);
    closeLanding();
    setSelectedAnimal(null);
    setIsHaloEditorOpen(false);
    setHaloEditorLocationId(null);
    setPlaceLocationCoords(null);
    setActiveTab(Tab.Game);
    resetSearchFilters();
  }, [closeLanding, resetSearchFilters, setSelectedRegion, setSelectedAnimal]);

  const handleMapZoom = useCallback((direction: 'in' | 'out') => {
    const mapInstance = yandexMapRef.current;
    if (!mapInstance || typeof mapInstance.getZoom !== 'function' || typeof mapInstance.setZoom !== 'function') {
      return;
    }

    const currentZoom = mapInstance.getZoom();
    const delta = direction === 'in' ? 1 : -1;
    const nextZoom = Math.max(3, Math.min(13, currentZoom + delta));
    mapInstance.setZoom(nextZoom, { duration: 180 });
  }, []);

  const applyMarkerHaloRadiusToLocalState = useCallback(
    (locationId: number, markerHaloRadius: number | null) => {
      const normalizedRadius =
        markerHaloRadius == null ? null : clampAnimalMarkerHaloRadius(markerHaloRadius);

      setMapAnimals((prev) =>
        prev.map((animal) =>
          animal.locationId === locationId
            ? { ...animal, markerHaloRadius: normalizedRadius }
            : animal
        )
      );

      setSelectedAnimal((prev) =>
        prev && prev.locationId === locationId
          ? { ...prev, markerHaloRadius: normalizedRadius }
          : prev
      );
    },
    [setMapAnimals, setSelectedAnimal]
  );

  const persistMarkerHaloRadiusForLocation = useCallback(
    async (locationId: number, markerHaloRadius: number | null) => {
      if (!hasAuthSession) {
        toast.error('Для сохранения радиуса ореола нужна авторизация администратора.');
        return;
      }

      const response = await fetchWithRetry(apiUrl(`/api/locations/${locationId}/marker-halo-radius`), {
        method: 'PUT',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          marker_halo_radius: markerHaloRadius == null ? null : clampAnimalMarkerHaloRadius(markerHaloRadius)
        })
      });

      if (!response.ok) {
        throw await createApiRequestError(response, 'Не удалось сохранить радиус ореола.');
      }

      const data = await response.json();
      const serverRadius =
        data?.marker_halo_radius == null ? null : clampAnimalMarkerHaloRadius(Number(data.marker_halo_radius));
      applyMarkerHaloRadiusToLocalState(locationId, serverRadius);
    },
    [applyMarkerHaloRadiusToLocalState, hasAuthSession]
  );

  const markMarkerHaloDirty = useCallback((locationId: number) => {
    setDirtyMarkerHaloLocationIds((prev) => {
      if (prev[locationId]) return prev;
      return { ...prev, [locationId]: true };
    });
  }, []);

  const clearMarkerHaloDirty = useCallback((locationId: number) => {
    setDirtyMarkerHaloLocationIds((prev) => {
      if (!prev[locationId]) return prev;
      const next = { ...prev };
      delete next[locationId];
      return next;
    });
  }, []);

  const handleAnimalMarkerHaloRadiusChangeForLocation = useCallback(
    (locationId: number, nextRadius: number) => {
      const clampedRadius = clampAnimalMarkerHaloRadius(nextRadius);
      const radiusForStorage =
        clampedRadius === DEFAULT_ANIMAL_MARKER_HALO_RADIUS ? null : clampedRadius;

      applyMarkerHaloRadiusToLocalState(locationId, radiusForStorage);
      markMarkerHaloDirty(locationId);
    },
    [applyMarkerHaloRadiusToLocalState, markMarkerHaloDirty]
  );

  const handleAnimalMarkerHaloRadiusResetForLocation = useCallback(
    (locationId: number) => {
      applyMarkerHaloRadiusToLocalState(locationId, null);
      markMarkerHaloDirty(locationId);
    },
    [applyMarkerHaloRadiusToLocalState, markMarkerHaloDirty]
  );

  const handleSaveAnimalMarkerHaloRadiusForLocation = useCallback(
    async (locationId: number) => {
      if (savingMarkerHaloLocationIds[locationId]) return;

      const targetAnimal = mapAnimals.find((animal) => animal.locationId === locationId);
      if (!targetAnimal) {
        toast.error('Не удалось найти метку для сохранения ореола.');
        return;
      }

      setSavingMarkerHaloLocationIds((prev) => ({ ...prev, [locationId]: true }));

      try {
        const localRadius =
          targetAnimal.markerHaloRadius == null ? null : clampAnimalMarkerHaloRadius(targetAnimal.markerHaloRadius);
        await persistMarkerHaloRadiusForLocation(locationId, localRadius);
        clearMarkerHaloDirty(locationId);
        toast.success('Радиус ореола сохранён');
      } catch (error) {
        console.error('Не удалось сохранить радиус ореола:', error);
        handleAdminRequestError(error, 'Не удалось сохранить радиус ореола.');
        void fetchData();
      } finally {
        setSavingMarkerHaloLocationIds((prev) => {
          if (!prev[locationId]) return prev;
          const next = { ...prev };
          delete next[locationId];
          return next;
        });
      }
    },
    [clearMarkerHaloDirty, fetchData, handleAdminRequestError, mapAnimals, persistMarkerHaloRadiusForLocation, savingMarkerHaloLocationIds]
  );

  const handleChangeRegion = useCallback(() => {
    setSelectedRegion(null);
    setSelectedAnimal(null);
    setIsHaloEditorOpen(false);
    setHaloEditorLocationId(null);
    setPlaceLocationCoords(null);
    resetSearchFilters();
  }, [resetSearchFilters, setSelectedAnimal, setSelectedRegion]);

  const areCareButtonsDisabled = isAdult || satiety >= 100 || isVideoPlaying;
  const isCurrentFavorite = selectedAnimal ? isFavorite(selectedAnimal.id) : false;
  const handleToggleFavorite = useCallback(() => {
    if (!selectedAnimal) return;
    void toggleFavorite(selectedAnimal.id);
  }, [selectedAnimal, toggleFavorite]);
  const handleToggleRedBook = useCallback(async () => {
    if (!selectedAnimal || !isAdminMode || !hasAuthSession) return;

    const nextValue = !Boolean(selectedAnimal.isRedBook);
    try {
      const res = await fetchWithRetry(apiUrl(`/api/species/${selectedAnimal.id}/red-book`), {
        method: 'PUT',
        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ is_red_book: nextValue })
      });
      if (!res.ok) {
        throw await createApiRequestError(res, 'Не удалось обновить статус Красной книги.');
      }

      setSelectedAnimal((prev) => (prev ? { ...prev, isRedBook: nextValue } : prev));
      setMapAnimals((prev) =>
        prev.map((animal) => (animal.id === selectedAnimal.id ? { ...animal, isRedBook: nextValue } : animal))
      );
      setSpeciesList((prev) =>
        prev.map((species) => (species.id === selectedAnimal.id ? { ...species, isRedBook: nextValue } : species))
      );
      toast.success(nextValue ? 'Вид добавлен в Красную книгу' : 'Вид снят с отметки Красной книги');
    } catch (error) {
      handleAdminRequestError(error, 'Не удалось обновить статус Красной книги.');
    }
  }, [handleAdminRequestError, hasAuthSession, isAdminMode, selectedAnimal, setMapAnimals, setSelectedAnimal, setSpeciesList]);
  const handleCloseAnimalCard = useCallback(() => {
    setSelectedAnimal(null);
  }, [setSelectedAnimal]);
  const handleOpenMarkerHaloEditorFromCard = useCallback(() => {
    if (!isAdminMode || !selectedAnimal) return;
    setHaloEditorLocationId(selectedAnimal.locationId);
    setIsHaloEditorOpen(true);
    setSelectedAnimal(null);
  }, [isAdminMode, selectedAnimal, setSelectedAnimal]);
  const handleCloseHaloEditor = useCallback(() => {
    setIsHaloEditorOpen(false);
  }, []);
  const isHaloEditorDirty = haloEditorLocationId != null && Boolean(dirtyMarkerHaloLocationIds[haloEditorLocationId]);
  const isHaloEditorSavePending =
    haloEditorLocationId != null && Boolean(savingMarkerHaloLocationIds[haloEditorLocationId]);
  const searchPanelTop = isDataLoading || dataLoadError
    ? 'calc(var(--app-header-height) + 72px)'
    : 'calc(var(--app-header-height) + 16px)';
  const scrollToLandingCreatures = useCallback(() => {
    landingCreaturesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const scrollLandingCards = useCallback((direction: 'prev' | 'next') => {
    const container = landingCardsRef.current;
    if (!container) return;
    const delta = container.clientWidth * 0.82;
    container.scrollBy({
      left: direction === 'next' ? delta : -delta,
      behavior: 'smooth'
    });
  }, []);

  useEffect(() => {
    if (!isLandingOpen) {
      setLandingArrows({ canPrev: false, canNext: false });
      return;
    }

    const container = landingCardsRef.current;
    if (!container) {
      setLandingArrows({ canPrev: false, canNext: false });
      return;
    }

    const updateArrowVisibility = () => {
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const currentScrollLeft = container.scrollLeft;
      const canPrev = currentScrollLeft > 4;
      const canNext = currentScrollLeft < maxScrollLeft - 4;

      setLandingArrows((prev) => {
        if (prev.canPrev === canPrev && prev.canNext === canNext) {
          return prev;
        }
        return { canPrev, canNext };
      });
    };

    updateArrowVisibility();
    const rafId = window.requestAnimationFrame(updateArrowVisibility);

    container.addEventListener('scroll', updateArrowVisibility, { passive: true });
    window.addEventListener('resize', updateArrowVisibility);

    return () => {
      window.cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', updateArrowVisibility);
      window.removeEventListener('resize', updateArrowVisibility);
    };
  }, [isLandingOpen, landingFeaturedAnimals.length]);

  const handleLogout = useCallback(async () => {
    try {
      await fetchWithRetry(apiUrl('/api/logout'), { method: 'POST' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setSelectedAnimal(null);
      setIsAdminMode(false);
      setIsHaloEditorOpen(false);
      setHaloEditorLocationId(null);
      toast('Вы вышли из системы', { icon: '👋' });
    }
  }, [setIsAdminMode, setSelectedAnimal, setUser]);

  const handleToggleAdmin = useCallback(() => {
    if (user?.role !== 'admin') {
      toast.error('Режим редактора доступен только администраторам');
      return;
    }

    const newMode = !isAdminMode;
    setIsAdminMode(newMode);
    setSelectedAnimal(null);
    if (!newMode) {
      setIsHaloEditorOpen(false);
      setHaloEditorLocationId(null);
    }
    if (newMode) {
      toast('Режим администратора: перетаскивайте метки!', { icon: '🛠️' });
    }
  }, [isAdminMode, setIsAdminMode, setSelectedAnimal, user]);

  const handleAuthSuccess = useCallback((userData: User) => {
    setUser(userData);
    toast.success(`Добро пожаловать, ${userData.email}!`);
  }, [setUser]);

  const handleProfileAnimalNavigation = useCallback((locId: number) => {
    const animal = mapAnimals.find((entry) => entry.locationId === locId);
    if (animal) {
      handleSelect(animal);
    }
  }, [handleSelect, mapAnimals]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="app-container">
      <div role="status" aria-live="polite" aria-atomic="true">
        <Toaster 
          position="bottom-center"
          toastOptions={{
            style: {
              fontSize: '14px',
              borderRadius: '12px',
              background: '#222',
              color: '#fff',
              padding: '12px 20px',
            },
          }}
        />
      </div>

      {!isLandingOpen && isHomePage && (
        <Header 
          user={user} 
          onHomeClick={goToLanding}
          onRegionSelectorClick={openRegionSelector}
          onLoginClick={() => setIsAuthOpen(true)} 
          onLogoutClick={handleLogout}
          onProfileClick={() => setIsProfileOpen(true)}
          isAdminMode={isAdminMode}
          showRegionSearch={!selectedRegion}
          regionSearchTerm={regionSearchTerm}
          onRegionSearchChange={setRegionSearchTerm}
          selectedRegionLabel={selectedRegionConfig?.label ?? null}
          onToggleAdmin={handleToggleAdmin}
          showAdminToggle={Boolean(selectedRegion)}
        />
      )}
      
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLogin={handleAuthSuccess} />
      
      {user && (
        <ProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={user} 
          allAnimals={mapAnimals} 
          onNavigateToAnimal={handleProfileAnimalNavigation}
        />
      )}

      <Suspense fallback={<LoadingSpinner />}>
        <AdminPanel
          placeLocationCoords={placeLocationCoords}
          setPlaceLocationCoords={setPlaceLocationCoords}
          isSpeciesCreatorOpen={isSpeciesCreatorOpen}
          setIsSpeciesCreatorOpen={setIsSpeciesCreatorOpen}
          speciesFormError={speciesFormError}
          setSpeciesFormError={setSpeciesFormError}
          selectedSpeciesId={selectedSpeciesId}
          setSelectedSpeciesId={setSelectedSpeciesId}
          speciesList={speciesList}
          onSaveLocation={handleSaveLocation}
          onCreateSpecies={handleCreateSpecies}
          newSpeciesForm={newSpeciesForm}
          setNewSpeciesForm={setNewSpeciesForm}
          isFolderTouched={isFolderTouched}
          setIsFolderTouched={setIsFolderTouched}
          toFolderName={toFolderName}
          setIconFile={setIconFile}
          setPhotoFiles={setPhotoFiles}
          photoFiles={photoFiles}
          isSpeciesSaving={isSpeciesSaving}
        />
      </Suspense>

      {isAboutPageOpen && (
        <Suspense fallback={<LoadingSpinner label="Открываем страницу проекта..." />}>
          <AboutPage onBackHome={goToLanding} onOpenMap={openRegionSelector} />
        </Suspense>
      )}

      {isHomePage && isLandingOpen && !selectedRegion && (
        <Suspense fallback={<LoadingSpinner />}>
          <Landing
            landingStats={landingStats.map((item) => ({ label: item.label, value: item.value }))}
            landingFeaturedAnimals={landingFeaturedAnimals}
            landingArrows={landingArrows}
            landingCreaturesRef={landingCreaturesRef}
            landingCardsRef={landingCardsRef}
            onOpenAbout={openAboutPage}
            onOpenRegionSelector={openRegionSelector}
            onScrollToCreatures={scrollToLandingCreatures}
            onScrollCards={scrollLandingCards}
            onOpenAnimal={openAnimalFromLanding}
          />
        </Suspense>
      )}

      {isHomePage && !isLandingOpen && !selectedRegion && (
        <RegionSelector
          highlightedRegions={SUPPORTED_REGION_CODES}
          regions={regionSelectorRegions}
          searchTerm={debouncedRegionSearchTerm}
          onSelectRegion={handleRegionSelect}
          onUnavailableRegionSelect={() =>
            toast.error('Сейчас доступен выбор только регионов Дальнего Востока.')
          }
        />
      )}

      {isHomePage && selectedRegion && (
        <>
          {(isDataLoading || dataLoadError) && (
            <div className={`map-data-status ${dataLoadError ? 'error' : ''}`} role={dataLoadError ? 'alert' : 'status'} aria-live="polite">
              <span>{isDataLoading ? 'Загружаем данные карты...' : dataLoadError}</span>
              {dataLoadError && (
                <button type="button" onClick={() => void fetchData()}>
                  Повторить
                </button>
              )}
            </div>
          )}

          <Suspense fallback={<LoadingSpinner label="Загрузка панели..." />}>
            <SearchPanel
              top={searchPanelTop}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              dietFilter={filters.diet}
              onDietFilterChange={setDietFilter}
              redBookOnly={filters.redBook}
              onRedBookOnlyChange={setRedBookOnly}
              isFilterMenuOpen={isFilterMenuOpen}
              onToggleFilterMenu={() => setIsFilterMenuOpen((prev) => !prev)}
              onCloseFilterMenu={() => setIsFilterMenuOpen(false)}
              onChangeRegion={handleChangeRegion}
              isAdminMode={isAdminMode}
              onExportCsv={exportFilteredAnimalsToCsv}
              filterMenuRef={filterMenuRef}
            />
          </Suspense>

          {isDataLoading ? (
            <div className="map-skeleton" aria-hidden>
              <div className="skeleton-pulse" />
            </div>
          ) : (
            <MapView
              selectedRegion={selectedRegion}
              selectedRegionConfig={selectedRegionConfig}
              selectedAnimalLocationId={selectedAnimal?.locationId ?? null}
              isAdminMode={isAdminMode}
              yandexMapRef={yandexMapRef}
              onMapClick={handleMapClick}
              regionFilteredAnimals={regionFilteredAnimals}
              markerHaloRadiusByLocationId={markerHaloRadiusByLocationId}
              haloEditorLocationId={haloEditorLocationId}
              isHaloEditorOpen={isHaloEditorOpen}
              isHaloEditorDirty={isHaloEditorDirty}
              isHaloEditorSavePending={isHaloEditorSavePending}
              minAnimalMarkerHaloRadius={MIN_ANIMAL_MARKER_HALO_RADIUS}
              maxAnimalMarkerHaloRadius={MAX_ANIMAL_MARKER_HALO_RADIUS}
              defaultAnimalMarkerHaloRadius={DEFAULT_ANIMAL_MARKER_HALO_RADIUS}
              onAnimalMarkerHaloRadiusChangeForLocation={handleAnimalMarkerHaloRadiusChangeForLocation}
              onAnimalMarkerHaloRadiusResetForLocation={handleAnimalMarkerHaloRadiusResetForLocation}
              onSaveAnimalMarkerHaloRadiusForLocation={handleSaveAnimalMarkerHaloRadiusForLocation}
              onCloseHaloEditor={handleCloseHaloEditor}
              onDragEnd={handleDragEnd}
              onSelectAnimal={handleSelect}
              placeLocationCoords={placeLocationCoords}
              onMapZoom={handleMapZoom}
            />
          )}
        </>
      )}

      {/* === БОЛЬШАЯ КАРТОЧКА ЖИВОТНОГО (МОДАЛЬНОЕ ОКНО) === */}
      {isHomePage && selectedAnimal && (
        <Suspense fallback={<LoadingSpinner label={isWikiLoading ? 'Загрузка энциклопедии...' : 'Загрузка карточки...'} />}>
          <AnimalCard
            selectedAnimal={selectedAnimal}
            onClose={handleCloseAnimalCard}
            isAdminMode={isAdminMode}
            onDeleteLocation={handleDeleteLocation}
            onOpenMarkerHaloEditor={handleOpenMarkerHaloEditorFromCard}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onTrackGalleryAction={() => handleAction('gallery')}
            getFoodInfo={getFoodInfo}
            hasSelectedModel={hasSelectedModel}
            selectedModelUrl={selectedModelUrl}
            isAdult={isAdult}
            modelChildFile={modelChildFile}
            setModelChildFile={setModelChildFile}
            modelAdultFile={modelAdultFile}
            setModelAdultFile={setModelAdultFile}
            isModelUploading={isModelUploading}
            modelUploadError={modelUploadError}
            onUploadSpeciesModel={uploadSpeciesModel}
            onClearSpeciesModel={clearSpeciesModel}
            activeVideoSrc={activeVideoSrc}
            videoRef={videoRef}
            onVideoEnded={handleVideoEnded}
            isVideoPlaying={isVideoPlaying}
            satiety={satiety}
            areCareButtonsDisabled={areCareButtonsDisabled}
            lastAction={lastAction}
            onPlayActionVideo={playActionVideo}
            onEvolution={handleEvolution}
            user={user}
            hasPhoto={hasPhoto}
            onTakePhoto={handleTakePhoto}
            isEditingWiki={isEditingWiki}
            setIsEditingWiki={setIsEditingWiki}
            onSaveWiki={handleSaveWiki}
            onToggleSpeech={toggleSpeech}
            isSpeaking={isSpeaking}
            voiceError={voiceError}
            wikiData={wikiData}
            setWikiData={setWikiData}
            galleryUploadFiles={galleryUploadFiles}
            setGalleryUploadFiles={setGalleryUploadFiles}
            galleryUploadError={galleryUploadError}
            setGalleryUploadError={setGalleryUploadError}
            galleryPreviewUrls={galleryPreviewUrls}
            isGalleryUploading={isGalleryUploading}
            onUploadGalleryPhotos={handleUploadGalleryPhotos}
            galleryImages={galleryImages}
            onDeleteGalleryPhoto={handleDeleteGalleryPhoto}
            isFavorite={isCurrentFavorite}
            onToggleFavorite={handleToggleFavorite}
            onToggleRedBook={handleToggleRedBook}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;





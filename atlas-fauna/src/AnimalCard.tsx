import { lazy, memo, Suspense, useEffect, useRef, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { toast } from 'react-hot-toast';
import type { DietType, IAnimal } from './animals';
import { Tab, type User, type WikiData } from './types';
import AnimalScene from './AnimalScene';
import SceneErrorBoundary from './SceneErrorBoundary';

const PhotoGallery = lazy(() => import('./PhotoGallery'));
const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;

interface FoodInfo {
  icon: string;
  text: string;
}

interface AnimalCardProps {
  selectedAnimal: IAnimal;
  onClose: () => void;
  isAdminMode: boolean;
  onDeleteLocation: () => void;
  onOpenMarkerHaloEditor: () => void;
  activeTab: Tab;
  onChangeTab: (tab: Tab) => void;
  onTrackGalleryAction: () => void;
  getFoodInfo: (diet: DietType) => FoodInfo;
  hasSelectedModel: boolean;
  selectedModelUrl: string;
  isAdult: boolean;
  modelChildFile: File | null;
  setModelChildFile: (file: File | null) => void;
  modelAdultFile: File | null;
  setModelAdultFile: (file: File | null) => void;
  isModelUploading: boolean;
  modelUploadError: string | null;
  onUploadSpeciesModel: (type: 'child' | 'adult', file: File) => void;
  onClearSpeciesModel: (type: 'child' | 'adult') => void;
  activeVideoSrc: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoEnded: () => void;
  isVideoPlaying: boolean;
  satiety: number;
  areCareButtonsDisabled: boolean;
  lastAction: 'feed' | 'drink' | null;
  onPlayActionVideo: (action: 'feed' | 'drink') => void;
  onEvolution: () => void;
  user: User | null;
  hasPhoto: boolean;
  onTakePhoto: () => void;
  isEditingWiki: boolean;
  setIsEditingWiki: Dispatch<SetStateAction<boolean>>;
  onSaveWiki: () => void;
  onToggleSpeech: () => void;
  isSpeaking: boolean;
  voiceError: string | null;
  wikiData: WikiData;
  setWikiData: Dispatch<SetStateAction<WikiData>>;
  galleryUploadFiles: File[];
  setGalleryUploadFiles: Dispatch<SetStateAction<File[]>>;
  galleryUploadError: string | null;
  setGalleryUploadError: Dispatch<SetStateAction<string | null>>;
  galleryPreviewUrls: string[];
  isGalleryUploading: boolean;
  onUploadGalleryPhotos: () => void;
  galleryImages: { name: string; url: string }[];
  onDeleteGalleryPhoto: (fileName: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onToggleRedBook: () => void;
}

function AnimalCard({
  selectedAnimal,
  onClose,
  isAdminMode,
  onDeleteLocation,
  onOpenMarkerHaloEditor,
  activeTab,
  onChangeTab,
  onTrackGalleryAction,
  getFoodInfo,
  hasSelectedModel,
  selectedModelUrl,
  isAdult,
  modelChildFile,
  setModelChildFile,
  modelAdultFile,
  setModelAdultFile,
  isModelUploading,
  modelUploadError,
  onUploadSpeciesModel,
  onClearSpeciesModel,
  activeVideoSrc,
  videoRef,
  onVideoEnded,
  isVideoPlaying,
  satiety,
  areCareButtonsDisabled,
  lastAction,
  onPlayActionVideo,
  onEvolution,
  user,
  hasPhoto,
  onTakePhoto,
  isEditingWiki,
  setIsEditingWiki,
  onSaveWiki,
  onToggleSpeech,
  isSpeaking,
  voiceError,
  wikiData,
  setWikiData,
  galleryUploadFiles,
  setGalleryUploadFiles,
  galleryUploadError,
  setGalleryUploadError,
  galleryPreviewUrls,
  isGalleryUploading,
  onUploadGalleryPhotos,
  galleryImages,
  onDeleteGalleryPhoto,
  isFavorite,
  onToggleFavorite,
  onToggleRedBook
}: AnimalCardProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleModelFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    setModelFile: (file: File | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error('Файл слишком большой (макс. 200MB)');
      setModelFile(null);
      event.target.value = '';
      return;
    }
    setModelFile(file);
  };

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
      }
    };
  }, [videoRef]);

  return (
    <div
      className="animal-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="animal-name"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animal-card-window">
        <div className="animal-col-left">
          <div className="model-status-badge">
            <span style={{ fontSize: '18px' }}>{isAdult ? 'AD' : 'YG'}</span>
            <span>{isAdult ? 'Adult' : 'Young'}</span>
          </div>
          <div className="scene-wrapper">
            {hasSelectedModel ? (
              <SceneErrorBoundary resetKey={`${selectedAnimal.locationId}:${selectedModelUrl}:${isAdult ? 'adult' : 'young'}`}>
                <Suspense fallback={<div className="scene-placeholder">Loading 3D model...</div>}>
                  <AnimalScene
                    key={selectedModelUrl}
                    modelUrl={selectedModelUrl}
                    isAdult={isAdult}
                    scale={isAdult ? 2.5 : 1.5}
                  />
                </Suspense>
              </SceneErrorBoundary>
            ) : (
              <div className="scene-placeholder">
                <img
                  src={`/icons/${selectedAnimal.iconFile}`}
                  alt={selectedAnimal.name}
                  style={{
                    width: 86,
                    height: 86,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    marginBottom: 12,
                    border: '1px solid rgba(0,0,0,0.1)'
                  }}
                />
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Model is not uploaded</div>
                <div style={{ fontSize: 13, color: '#555', textAlign: 'center', maxWidth: 260 }}>
                  Upload a GLB model in admin mode
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="animal-col-right">
          <div className="animal-header-right">
            <div>
              <h1 id="animal-name" style={{ margin: 0, fontSize: '28px', color: '#333' }}>
                {selectedAnimal.name}
              </h1>
              <div style={{ fontSize: '14px', color: '#888', marginTop: '5px' }}>
                {selectedAnimal.category === 'mammal' ? 'Млекопитающее' : 'Птица'} • {getFoodInfo(selectedAnimal.diet).text}
              </div>
              {selectedAnimal.isRedBook && (
                <div className="red-book-badge">Красная книга</div>
              )}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {isAdminMode && (
                <button
                  className={`red-book-toggle-btn ${selectedAnimal.isRedBook ? 'active' : ''}`}
                  onClick={onToggleRedBook}
                  aria-label={selectedAnimal.isRedBook ? 'Убрать из Красной книги' : 'Добавить в Красную книгу'}
                >
                  РК
                </button>
              )}
              <button
                className="favorite-btn"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              >
                <span className="material-icons" aria-hidden>
                  {isFavorite ? 'favorite' : 'favorite_border'}
                </span>
              </button>
              <button ref={closeButtonRef} className="big-close-btn" onClick={onClose} aria-label="Закрыть карточку">
                ×
              </button>
            </div>
          </div>

          {isAdminMode && (
            <div style={{ padding: '10px 30px', background: '#ffebee', borderBottom: '1px solid #ffcdd2' }}>
              <button
                onClick={onOpenMarkerHaloEditor}
                style={{
                  width: '100%',
                  background: '#406157',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginBottom: 10
                }}
              >
                Настроить ореол метки
              </button>
              <button
                onClick={onDeleteLocation}
                style={{ width: '100%', background: '#d32f2f', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🗑️ Удалить эту точку
              </button>
            </div>
          )}

          <div className="animal-content-scroll">
            <div className="auth-tabs" style={{ marginBottom: '20px' }}>
              <button className={`auth-tab ${activeTab === Tab.Game ? 'active' : ''}`} onClick={() => onChangeTab(Tab.Game)}>
                🎮 Питомец
              </button>
              <button className={`auth-tab ${activeTab === Tab.Info ? 'active' : ''}`} onClick={() => onChangeTab(Tab.Info)}>
                📖 Энциклопедия
              </button>
              <button
                className={`auth-tab ${activeTab === Tab.Gallery ? 'active' : ''}`}
                onClick={() => {
                  onChangeTab(Tab.Gallery);
                  onTrackGalleryAction();
                }}
              >
                📷 Фото
              </button>
            </div>

            {activeTab === Tab.Game && (
              <div className="tab-content tamagotchi-panel">
                {isAdminMode && (
                  <div style={{ marginBottom: 16, padding: 12, border: '1px dashed #bdbdbd', borderRadius: 10 }}>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Загрузка моделей (GLB)</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>Детёныш</label>
                        <input
                          type="file"
                          accept=".glb"
                          onChange={(e) => handleModelFileChange(e, setModelChildFile)}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="submit-btn"
                            style={{ background: '#4caf50', flex: 1 }}
                            disabled={!modelChildFile || isModelUploading}
                            onClick={() => modelChildFile && onUploadSpeciesModel('child', modelChildFile)}
                          >
                            {isModelUploading ? 'Загрузка...' : 'Загрузить'}
                          </button>
                          <button
                            className="submit-btn"
                            style={{ background: '#eee', color: '#333', flex: 1 }}
                            disabled={isModelUploading || !selectedAnimal?.modelUrlChild}
                            onClick={() => onClearSpeciesModel('child')}
                          >
                            Очистить
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>Взрослая</label>
                        <input
                          type="file"
                          accept=".glb"
                          onChange={(e) => handleModelFileChange(e, setModelAdultFile)}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="submit-btn"
                            style={{ background: '#2196f3', flex: 1 }}
                            disabled={!modelAdultFile || isModelUploading}
                            onClick={() => modelAdultFile && onUploadSpeciesModel('adult', modelAdultFile)}
                          >
                            {isModelUploading ? 'Загрузка...' : 'Загрузить'}
                          </button>
                          <button
                            className="submit-btn"
                            style={{ background: '#eee', color: '#333', flex: 1 }}
                            disabled={isModelUploading || !selectedAnimal?.modelUrlAdult}
                            onClick={() => onClearSpeciesModel('adult')}
                          >
                            Очистить
                          </button>
                        </div>
                      </div>
                    </div>
                    {modelUploadError && (
                      <div style={{ fontSize: 12, color: '#c62828', background: '#ffebee', padding: '8px', borderRadius: 6, marginTop: 8 }}>
                        {modelUploadError}
                      </div>
                    )}
                  </div>
                )}

                {activeVideoSrc && (
                  <div
                    style={{
                      width: '100%',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      marginBottom: '20px',
                      background: '#111',
                      aspectRatio: '16/9',
                      position: 'relative',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                    }}
                  >
                    <video
                      ref={videoRef}
                      src={activeVideoSrc}
                      onEnded={onVideoEnded}
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {isVideoPlaying && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#f44336',
                            display: 'inline-block',
                            animation: 'pulse 1s ease-in-out infinite'
                          }}
                        />
                        Воспроизводится
                      </div>
                    )}
                  </div>
                )}

                <div className="status-bar" style={{ marginBottom: '25px' }}>
                  <div className="status-label" style={{ fontSize: '16px', marginBottom: '8px' }}>
                    <span>{isAdult ? 'Здоровье и Сила' : 'Уровень сытости'}</span>
                    <span style={{ fontWeight: 'bold' }}>{isAdult ? 'MAX' : `${satiety}%`}</span>
                  </div>
                  <div className="progress-track" style={{ height: '12px' }}>
                    <div className="progress-fill" style={{ width: isAdult ? '100%' : `${satiety}%`, backgroundColor: isAdult ? '#4caf50' : '#2196f3' }} />
                  </div>
                </div>

                <div className="actions-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <button
                    className="game-btn btn-feed"
                    onClick={() => onPlayActionVideo('feed')}
                    disabled={areCareButtonsDisabled || lastAction === 'feed'}
                    style={{
                      opacity: areCareButtonsDisabled || lastAction === 'feed' ? 0.4 : 1,
                      transition: 'opacity 0.25s ease, transform 0.1s ease',
                      cursor: areCareButtonsDisabled || lastAction === 'feed' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div className="btn-icon">{getFoodInfo(selectedAnimal.diet).icon}</div>
                    Покормить
                    <div className="btn-subtext">{lastAction === 'feed' && !isVideoPlaying ? '— только что ели' : ''}</div>
                  </button>

                  <button
                    className="game-btn btn-drink"
                    onClick={() => onPlayActionVideo('drink')}
                    disabled={areCareButtonsDisabled || lastAction === 'drink'}
                    style={{
                      opacity: areCareButtonsDisabled || lastAction === 'drink' ? 0.4 : 1,
                      transition: 'opacity 0.25s ease, transform 0.1s ease',
                      cursor: areCareButtonsDisabled || lastAction === 'drink' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div className="btn-icon">💧</div>
                    Напоить
                    <div className="btn-subtext">{lastAction === 'drink' && !isVideoPlaying ? '— только что пили' : ''}</div>
                  </button>
                </div>

                <div>
                  {!isAdult ? (
                    <button
                      className="game-btn btn-grow"
                      onClick={onEvolution}
                      disabled={satiety < 100 || isVideoPlaying}
                      style={{ width: '100%', padding: '18px', fontSize: '18px', opacity: satiety < 100 || isVideoPlaying ? 0.5 : 1, background: '#2196f3' }}
                    >
                      {user ? '✨ Вырастить' : '🔒 Войти, чтобы вырастить'}
                    </button>
                  ) : !hasPhoto ? (
                    <button
                      className="game-btn"
                      onClick={onTakePhoto}
                      style={{ width: '100%', padding: '18px', fontSize: '18px', background: '#ff9800', color: 'white' }}
                    >
                      📸 Сделать фото для отчета
                    </button>
                  ) : (
                    <button
                      className="game-btn btn-grow"
                      onClick={onEvolution}
                      style={{ width: '100%', padding: '18px', fontSize: '18px', background: '#4caf50', border: '2px dashed #fff' }}
                    >
                      🌲 Оформить в заповедник
                    </button>
                  )}
                </div>

                {!user && (
                  <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '12px', color: '#0d47a1', fontSize: '13px', lineHeight: '1.5' }}>
                    🔒 <b>Режим гостя:</b> Вы можете ухаживать за животным, но чтобы зафиксировать его рост и добавить в коллекцию, требуется регистрация.
                  </div>
                )}
              </div>
            )}

            {activeTab === Tab.Info && (
              <div className="tab-content" style={{ paddingRight: '10px' }}>
                {isAdminMode && (
                  <div style={{ marginBottom: 15, display: 'flex', justifyContent: 'flex-end' }}>
                    {!isEditingWiki ? (
                      <button
                        onClick={() => setIsEditingWiki(true)}
                        style={{ padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      >
                        ✏️ Редактировать статью
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setIsEditingWiki(false)}
                          style={{ padding: '8px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        >
                          Отмена
                        </button>
                        <button
                          onClick={onSaveWiki}
                          style={{ padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                        >
                          💾 Сохранить изменения
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isEditingWiki ? (
                  <>
                    <button
                      onClick={onToggleSpeech}
                      style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '20px',
                        background: isSpeaking ? '#ffebee' : '#e8eaf6',
                        color: isSpeaking ? '#c62828' : '#3f51b5',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        transition: '0.2s'
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{isSpeaking ? '⏹️' : '🔊'}</span>
                      {isSpeaking ? 'Остановить рассказ' : 'Послушать про животное'}
                    </button>

                    {voiceError && (
                      <p style={{ color: '#d32f2f', textAlign: 'center', marginBottom: '10px', fontSize: '14px', background: '#ffebee', padding: '8px', borderRadius: '8px' }}>
                        {voiceError}
                      </p>
                    )}

                    <div style={{ lineHeight: '1.6', fontSize: '15px', color: '#333', marginBottom: '25px', whiteSpace: 'pre-line' }}>
                      {wikiData.text || 'Описание готовится...'}
                    </div>

                    <div style={{ background: '#f1f8e9', borderRadius: '16px', padding: '20px', border: '1px solid #c5e1a5' }}>
                      <h3 style={{ margin: '0 0 15px 0', color: '#558b2f', display: 'flex', alignItems: 'center', gap: '8px' }}>🧬 Паспорт животного</h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="wiki-row">
                          <span className="wiki-label">🌌 Где живет:</span> <span className="wiki-val">{wikiData.habitat || '—'}</span>
                        </div>
                        <div className="wiki-row">
                          <span className="wiki-label">🍽️ Чем питается:</span> <span className="wiki-val">{wikiData.food || '—'}</span>
                        </div>
                        <div className="wiki-row">
                          <span className="wiki-label">📏 Размер:</span> <span className="wiki-val">{wikiData.size || '—'}</span>
                        </div>
                        <div className="wiki-row">
                          <span className="wiki-label">💡 Интересно:</span> <span className="wiki-val">{wikiData.trait || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Основной текст (Описание):</label>
                      <textarea
                        value={wikiData.text}
                        onChange={(e) => setWikiData({ ...wikiData, text: e.target.value })}
                        style={{ width: '100%', height: '200px', padding: 10, borderRadius: 8, border: '1px solid #ccc', fontFamily: 'inherit' }}
                        placeholder="Напишите здесь увлекательный рассказ про животное..."
                      />
                    </div>

                    <div style={{ background: '#fafafa', padding: 15, borderRadius: 10, border: '1px solid #eee' }}>
                      <h4 style={{ marginTop: 0 }}>Заполнение паспорта:</h4>

                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>🌌 Где живет:</label>
                        <input type="text" value={wikiData.habitat} onChange={(e) => setWikiData({ ...wikiData, habitat: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>🍽️ Чем питается:</label>
                        <input type="text" value={wikiData.food} onChange={(e) => setWikiData({ ...wikiData, food: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>📏 Размер (Вес/Рост):</label>
                        <input type="text" value={wikiData.size} onChange={(e) => setWikiData({ ...wikiData, size: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#666' }}>💡 Интересный факт:</label>
                        <input type="text" value={wikiData.trait} onChange={(e) => setWikiData({ ...wikiData, trait: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === Tab.Gallery && (
              <div className="tab-content">
                {isAdminMode && (
                  <div style={{ marginBottom: 15, padding: 12, border: '1px dashed #bdbdbd', borderRadius: 10 }}>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Добавить фото к виду</div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        setGalleryUploadFiles(Array.from(e.target.files || []));
                        setGalleryUploadError(null);
                      }}
                    />
                    {galleryPreviewUrls.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 6, marginTop: 8 }}>
                        {galleryPreviewUrls.map((url, idx) => (
                          <div key={`${url}-${idx}`} style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 8, background: '#eee', position: 'relative' }}>
                            <img src={url} alt={`preview-${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <button
                              type="button"
                              onClick={() => {
                                setGalleryUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: 'none',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 12,
                                lineHeight: '20px',
                                padding: 0
                              }}
                              title="Убрать фото"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {galleryUploadFiles.length > 0 && <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Выбрано фото: {galleryUploadFiles.length}</div>}
                    {galleryUploadError && (
                      <div style={{ fontSize: 12, color: '#c62828', background: '#ffebee', padding: '8px', borderRadius: 6, marginTop: 8 }}>
                        {galleryUploadError}
                      </div>
                    )}
                    <button className="submit-btn" style={{ marginTop: 10, background: '#4caf50' }} disabled={isGalleryUploading} onClick={onUploadGalleryPhotos}>
                      {isGalleryUploading ? 'Загрузка...' : 'Загрузить фото'}
                    </button>
                  </div>
                )}
                <Suspense fallback={<div className="scene-placeholder">Загрузка галереи...</div>}>
                  <PhotoGallery
                    folderName={selectedAnimal.imageFolder}
                    count={selectedAnimal.photoCount}
                    images={galleryImages}
                    canDelete={isAdminMode}
                    onDelete={onDeleteGalleryPhoto}
                  />
                </Suspense>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AnimalCard);




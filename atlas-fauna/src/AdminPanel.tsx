import { memo, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { toast } from 'react-hot-toast';
import type { ISpecies } from './animals';
import {
  IMAGE_UPLOAD_TOO_LARGE_MESSAGE,
  MAX_IMAGE_UPLOAD_SIZE_BYTES
} from './constants/upload';
import type { NewSpeciesForm } from './types';

interface AdminPanelProps {
  placeLocationCoords: number[] | null;
  setPlaceLocationCoords: Dispatch<SetStateAction<number[] | null>>;
  isSpeciesCreatorOpen: boolean;
  setIsSpeciesCreatorOpen: Dispatch<SetStateAction<boolean>>;
  speciesFormError: string | null;
  setSpeciesFormError: Dispatch<SetStateAction<string | null>>;
  selectedSpeciesId: string;
  setSelectedSpeciesId: Dispatch<SetStateAction<string>>;
  speciesList: ISpecies[];
  onSaveLocation: () => void;
  onCreateSpecies: (event: FormEvent) => void;
  newSpeciesForm: NewSpeciesForm;
  setNewSpeciesForm: Dispatch<SetStateAction<NewSpeciesForm>>;
  isFolderTouched: boolean;
  setIsFolderTouched: Dispatch<SetStateAction<boolean>>;
  toFolderName: (value: string) => string;
  setIconFile: Dispatch<SetStateAction<File | null>>;
  setPhotoFiles: Dispatch<SetStateAction<File[]>>;
  photoFiles: File[];
  isSpeciesSaving: boolean;
}

function AdminPanel({
  placeLocationCoords,
  setPlaceLocationCoords,
  isSpeciesCreatorOpen,
  setIsSpeciesCreatorOpen,
  speciesFormError,
  setSpeciesFormError,
  selectedSpeciesId,
  setSelectedSpeciesId,
  speciesList,
  onSaveLocation,
  onCreateSpecies,
  newSpeciesForm,
  setNewSpeciesForm,
  isFolderTouched,
  setIsFolderTouched,
  toFolderName,
  setIconFile,
  setPhotoFiles,
  photoFiles,
  isSpeciesSaving
}: AdminPanelProps) {
  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
      toast.error(IMAGE_UPLOAD_TOO_LARGE_MESSAGE);
      setIconFile(null);
      event.target.value = '';
      return;
    }
    setIconFile(file);
  };

  const handlePhotoFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const hasOversizedFile = files.some((file) => file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES);
    if (hasOversizedFile) {
      toast.error(IMAGE_UPLOAD_TOO_LARGE_MESSAGE);
      setPhotoFiles([]);
      event.target.value = '';
      return;
    }
    setPhotoFiles(files);
  };

  return (
    <>
      {placeLocationCoords && !isSpeciesCreatorOpen && (
        <div className="auth-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPlaceLocationCoords(null)}>
          <div className="auth-window" onClick={(e) => e.stopPropagation()} style={{ width: 400, textAlign: 'left' }}>
            <h3>Добавить точку на карту</h3>
            <p style={{ fontSize: 12, color: '#666' }}>Координаты:</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <input
                type="number"
                step="0.0001"
                value={Number.isFinite(placeLocationCoords[0]) ? placeLocationCoords[0] : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) {
                    setPlaceLocationCoords([val, placeLocationCoords[1]]);
                  }
                }}
                style={{ width: '50%', padding: 8 }}
                placeholder="Широта"
              />
              <input
                type="number"
                step="0.0001"
                value={Number.isFinite(placeLocationCoords[1]) ? placeLocationCoords[1] : ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) {
                    setPlaceLocationCoords([placeLocationCoords[0], val]);
                  }
                }}
                style={{ width: '50%', padding: 8 }}
                placeholder="Долгота"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 5 }}>Выберите вид животного:</label>
              <select style={{ width: '100%', padding: 10 }} value={selectedSpeciesId} onChange={(e) => setSelectedSpeciesId(e.target.value)}>
                <option value="" disabled>
                  -- Список видов --
                </option>
                {speciesList.map((species) => (
                  <option key={species.id} value={species.id}>
                    {species.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="submit-btn" style={{ background: '#4caf50', flex: 1 }} onClick={onSaveLocation} disabled={!selectedSpeciesId}>
                Поставить
              </button>
              <button
                className="submit-btn"
                style={{ background: '#2196f3', flex: 1 }}
                onClick={() => {
                  setSpeciesFormError(null);
                  setIsSpeciesCreatorOpen(true);
                }}
              >
                + Создать новый вид
              </button>
            </div>
          </div>
        </div>
      )}

      {isSpeciesCreatorOpen && (
        <div
          className="auth-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setIsSpeciesCreatorOpen(false);
              setSpeciesFormError(null);
            }
          }}
          style={{ zIndex: 2000 }}
        >
          <div className="auth-window" onClick={(e) => e.stopPropagation()} style={{ width: 450, textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Создать Новый Вид Животного</h3>
            <form onSubmit={onCreateSpecies} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                placeholder="Название (напр. Волк)"
                required
                value={newSpeciesForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewSpeciesForm((prev) => ({
                    ...prev,
                    name,
                    imageFolder: isFolderTouched ? prev.imageFolder : toFolderName(name)
                  }));
                }}
                style={{ padding: 8 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <select style={{ padding: 8, flex: 1 }} value={newSpeciesForm.category} onChange={(e) => setNewSpeciesForm({ ...newSpeciesForm, category: e.target.value as NewSpeciesForm['category'] })}>
                  <option value="mammal">Зверь</option>
                  <option value="bird">Птица</option>
                </select>
                <select style={{ padding: 8, flex: 1 }} value={newSpeciesForm.diet} onChange={(e) => setNewSpeciesForm({ ...newSpeciesForm, diet: e.target.value as NewSpeciesForm['diet'] })}>
                  <option value="herbivore">Травоядный</option>
                  <option value="carnivore">Хищник</option>
                  <option value="omnivore">Всеядный</option>
                </select>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}>
                <input
                  type="checkbox"
                  checked={newSpeciesForm.isRedBook}
                  onChange={(e) => setNewSpeciesForm({ ...newSpeciesForm, isRedBook: e.target.checked })}
                />
                Краснокнижный вид
              </label>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                Описание и «паспорт» редактируются внутри карточки животного после создания.
              </div>
              <input
                placeholder="Папка фото (напр. wolf)"
                required
                value={newSpeciesForm.imageFolder}
                onChange={(e) => {
                  setIsFolderTouched(true);
                  setNewSpeciesForm({ ...newSpeciesForm, imageFolder: e.target.value });
                }}
                style={{ padding: 8 }}
              />
              <label style={{ fontSize: 12, color: '#666' }}>Иконка (PNG или SVG, до 2 МБ)</label>
              <input type="file" accept="image/png,image/svg+xml" required onChange={handleIconFileChange} />
              <label style={{ fontSize: 12, color: '#666' }}>Фото (можно несколько, до 2 МБ каждое)</label>
              <input type="file" accept="image/*" multiple onChange={handlePhotoFilesChange} />
              {photoFiles.length > 0 && <div style={{ fontSize: 12, color: '#666' }}>Выбрано фото: {photoFiles.length}</div>}
              {speciesFormError && (
                <div style={{ fontSize: 12, color: '#c62828', background: '#ffebee', padding: '8px', borderRadius: 6 }}>
                  {speciesFormError}
                </div>
              )}
              <button type="submit" className="submit-btn" disabled={isSpeciesSaving} style={{ opacity: isSpeciesSaving ? 0.6 : 1 }}>
                {isSpeciesSaving ? 'Создаём...' : 'Создать Вид'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(AdminPanel);

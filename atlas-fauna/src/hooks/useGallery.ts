import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { IAnimal } from '../animals';
import {
  IMAGE_UPLOAD_TOO_LARGE_MESSAGE,
  MAX_IMAGE_UPLOAD_SIZE_BYTES
} from '../constants/upload';
import {
  ADMIN_SESSION_EXPIRED_MESSAGE,
  createApiRequestError,
  getApiRequestErrorMessage,
  isAdminSessionExpiredError
} from '../utils/apiErrors';
import { apiUrl } from '../utils/api';
import { createAuthHeaders } from '../utils/auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

interface GalleryMetaUpdate {
  photoCount: number;
  imageFolder: string;
}

interface UseGalleryParams {
  selectedAnimal: IAnimal | null;
  isAuthenticated: boolean;
  onAnimalMetaUpdate: (meta: GalleryMetaUpdate) => void;
  refreshMapData: () => void | Promise<void>;
  onAuthorizationExpired: () => void;
}

export const useGallery = ({
  selectedAnimal,
  isAuthenticated,
  onAnimalMetaUpdate,
  refreshMapData,
  onAuthorizationExpired
}: UseGalleryParams) => {
  const [galleryUploadFiles, setGalleryUploadFiles] = useState<File[]>([]);
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(null);
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ name: string; url: string }[]>([]);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = galleryUploadFiles.map((file) => URL.createObjectURL(file));
    setGalleryPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [galleryUploadFiles]);

  const clearGalleryImages = useCallback(() => {
    setGalleryImages([]);
  }, []);

  const fetchGalleryImages = useCallback(async (animalId: number) => {
    try {
      const res = await fetchWithRetry(apiUrl(`/api/species/${animalId}/photos`));
      if (!res.ok) {
        throw new Error('fetch_failed');
      }
      const data = await res.json();
      const images = (data.files || []).map((name: string) => ({
        name,
        url: `/images/${data.folder}/${name}`
      }));
      setGalleryImages(images);
    } catch {
      setGalleryImages([]);
    }
  }, []);

  const handleUploadGalleryPhotos = useCallback(async () => {
    if (!selectedAnimal) return;
    if (!isAuthenticated) {
      setGalleryUploadError('Требуется авторизация администратора.');
      return;
    }

    if (galleryUploadFiles.length === 0) {
      setGalleryUploadError('Выберите хотя бы одно фото.');
      return;
    }

    const hasOversizedFile = galleryUploadFiles.some((file) => file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES);
    if (hasOversizedFile) {
      setGalleryUploadError(IMAGE_UPLOAD_TOO_LARGE_MESSAGE);
      return;
    }

    setGalleryUploadError(null);
    setIsGalleryUploading(true);

    try {
      const form = new FormData();
      galleryUploadFiles.forEach((file) => form.append('files', file));
      const res = await fetchWithRetry(apiUrl(`/api/species/${selectedAnimal.id}/photos`), {
        method: 'POST',
        headers: createAuthHeaders(),
        body: form
      });
      if (!res.ok) {
        throw await createApiRequestError(res, 'Ошибка загрузки фото.');
      }

      const data = await res.json();
      onAnimalMetaUpdate({
        photoCount: data.count,
        imageFolder: data.folder
      });
      toast.success('Фото добавлены!');
      setGalleryUploadFiles([]);
      await fetchGalleryImages(selectedAnimal.id);
      await refreshMapData();
    } catch (error) {
      if (isAdminSessionExpiredError(error)) {
        onAuthorizationExpired();
        setGalleryUploadError(ADMIN_SESSION_EXPIRED_MESSAGE);
      } else {
        setGalleryUploadError(getApiRequestErrorMessage(error, 'Ошибка загрузки фото.'));
      }
    } finally {
      setIsGalleryUploading(false);
    }
  }, [
    fetchGalleryImages,
    galleryUploadFiles,
    isAuthenticated,
    onAnimalMetaUpdate,
    onAuthorizationExpired,
    refreshMapData,
    selectedAnimal
  ]);

  const handleDeleteGalleryPhoto = useCallback(async (fileName: string) => {
    if (!selectedAnimal) return;
    if (!isAuthenticated) {
      toast.error('Требуется авторизация администратора.');
      return;
    }

    const confirmDelete = window.confirm(`Удалить фото "${fileName}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetchWithRetry(
        apiUrl(`/api/species/${selectedAnimal.id}/photos/${encodeURIComponent(fileName)}`),
        { method: 'DELETE', headers: createAuthHeaders() }
      );
      if (!res.ok) {
        throw await createApiRequestError(res, 'Ошибка удаления фото.');
      }

      const data = await res.json();
      onAnimalMetaUpdate({
        photoCount: data.count,
        imageFolder: data.folder
      });
      await fetchGalleryImages(selectedAnimal.id);
      await refreshMapData();
    } catch (error) {
      if (isAdminSessionExpiredError(error)) {
        onAuthorizationExpired();
      } else {
        toast.error(getApiRequestErrorMessage(error, 'Ошибка удаления фото.'));
      }
    }
  }, [fetchGalleryImages, isAuthenticated, onAnimalMetaUpdate, onAuthorizationExpired, refreshMapData, selectedAnimal]);

  return {
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
  };
};

export type UseGalleryResult = ReturnType<typeof useGallery>;

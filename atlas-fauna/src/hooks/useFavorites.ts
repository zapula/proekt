import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { User } from '../types';
import { apiUrl } from '../utils/api';
import { createAuthHeaders } from '../utils/auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function useFavorites(user: User | null) {
  const [favorites, setFavorites] = useState<number[]>([]);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !user) {
      setFavorites([]);
      return;
    }

    fetchWithRetry(apiUrl('/api/favorites'), {
      headers: createAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => {
        const ids = Array.isArray(data) ? data.map((row: any) => Number(row.animal_id)) : [];
        setFavorites(ids.filter((id) => Number.isFinite(id)));
      })
      .catch(() => {
        setFavorites([]);
      });
  }, [user, userId]);

  const isFavorite = useCallback((animalId: number) => favorites.includes(animalId), [favorites]);

  const toggleFavorite = useCallback(
    async (animalId: number) => {
      if (!userId || !user) {
        toast.error('Войдите, чтобы добавить в избранное');
        return;
      }

      const currentlyFavorite = favorites.includes(animalId);

      try {
        if (currentlyFavorite) {
          await fetchWithRetry(apiUrl(`/api/favorites/${animalId}`), {
            method: 'DELETE',
            headers: createAuthHeaders()
          });
          setFavorites((prev) => prev.filter((id) => id !== animalId));
          toast.success('Удалено из избранного');
          return;
        }

        await fetchWithRetry(apiUrl('/api/favorites'), {
          method: 'POST',
          headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ animalId })
        });
        setFavorites((prev) => [...prev, animalId]);
        toast.success('Добавлено в избранное');
      } catch (error) {
        toast.error('Ошибка при обновлении избранного');
      }
    },
    [favorites, user, userId]
  );

  return useMemo(
    () => ({
      favorites,
      toggleFavorite,
      isFavorite
    }),
    [favorites, isFavorite, toggleFavorite]
  );
}

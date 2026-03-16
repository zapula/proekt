import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import type { IAnimal } from '../animals';
import { apiUrl } from '../utils/api';
import type { User } from '../types';
import { createAuthHeaders } from '../utils/auth';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const DEFAULT_SATIETY = 20;

interface UseAnimalProgressParams {
  user: User | null;
  selectedAnimal: IAnimal | null;
}

export const useAnimalProgress = ({ user, selectedAnimal }: UseAnimalProgressParams) => {
  const [satiety, setSatiety] = useState(0);
  const [isAdult, setIsAdult] = useState(false);
  const [timesGrown, setTimesGrown] = useState(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadRequestIdRef = useRef(0);

  const resetProgress = useCallback(() => {
    setSatiety(DEFAULT_SATIETY);
    setIsAdult(false);
    setTimesGrown(0);
  }, []);

  useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
    };
  }, []);

  const loadProgress = useCallback(
    async (locationId: number) => {
      loadAbortRef.current?.abort();

      if (!user) {
        resetProgress();
        return;
      }

      const abortController = new AbortController();
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      loadAbortRef.current = abortController;

      try {
        const res = await fetchWithRetry(apiUrl('/api/progress'), {
          headers: createAuthHeaders(),
          signal: abortController.signal
        });
        if (!res.ok || abortController.signal.aborted || requestId !== loadRequestIdRef.current) return;

        const data = await res.json();
        if (abortController.signal.aborted || requestId !== loadRequestIdRef.current) return;
        const progress = data.find((item: any) => item.animal_location_id === locationId);
        if (!progress) {
          resetProgress();
          return;
        }

        setSatiety(progress.satiety);
        setIsAdult(progress.is_adult);
        setTimesGrown(progress.times_grown || 0);
      } catch (error) {
        if (
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        console.error(error);
      } finally {
        if (loadAbortRef.current === abortController) {
          loadAbortRef.current = null;
        }
      }
    },
    [resetProgress, user]
  );

  const saveProgressToDb = useCallback(
    async (newSatiety: number, newIsAdult: boolean, newTimesGrown: number) => {
      if (!user || !selectedAnimal) return;

      try {
        const res = await fetchWithRetry(apiUrl('/api/progress'), {
          method: 'POST',
          headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            locationId: selectedAnimal.locationId,
            satiety: newSatiety,
            isAdult: newIsAdult,
            timesGrown: newTimesGrown
          })
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.newAchievements?.length) return;

        data.newAchievements.forEach((achievement: any) => {
          toast(`🎉 Достижение: ${achievement.title}`, {
            duration: 5000,
            icon: achievement.icon || '🏆',
            style: {
              border: '1px solid #fbc02d',
              background: '#fff9c4',
              color: '#000000',
              fontWeight: '500'
            }
          });
        });
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      } catch (error) {
        console.error(error);
      }
    },
    [selectedAnimal, user]
  );

  return {
    satiety,
    setSatiety,
    isAdult,
    setIsAdult,
    timesGrown,
    setTimesGrown,
    loadProgress,
    saveProgressToDb,
    resetProgress
  };
};

export type UseAnimalProgressResult = ReturnType<typeof useAnimalProgress>;

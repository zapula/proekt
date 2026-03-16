import { useCallback, useState } from 'react';
import type { IAnimal, ISpecies } from '../animals';
import { apiUrl } from '../utils/api';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { toAnimal, toSpecies } from '../utils/speciesUtils';

export function useMapSpeciesData() {
  const [mapAnimals, setMapAnimals] = useState<IAnimal[]>([]);
  const [speciesList, setSpeciesList] = useState<ISpecies[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsDataLoading(true);
    setDataLoadError(null);

    try {
      const [mapRes, speciesRes] = await Promise.all([
        fetchWithRetry(apiUrl('/api/map-data')),
        fetchWithRetry(apiUrl('/api/species'))
      ]);

      if (!mapRes.ok || !speciesRes.ok) {
        throw new Error('data_load_failed');
      }

      const [mapData, speciesData] = await Promise.all([mapRes.json(), speciesRes.json()]);
      const formattedAnimals = Array.isArray(mapData) ? mapData.map(toAnimal) : [];
      const normalizedSpecies = Array.isArray(speciesData) ? speciesData.map(toSpecies) : [];

      setMapAnimals(formattedAnimals);
      setSpeciesList(normalizedSpecies);
    } catch (error) {
      console.error('Ошибка загрузки данных карты:', error);
      setDataLoadError('Не удалось загрузить данные карты. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  return {
    mapAnimals,
    setMapAnimals,
    speciesList,
    setSpeciesList,
    isDataLoading,
    dataLoadError,
    fetchData
  };
}

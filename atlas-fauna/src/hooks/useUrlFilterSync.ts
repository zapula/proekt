import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { AnimalCategory, DietType } from '../animals';
import type { RegionCode } from '../regions';

interface UseUrlFilterSyncParams {
  selectedRegion: RegionCode | null;
  activeCategory: AnimalCategory;
  dietFilter: DietType | 'all';
  redBookOnly: boolean;
  searchTerm: string;
  isEnabled?: boolean;
  setSelectedRegion: Dispatch<SetStateAction<RegionCode | null>>;
  setIsLandingOpen: Dispatch<SetStateAction<boolean>>;
  setActiveCategory: (value: AnimalCategory) => void;
  setDietFilter: (value: DietType | 'all') => void;
  setRedBookOnly: (value: boolean) => void;
  setSearchTerm: (value: string) => void;
  isSupportedRegionCode: (value: string) => value is RegionCode;
}

export function useUrlFilterSync({
  selectedRegion,
  activeCategory,
  dietFilter,
  redBookOnly,
  searchTerm,
  isEnabled = true,
  setSelectedRegion,
  setIsLandingOpen,
  setActiveCategory,
  setDietFilter,
  setRedBookOnly,
  setSearchTerm,
  isSupportedRegionCode
}: UseUrlFilterSyncParams) {
  useEffect(() => {
    if (!isEnabled) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const regionParam = params.get('region');
    const categoryParam = params.get('category');
    const dietParam = params.get('diet');
    const redBookParam = params.get('redBook');
    const queryParam = params.get('search') || params.get('q');

    if (regionParam && isSupportedRegionCode(regionParam)) {
      setSelectedRegion(regionParam);
      setIsLandingOpen(false);
    }

    if (categoryParam === 'all' || categoryParam === 'mammal' || categoryParam === 'bird') {
      setActiveCategory(categoryParam);
    }

    if (dietParam === 'all' || dietParam === 'herbivore' || dietParam === 'carnivore' || dietParam === 'omnivore') {
      setDietFilter(dietParam);
    }

    if (redBookParam === '1') {
      setRedBookOnly(true);
    }

    if (queryParam) {
      setSearchTerm(queryParam);
    }
  }, [
    isEnabled,
    isSupportedRegionCode,
    setActiveCategory,
    setDietFilter,
    setIsLandingOpen,
    setRedBookOnly,
    setSearchTerm,
    setSelectedRegion
  ]);

  useEffect(() => {
    if (!isEnabled) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);

    if (selectedRegion) params.set('region', selectedRegion);
    else params.delete('region');

    if (activeCategory !== 'all') params.set('category', activeCategory);
    else params.delete('category');

    if (dietFilter !== 'all') params.set('diet', dietFilter);
    else params.delete('diet');

    if (redBookOnly) params.set('redBook', '1');
    else params.delete('redBook');

    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    else params.delete('search');
    params.delete('q');

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [activeCategory, dietFilter, isEnabled, redBookOnly, searchTerm, selectedRegion]);
}

import { useMemo, useState } from 'react';
import type { AnimalCategory, DietType, IAnimal } from '../animals';

export interface SearchFilters {
  category: AnimalCategory;
  diet: DietType | 'all';
  redBook: boolean;
}

const initialFilters: SearchFilters = {
  category: 'all',
  diet: 'all',
  redBook: false
};

export function useSearch(animals: IAnimal[], externalSearchTerm?: string) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const effectiveSearchTerm = externalSearchTerm ?? searchTerm;

  const filteredAnimals = useMemo(() => {
    return animals.filter((animal) => {
      const matchesSearch = animal.name.toLowerCase().includes(effectiveSearchTerm.toLowerCase());
      const matchesCategory = filters.category === 'all' || animal.category === filters.category;
      const matchesDiet = filters.diet === 'all' || animal.diet === filters.diet;
      const matchesRedBook = !filters.redBook || animal.isRedBook;

      return matchesSearch && matchesCategory && matchesDiet && matchesRedBook;
    });
  }, [animals, effectiveSearchTerm, filters]);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    filteredAnimals
  };
}

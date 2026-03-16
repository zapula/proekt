import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSearch } from '../../hooks/useSearch';
import type { IAnimal } from '../../animals';

const animals: IAnimal[] = [
  {
    id: 1,
    locationId: 11,
    name: 'Амурский тигр',
    category: 'mammal',
    diet: 'carnivore',
    isRedBook: true,
    coordinates: [43.1, 131.9],
    modelUrl: '/models/tiger.glb',
    iconFile: 'tiger.png',
    imageFolder: 'tiger',
    photoCount: 2
  },
  {
    id: 2,
    locationId: 12,
    name: 'Гусь',
    category: 'bird',
    diet: 'omnivore',
    isRedBook: false,
    coordinates: [48.5, 135.1],
    modelUrl: '/models/goose.glb',
    iconFile: 'goose.png',
    imageFolder: 'goose',
    photoCount: 1
  }
];

describe('useSearch', () => {
  it('filters animals by search term', () => {
    const { result } = renderHook(() => useSearch(animals));

    act(() => {
      result.current.setSearchTerm('тигр');
    });

    expect(result.current.filteredAnimals).toHaveLength(1);
    expect(result.current.filteredAnimals[0].name).toBe('Амурский тигр');
  });

  it('filters red book animals only', () => {
    const { result } = renderHook(() => useSearch(animals));

    act(() => {
      result.current.setFilters((prev) => ({ ...prev, redBook: true }));
    });

    expect(result.current.filteredAnimals).toHaveLength(1);
    expect(result.current.filteredAnimals[0].isRedBook).toBe(true);
  });
});

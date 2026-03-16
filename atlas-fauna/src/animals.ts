// src/animals.ts

export type AnimalCategory = 'all' | 'mammal' | 'bird';
export type DietType = 'carnivore' | 'herbivore' | 'omnivore';

// 1. Интерфейс Вида (Справочник)
// Описывает, как выглядит животное вообще (имя, модель, иконка)
export interface ISpecies {
  id: number;
  name: string;
  category: AnimalCategory;
  diet: DietType;
  isRedBook: boolean;
  modelUrl: string;
  modelUrlChild?: string;
  modelUrlAdult?: string;
  iconFile: string;
  imageFolder: string;
  photoCount: number;
}

// 2. Интерфейс Животного на карте (Вид + Координаты)
// Наследует всё от ISpecies, но добавляет уникальные координаты и ID точки
export interface IAnimal extends ISpecies {
  locationId: number; // Уникальный ID точки на карте (для сохранения прогресса)
  coordinates: [number, number];
  markerHaloRadius?: number | null;
}

// Массив пустой, так как теперь мы всё загружаем с сервера
export const animalsData: IAnimal[] = [];

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'user' | string;
  username?: string;
}

export interface AnimalProgress {
  satiety: number;
  isAdult: boolean;
  timesGrown: number;
}

export interface WikiData {
  text: string;
  habitat: string;
  food: string;
  size: string;
  trait: string;
}

export interface NewSpeciesForm {
  name: string;
  category: 'mammal' | 'bird';
  diet: 'herbivore' | 'carnivore' | 'omnivore';
  isRedBook: boolean;
  imageFolder: string;
}

export const Tab = {
  Game: 'game',
  Info: 'info',
  Gallery: 'gallery'
} as const;

export type Tab = (typeof Tab)[keyof typeof Tab];

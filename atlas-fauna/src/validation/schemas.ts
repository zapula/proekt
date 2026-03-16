import { z } from 'zod';

export const animalSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  category: z.enum(['mammal', 'bird']),
  diet: z.enum(['herbivore', 'carnivore', 'omnivore']),
  isRedBook: z.boolean().optional().default(false),
  coordinates: z.tuple([
    z.number().min(-90).max(90),
    z.number().min(-180).max(180)
  ])
});

export const locationSchema = z.object({
  species_id: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const userSchema = z.object({
  email: z.string().email('Неверный формат email'),
  password: z.string().min(8, 'Минимум 8 символов')
});

export const wikiSchema = z.object({
  text: z.string().max(5000),
  habitat: z.string().max(500),
  food: z.string().max(500),
  size: z.string().max(200),
  trait: z.string().max(500)
});

# Атлас фауны Дальнего Востока

Интерактивный веб-проект о животных Дальнего Востока с картой регионов, 3D-моделями, пользовательским прогрессом и административной частью.

![Превью проекта](atlas-fauna/src/assets/hero.jpg)

## Что внутри

- интерактивная карта с 5 регионами Дальнего Востока;
- 3D-модели животных;
- галерея изображений для каждого вида;
- геймификация: кормление, рост, достижения;
- избранное и прогресс для авторизованных пользователей;
- админ-панель для управления данными;
- фильтрация краснокнижных видов и региональная статистика.

## Технологии

- Frontend: React 19, TypeScript, Vite
- 3D: Three.js, React Three Fiber
- Maps: Яндекс.Карты
- Backend: Node.js, Express
- Validation: Zod
- Testing: Vitest, Testing Library

## Быстрый старт

### Frontend

```bash
cd atlas-fauna
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
node index.js
```

## Основные API endpoints

### Animals

- `GET /api/map-data`
- `GET /api/species`
- `POST /api/species`
- `PUT /api/species/:name`

### Locations

- `POST /api/locations`
- `PUT /api/locations/:id`
- `DELETE /api/locations/:id`

### Favorites

- `GET /api/favorites/:userId`
- `POST /api/favorites`
- `DELETE /api/favorites/:userId/:animalId`

### Progress

- `GET /api/progress/:userId`
- `POST /api/progress`

### Auth

- `POST /api/register`
- `POST /api/login`

## Разработка

```bash
# Frontend
cd atlas-fauna
npm run dev
npm run build
npm run lint
npm test

# Backend
cd server
node index.js
```

## Лицензия

[MIT](LICENSE)

# Атлас фауны Дальнего Востока

Интерактивная карта с 3D-моделями животных, системой прогресса и достижениями.

## Возможности

- Интерактивная карта с 5 регионами Дальнего Востока
- 3D-модели животных (детеныши и взрослые особи)
- Геймификация: кормление, рост, достижения
- Галерея фотографий для каждого вида
- Озвучка описаний животных
- Система пользователей с прогрессом
- Админ-панель для управления данными
- Избранное для авторизованных пользователей
- Краснокнижные виды с фильтрацией и региональной статистикой

## Установка

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd ../server
npm install
node index.js
```

### База данных

```sql
-- Создайте PostgreSQL базу данных atlas_fauna
-- Выполните скрипты из server/migrations/
-- 001_create_favorites.sql
-- 002_add_is_red_book_to_species.sql
```

## Структура проекта

```text
src/
├── components/         # React компоненты
│   ├── Landing.tsx
│   ├── SearchPanel.tsx
│   └── LoadingSpinner.tsx
├── contexts/
│   └── AppContext.tsx
├── hooks/
│   ├── useAnimalProgress.ts
│   ├── useSearch.ts
│   ├── useFavorites.ts
│   └── ...
├── validation/
│   └── schemas.ts
├── utils/
│   └── fetchWithRetry.ts
└── App.tsx

server/
├── index.js
└── migrations/
    ├── 001_create_favorites.sql
    └── 002_add_is_red_book_to_species.sql
```

## API Endpoints

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

## Технологии

- Frontend: React 19, TypeScript, Vite
- 3D: Three.js, React Three Fiber
- Maps: Яндекс.Карты
- Backend: Node.js, Express
- Database: PostgreSQL
- Validation: Zod
- Testing: Vitest, Testing Library

## Разработка

```bash
# Frontend
npm run dev
npm run build
npm run lint
npm test

# Backend
cd ../server
node index.js
```

## Лицензия

MIT

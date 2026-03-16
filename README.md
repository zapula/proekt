# Атлас фауны Дальнего Востока

Интерактивный веб-проект с картой Дальнего Востока, 3D-моделями животных, системой прогресса и пользовательскими сценариями.

## Возможности

- Интерактивная карта с 5 регионами Дальнего Востока
- 3D-модели животных
- Геймификация: кормление, рост, достижения
- Галерея фотографий для каждого вида
- Озвучка описаний животных
- Система пользователей с прогрессом
- Админ-панель для управления данными
- Избранное для авторизованных пользователей
- Краснокнижные виды с фильтрацией и региональной статистикой

## Запуск

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
- Validation: Zod
- Testing: Vitest, Testing Library

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

MIT

// server/index.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const { z } = require('zod');

const app = express();
const port = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'atlas_fauna_auth';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// === ФАЙЛЫ И АССЕТЫ ===
const publicRoot = path.resolve(__dirname, '..', 'atlas-fauna', 'public');
const iconsDir = path.join(publicRoot, 'icons');
const modelsDir = path.join(publicRoot, 'models');
const imagesDir = path.join(publicRoot, 'images');
const logsDir = path.join(__dirname, 'logs');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

[iconsDir, modelsDir, imagesDir, logsDir].forEach(ensureDir);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'server.log') }),
    new winston.transports.File({ filename: path.join(logsDir, 'security.log'), level: 'warn' })
  ]
});

if (!process.env.JWT_SECRET) {
  logger.error({
    event: 'security.jwt_secret_missing',
    message: 'JWT_SECRET не задан. Запуск остановлен.'
  });
  process.exit(1);
}

// === НАСТРОЙКИ БАЗЫ ДАННЫХ ===
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'atlas_fauna',
  password: process.env.DB_PASSWORD || 'bonaqua',
  port: Number(process.env.DB_PORT || 5433),
});

// === MIDDLEWARE ===
const allowedOrigins = String(process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn({ event: 'security.cors_blocked', origin });
    return callback(new Error('Источник запроса не разрешён политикой CORS.'));
  },
  credentials: true
};

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Слишком много действий подряд. Подождите немного и попробуйте снова.',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток входа. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Слишком много загрузок подряд. Подождите немного и попробуйте снова.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_MODEL_UPLOAD_BYTES = 10 * 1024 * 1024;

const animalSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['mammal', 'bird']),
  diet: z.enum(['herbivore', 'carnivore', 'omnivore']),
  is_red_book: z.boolean().optional().default(false)
});

const locationSchema = z.object({
  species_id: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const locationMarkerHaloSchema = z.object({
  marker_halo_radius: z.number().int().min(100).max(100000).nullable()
});

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const wikiSchema = z.object({
  wiki_text: z.string().max(5000).optional().default(''),
  habitat: z.string().max(500).optional().default(''),
  food: z.string().max(500).optional().default(''),
  size: z.string().max(200).optional().default(''),
  trait: z.string().max(500).optional().default(''),
  category: z.enum(['mammal', 'bird']),
  diet: z.enum(['herbivore', 'carnivore', 'omnivore'])
});

const progressSchema = z.object({
  locationId: z.number().int().positive(),
  satiety: z.number().min(0).max(100),
  isAdult: z.boolean(),
  timesGrown: z.number().int().min(0)
});

const actionSchema = z.object({
  type: z.enum(['gallery', 'voice'])
});

const favoriteSchema = z.object({
  animalId: z.number().int().positive()
});

const parseCookieHeader = (cookieHeader = '') => {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
};

const getAuthTokenFromRequest = (req) => {
  const cookies = parseCookieHeader(req.headers.cookie || '');
  const cookieToken = cookies[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }

  return { token: null, source: null };
};

const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/'
});

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
};

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  const { token, source } = getAuthTokenFromRequest(req);

  if (!token) {
    logger.warn({ event: 'security.auth_missing_token', path: req.path, method: req.method });
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    return next();
  } catch (error) {
    logger.warn({ event: 'security.auth_invalid_token', path: req.path, method: req.method, source });
    return res.status(403).json({ error: 'Невалидный или просроченный токен' });
  }
};

// Middleware для проверки роли администратора
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    logger.warn({
      event: 'security.auth_admin_required',
      path: req.path,
      method: req.method,
      userId: req.user?.id || null
    });
    return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
  }
  return next();
};

// Логирование всех запросов
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info({
      event: 'http.request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id || null
    });
  });
  next();
});

// Static assets for frontend runtime (works for both dev and built frontend).
app.use('/icons', express.static(iconsDir));
app.use('/models', express.static(modelsDir));
app.use('/images', express.static(imagesDir));

const safeFileName = (name) => {
  const base = path.basename(name);
  const cleaned = base.replace(/[^\p{L}\p{N}._-]/gu, '_');
  return cleaned || `file_${Date.now()}`;
};

const uniqueFileName = (dirPath, fileName) => {
  const ext = path.extname(fileName);
  const name = path.basename(fileName, ext);
  let candidate = fileName;
  let counter = 1;
  while (fs.existsSync(path.join(dirPath, candidate))) {
    candidate = `${name}_${counter}${ext}`;
    counter += 1;
  }
  return candidate;
};

const maskEmail = (email) => {
  const [rawLocal = '', rawDomain = ''] = String(email || '').split('@');
  const local = rawLocal.trim();
  const domain = rawDomain.trim();

  if (!local || !domain) {
    return 'hidden_user';
  }

  const visibleLocal = local.length <= 2 ? local[0] || '*' : `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local.at(-1)}`;
  const [domainName = '', ...domainRest] = domain.split('.');
  const visibleDomainName =
    domainName.length <= 2
      ? `${domainName[0] || '*'}*`
      : `${domainName[0]}${'*'.repeat(Math.max(domainName.length - 2, 1))}${domainName.at(-1)}`;
  const domainSuffix = domainRest.length > 0 ? `.${domainRest.join('.')}` : '';

  return `${visibleLocal}@${visibleDomainName}${domainSuffix}`;
};

const safeFolderName = (name) => {
  const trimmed = String(name || '').trim();
  const cleaned = trimmed
    .replace(/[\\/]/g, '')
    .replace(/[^\p{L}\p{N}_-]/gu, '_');
  return cleaned || `folder_${Date.now()}`;
};

const countImages = (folderPath) => {
  if (!fs.existsSync(folderPath)) return 0;
  const files = fs.readdirSync(folderPath);
  return files.filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file)).length;
};

const listImages = (folderPath) => {
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file));
  files.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  return files;
};

const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Недопустимый тип файла. Разрешены только JPG, PNG, WEBP.'), false);
};

const iconFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Недопустимый тип файла иконки. Разрешены JPG, PNG, WEBP, SVG.'), false);
};

const modelFileFilter = (req, file, cb) => {
  const allowedExt = ['.glb', '.gltf'];
  const allowedMimeTypes = [
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream',
    'application/gltf-buffer',
    'application/json'
  ];
  const fileExt = path.extname(file.originalname).toLowerCase();

  if (!allowedExt.includes(fileExt)) {
    cb(new Error('Недопустимый формат 3D-модели. Разрешены только .glb и .gltf.'), false);
    return;
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Недопустимый MIME-тип 3D-модели.'), false);
    return;
  }

  cb(null, true);
};

const makeUploader = ({ dirPath, fileFilter, fileSize }) => multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir(dirPath);
      cb(null, dirPath);
    },
    filename: (req, file, cb) => {
      const cleaned = safeFileName(file.originalname);
      const unique = uniqueFileName(dirPath, cleaned);
      cb(null, unique);
    }
  }),
  limits: { fileSize },
  fileFilter
});

const uploadIcon = makeUploader({
  dirPath: iconsDir,
  fileFilter: iconFileFilter,
  fileSize: MAX_IMAGE_UPLOAD_BYTES
});
const uploadModel = makeUploader({
  dirPath: modelsDir,
  fileFilter: modelFileFilter,
  fileSize: MAX_MODEL_UPLOAD_BYTES
});
const uploadPhotos = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = safeFolderName(req.query.folder || req.body.folder);
      const targetDir = path.join(imagesDir, folder);
      ensureDir(targetDir);
      req.uploadFolder = folder;
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const cleaned = safeFileName(file.originalname);
      const folder = req.uploadFolder || safeFolderName('photos');
      const targetDir = path.join(imagesDir, folder);
      const unique = uniqueFileName(targetDir, cleaned);
      cb(null, unique);
    }
  }),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
  fileFilter: imageFileFilter
});

const uploadSpeciesPhotos = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const folder = req.speciesFolder || safeFolderName('photos');
      const targetDir = path.join(imagesDir, folder);
      ensureDir(targetDir);
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const cleaned = safeFileName(file.originalname);
      const folder = req.speciesFolder || safeFolderName('photos');
      const targetDir = path.join(imagesDir, folder);
      const unique = uniqueFileName(targetDir, cleaned);
      cb(null, unique);
    }
  }),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
  fileFilter: imageFileFilter
});

// ==========================================
// КОНФИГУРАЦИЯ ДОСТИЖЕНИЙ
// ==========================================
const ACHIEVEMENTS = [
  // A. Прогресс
  { code: 'first_steps', title: 'Первые шаги', desc: 'Вырастить 1 животное', icon: '🌱', threshold: 1, type: 'count_unique' },
  { code: 'naturalist', title: 'Юный натуралист', desc: 'Вырастить 5 видов', icon: '🌿', threshold: 5, type: 'count_unique' },
  { code: 'expert', title: 'Знаток природы', desc: 'Вырастить 10 видов', icon: '🌲', threshold: 10, type: 'count_unique' },
  { code: 'keeper', title: 'Хранитель леса', desc: 'Вырастить 20 видов', icon: '🏆', threshold: 20, type: 'count_unique' },

  // C. Упорство
  { code: 'fan', title: 'Любимчик', desc: 'Вырастить один вид 5 раз', icon: '💚', threshold: 5, type: 'max_single' },
  { code: 'mentor', title: 'Наставник', desc: 'Вырастить один вид 10 раз', icon: '💙', threshold: 10, type: 'max_single' },
  { code: 'legend', title: 'Легенда', desc: 'Вырастить один вид 25 раз', icon: '💜', threshold: 25, type: 'max_single' },

  // D. Исследование
  { code: 'photographer', title: 'Фотограф', desc: 'Открыть галерею 10 раз', icon: '📸', threshold: 10, type: 'stat_gallery' },
  { code: 'listener', title: 'Слушатель', desc: 'Послушать описание 10 раз', icon: '🔊', threshold: 10, type: 'stat_voice' },
];

// === ФУНКЦИЯ ПРОВЕРКИ ДОСТИЖЕНИЙ ===
const checkAchievements = async (userId) => {
  const newUnlocked = [];
  try {
    const progressRes = await pool.query('SELECT * FROM user_progress WHERE user_id = $1', [userId]);
    const statsRes = await pool.query('SELECT * FROM user_global_stats WHERE user_id = $1', [userId]);
    const existingAchievsRes = await pool.query('SELECT achievement_code FROM user_achievements WHERE user_id = $1', [userId]);
    
    const progress = progressRes.rows; 
    const globalStats = statsRes.rows[0] || { gallery_opens: 0, voice_listens: 0 };
    const existingCodes = new Set(existingAchievsRes.rows.map(r => r.achievement_code));

    const uniqueGrown = progress.filter(p => p.times_grown > 0).length;
    const maxSingleGrown = progress.reduce((max, p) => Math.max(max, p.times_grown), 0);

    for (const ach of ACHIEVEMENTS) {
      if (existingCodes.has(ach.code)) continue;

      let unlocked = false;
      if (ach.type === 'count_unique' && uniqueGrown >= ach.threshold) unlocked = true;
      if (ach.type === 'max_single' && maxSingleGrown >= ach.threshold) unlocked = true;
      if (ach.type === 'stat_gallery' && globalStats.gallery_opens >= ach.threshold) unlocked = true;
      if (ach.type === 'stat_voice' && globalStats.voice_listens >= ach.threshold) unlocked = true;

      if (unlocked) {
        await pool.query('INSERT INTO user_achievements (user_id, achievement_code) VALUES ($1, $2)', [userId, ach.code]);
        newUnlocked.push(ach);
      }
    }
  } catch (e) {
    logger.error({ event: 'achievement.check_error', error: e.message || String(e) });
  }
  return newUnlocked; 
};

// ==========================================
// 1. АВТОРИЗАЦИЯ
// ==========================================

const buildUserPayload = (userRow) => {
  const inferredRole = userRow.role || (userRow.email === ADMIN_EMAIL ? 'admin' : 'user');
  return {
    id: userRow.id,
    email: userRow.email,
    role: inferredRole
  };
};

const ensureSecuritySchema = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'
  `);

  await pool.query(`
    UPDATE users
    SET role = 'admin'
    WHERE email = $1
  `, [ADMIN_EMAIL]);
};

const ensureAnimalLocationsSchema = async () => {
  await pool.query(`
    ALTER TABLE animal_locations
    ADD COLUMN IF NOT EXISTS marker_halo_radius INTEGER NULL
  `);

  // One-time normalization: older builds stored halo radius in UI units (1 unit ~= 50m).
  await pool.query(`
    UPDATE animal_locations
    SET marker_halo_radius = marker_halo_radius * 50
    WHERE marker_halo_radius BETWEEN 1 AND 84
  `);
};

app.post('/api/register', authLimiter, async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные' });
  }

  const { email, password } = parsed.data;
  
  // Валидация email
  if (!email || !password) {
    return res.status(400).json({ error: 'Электронная почта и пароль обязательны' });
  }

  // Проверка требований к паролю
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpperCase) {
    return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну заглавную букву' });
  }
  if (!hasLowerCase) {
    return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну строчную букву' });
  }
  if (!hasNumber) {
    return res.status(400).json({ error: 'Пароль должен содержать хотя бы одну цифру' });
  }
  if (!hasSpecialChar) {
    return res.status(400).json({ error: 'Пароль должен содержать хотя бы один специальный символ' });
  }

  try {
    const check = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с такой электронной почтой уже существует' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role',
      [email, hashedPassword]
    );

    const userPayload = buildUserPayload(newUser.rows[0]);
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, token);

    logger.info({ event: 'auth.register_success', userId: userPayload.id, email: userPayload.email });
    return res.json({ user: userPayload });
  } catch (err) {
    logger.error({ event: 'auth.register_error', error: err.message || String(err) });
    return res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные' });
  }

  const { email, password } = parsed.data;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !isMatch) {
      logger.warn({ event: 'security.auth_invalid_credentials', email });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const userPayload = buildUserPayload(user);
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setAuthCookie(res, token);
    return res.json({ user: userPayload });
  } catch (err) {
    logger.error({ event: 'auth.login_error', error: err.message || String(err) });
    return res.status(500).json({ error: 'Ошибка входа' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const userPayload = buildUserPayload(req.user || {});
  return res.json({ user: userPayload });
});

app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

// ==========================================
// 2. КАРТА, ВИДЫ, ЛОКАЦИИ (И ЭНЦИКЛОПЕДИЯ)
// ==========================================

// --- Загрузка файлов (иконки, модели, фото) ---
app.get('/api/uploads/check', authenticateToken, requireAdmin, async (req, res) => {
  const name = String(req.query.name || '').trim();
  const folder = safeFolderName(req.query.folder || '');
  let nameExists = false;
  let folderUsedBySpecies = false;

  if (name) {
    try {
      const check = await pool.query('SELECT 1 FROM species WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
      nameExists = check.rows.length > 0;
    } catch (err) {
      return res.status(500).json({ error: 'Ошибка проверки названия' });
    }
  }

  const folderExists = folder ? fs.existsSync(path.join(imagesDir, folder)) : false;

  if (folder) {
    try {
      const folderCheck = await pool.query('SELECT 1 FROM species WHERE image_folder = $1 LIMIT 1', [folder]);
      folderUsedBySpecies = folderCheck.rows.length > 0;
    } catch (err) {
      return res.status(500).json({ error: 'Ошибка проверки папки' });
    }
  }

  res.json({ nameExists, folderExists, folderUsedBySpecies, folder });
});

app.post('/api/uploads/icon', authenticateToken, requireAdmin, uploadLimiter, uploadIcon.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
  res.json({ file: req.file.filename });
});

app.post('/api/uploads/model', authenticateToken, requireAdmin, uploadLimiter, uploadModel.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
  res.json({ file: req.file.filename, url: `/models/${req.file.filename}` });
});

app.post('/api/uploads/photos', authenticateToken, requireAdmin, uploadLimiter, uploadPhotos.array('files', 200), (req, res) => {
  const folder = req.uploadFolder || safeFolderName(req.query.folder || '');
  const folderPath = path.join(imagesDir, folder);
  const count = countImages(folderPath);
  res.json({ folder, count });
});

const resolveSpeciesFolder = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, name, image_folder FROM species WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Вид не найден' });

    const row = result.rows[0];
    const folder = safeFolderName(row.image_folder || row.name);
    req.speciesFolder = folder;

    if (!row.image_folder || row.image_folder !== folder) {
      await pool.query('UPDATE species SET image_folder = $1 WHERE id = $2', [folder, row.id]);
    }

    ensureDir(path.join(imagesDir, folder));
    next();
  } catch (err) {
    res.status(500).json({ error: 'Ошибка подготовки папки' });
  }
};

app.post(
  '/api/species/:id/photos',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  resolveSpeciesFolder,
  uploadSpeciesPhotos.array('files', 200),
  async (req, res) => {
  const folder = req.speciesFolder || safeFolderName('photos');
  const folderPath = path.join(imagesDir, folder);
  const count = countImages(folderPath);
  try {
    await pool.query('UPDATE species SET photo_count = $1 WHERE id = $2', [count, req.params.id]);
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления количества фото' });
  }
  res.json({ folder, count });
  }
);

app.post(
  '/api/species/:id/model/child',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  uploadModel.single('file'),
  async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
  const url = `/models/${req.file.filename}`;
  try {
    await pool.query('UPDATE species SET model_url_child = $1 WHERE id = $2', [url, req.params.id]);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления модели' });
  }
  }
);

app.post(
  '/api/species/:id/model/adult',
  authenticateToken,
  requireAdmin,
  uploadLimiter,
  uploadModel.single('file'),
  async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не передан' });
  const url = `/models/${req.file.filename}`;
  try {
    await pool.query('UPDATE species SET model_url_adult = $1 WHERE id = $2', [url, req.params.id]);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления модели' });
  }
  }
);

app.delete('/api/species/:id/model/child', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE species SET model_url_child = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка очистки модели' });
  }
});

app.delete('/api/species/:id/model/adult', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE species SET model_url_adult = NULL WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка очистки модели' });
  }
});

app.get('/api/species/:id/photos', resolveSpeciesFolder, async (req, res) => {
  const folder = req.speciesFolder || safeFolderName('photos');
  const folderPath = path.join(imagesDir, folder);
  const files = listImages(folderPath);
  res.json({ folder, files });
});

app.delete('/api/species/:id/photos/:fileName', authenticateToken, requireAdmin, resolveSpeciesFolder, async (req, res) => {
  const folder = req.speciesFolder || safeFolderName('photos');
  const rawName = String(req.params.fileName || '');
  const fileName = path.basename(rawName);
  if (fileName !== rawName) {
    return res.status(400).json({ error: 'Некорректное имя файла' });
  }
  if (!/\.(png|jpe?g|webp|gif)$/i.test(fileName)) {
    return res.status(400).json({ error: 'Некорректный формат файла' });
  }
  const target = path.join(imagesDir, folder, fileName);

  if (!target.startsWith(path.join(imagesDir, folder))) {
    return res.status(400).json({ error: 'Некорректное имя файла' });
  }

  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
    const count = countImages(path.join(imagesDir, folder));
    await pool.query('UPDATE species SET photo_count = $1 WHERE id = $2', [count, req.params.id]);
    res.json({ folder, count });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления фото' });
  }
});

app.get('/api/map-data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id as location_id, l.lat, l.lng, l.marker_halo_radius,
      s.id as species_id, s.name, s.category, s.diet, s.is_red_book,
      s.model_url, s.model_url_child, s.model_url_adult,
      s.icon_file, s.image_folder, s.photo_count
      FROM animal_locations l JOIN species s ON l.species_id = s.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка карты' }); }
});

app.get('/api/species', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM species ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка видов' }); }
});

// === НОВОЕ: ПОЛУЧИТЬ ДАННЫЕ ЭНЦИКЛОПЕДИИ ПО ИМЕНИ ВИДА ===
app.get('/api/species/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    console.log('Запрос данных энциклопедии для вида:', name);

    const result = await pool.query('SELECT * FROM species WHERE name = $1', [name]);
    
    if (result.rows.length > 0) {
        console.log('Данные найдены в БД');
        res.json(result.rows[0]);
    } else {
        console.log('Вид не найден в БД, отправляем пустой ответ');
        res.json({}); 
    }
  } catch (err) {
    console.error('Ошибка GET /api/species/:name:', err);
    res.status(500).json({ error: 'Ошибка загрузки вида' });
  }
});

// === ОБНОВЛЕНИЕ ВИДА (КАТЕГОРИЯ И ТИП ПИТАНИЯ) ===
app.put('/api/species/:name', authenticateToken, requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  const parsed = wikiSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { wiki_text, habitat, food, size, trait, category, diet } = parsed.data;
  
  console.log('Запрос на сохранение:', name);
  console.log('Данные:', req.body);

  try {
    // 2. Обновлённый SQL: добавили diet ($8)
    await pool.query(`
      INSERT INTO species (
        name, 
        category, 
        diet, 
        wiki_text, 
        passport_habitat, 
        passport_food, 
        passport_size, 
        passport_trait
      )
      VALUES ($1, $7, $8, $2, $3, $4, $5, $6)
      ON CONFLICT (name) DO UPDATE 
      SET 
        category = $7, 
        diet = $8,
        wiki_text = $2, 
        passport_habitat = $3, 
        passport_food = $4, 
        passport_size = $5, 
        passport_trait = $6
    `, [name, wiki_text, habitat, food, size, trait, category, diet]);
    
    console.log('Успешно сохранено в БД');
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка SQL при сохранении:', err);
    res.status(500).json({ error: 'Ошибка сохранения энциклопедии' });
  }
});

app.post('/api/species', authenticateToken, requireAdmin, async (req, res) => {
  const parsed = animalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { name, category, diet, is_red_book } = parsed.data;
  const model_url = String(req.body.model_url || '');
  const icon_file = String(req.body.icon_file || '');
  const image_folder = String(req.body.image_folder || '');
  const safeFolder = image_folder ? safeFolderName(image_folder) : '';
  const photoCount = safeFolder ? countImages(path.join(imagesDir, safeFolder)) : 0;

  try {
    const result = await pool.query(
      `INSERT INTO species (name, category, diet, is_red_book, model_url, icon_file, image_folder, photo_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category, diet, is_red_book, model_url, icon_file, safeFolder, photoCount]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/species error:', err);
    res.status(500).json({ error: 'Ошибка создания вида' });
  }
});

app.put('/api/species/:id/red-book', authenticateToken, requireAdmin, async (req, res) => {
  const speciesId = Number(req.params.id);
  if (!Number.isFinite(speciesId)) {
    return res.status(400).json({ error: 'Некорректный ID вида' });
  }

  const parsed = z.object({ is_red_book: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    await pool.query('UPDATE species SET is_red_book = $1 WHERE id = $2', [parsed.data.is_red_book, speciesId]);
    res.json({ success: true, is_red_book: parsed.data.is_red_book });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка обновления статуса Красной книги' });
  }
});

app.post('/api/locations', authenticateToken, requireAdmin, async (req, res) => {
  const parsed = locationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { species_id, lat, lng } = parsed.data;
  try {
    const result = await pool.query(
      `INSERT INTO animal_locations (species_id, lat, lng) VALUES ($1, $2, $3) RETURNING *`,
      [species_id, lat, lng]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Ошибка добавления точки' }); }
});

app.put('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const parsed = locationSchema.omit({ species_id: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { lat, lng } = parsed.data;
  try {
    await pool.query('UPDATE animal_locations SET lat = $1, lng = $2 WHERE id = $3', [lat, lng, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка обновления' }); }
});

app.put('/api/locations/:id/marker-halo-radius', authenticateToken, requireAdmin, async (req, res) => {
  const locationId = Number(req.params.id);
  if (!Number.isFinite(locationId)) {
    return res.status(400).json({ error: 'Некорректный ID точки' });
  }

  const parsed = locationMarkerHaloSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { marker_halo_radius } = parsed.data;

  try {
    const result = await pool.query(
      `UPDATE animal_locations
       SET marker_halo_radius = $1
       WHERE id = $2
       RETURNING id, marker_halo_radius`,
      [marker_halo_radius, locationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Точка не найдена' });
    }

    return res.json({
      location_id: result.rows[0].id,
      marker_halo_radius: result.rows[0].marker_halo_radius
    });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка обновления радиуса ореола' });
  }
});

app.delete('/api/locations/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM user_progress WHERE animal_location_id = $1', [id]);
    await pool.query('DELETE FROM animal_locations WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка удаления' }); }
});

// ==========================================
// 2.1 ИЗБРАННОЕ
// ==========================================
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
    }

    const result = await pool.query(
      'SELECT animal_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось загрузить избранное' });
  }
});

app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const parsed = favoriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues });
    }

    const userId = Number(req.user.id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
    }

    const { animalId } = parsed.data;
    await pool.query(
      'INSERT INTO favorites (user_id, animal_id) VALUES ($1, $2) ON CONFLICT (user_id, animal_id) DO NOTHING',
      [userId, animalId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось добавить в избранное' });
  }
});

app.delete('/api/favorites/:animalId', authenticateToken, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const animalId = Number(req.params.animalId);
    if (!Number.isFinite(userId) || !Number.isFinite(animalId)) {
      return res.status(400).json({ error: 'Некорректные параметры' });
    }

    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND animal_id = $2',
      [userId, animalId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось удалить из избранного' });
  }
});

// ==========================================
// 3. ПРОГРЕСС И ДОСТИЖЕНИЯ
// ==========================================

app.get('/api/progress', authenticateToken, async (req, res) => {
  const userId = Number(req.user.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
  }
  try {
    const result = await pool.query('SELECT * FROM user_progress WHERE user_id = $1', [userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Ошибка прогресса' }); }
});

app.post('/api/progress', authenticateToken, async (req, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const userId = Number(req.user.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
  }

  const {
    locationId,
    satiety,
    isAdult,
    timesGrown
  } = parsed.data;

  try {
    await pool.query(
      `INSERT INTO user_progress (user_id, animal_location_id, satiety, is_adult, times_grown)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, animal_location_id) 
       DO UPDATE SET satiety = $3, is_adult = $4, times_grown = $5`,
      [userId, locationId, satiety, isAdult, timesGrown]
    );
    
    const newAchievs = await checkAchievements(userId);
    res.json({ success: true, newAchievements: newAchievs });
  } catch (err) { res.status(500).json({ error: 'Ошибка сохранения' }); }
});

app.post('/api/action', authenticateToken, async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const userId = Number(req.user.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
  }

  const { type } = parsed.data;
  const incrementColumn = type === 'gallery' ? 'gallery_opens' : 'voice_listens';
  const initialGallery = type === 'gallery' ? 1 : 0;
  const initialVoice = type === 'voice' ? 1 : 0;

  try {
    await pool.query(
      `INSERT INTO user_global_stats (user_id, gallery_opens, voice_listens)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET ${incrementColumn} = user_global_stats.${incrementColumn} + 1`,
      [userId, initialGallery, initialVoice]
    );
    
    const newAchievs = await checkAchievements(userId);
    res.json({ newAchievements: newAchievs });
  } catch (err) { res.status(500).json({ error: 'Ошибка действия' }); }
});

// ==========================================
// 4. ПОЛНЫЙ ПРОФИЛЬ
// ==========================================
app.get('/api/profile-full', authenticateToken, async (req, res) => {
  const userId = Number(req.user.id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Некорректный идентификатор пользователя в токене' });
  }

  try {
    // 1. Коллекция
    const collectionRes = await pool.query(`
      SELECT 
        l.id as location_id, s.name, s.icon_file, s.category,
        COALESCE(up.times_grown, 0) as times,
        COALESCE(up.satiety, 0) as satiety
      FROM animal_locations l
      JOIN species s ON l.species_id = s.id
      LEFT JOIN user_progress up ON up.animal_location_id = l.id AND up.user_id = $1
    `, [userId]);

    // 2. Ачивки
    const achievementsRes = await pool.query('SELECT * FROM user_achievements WHERE user_id = $1', [userId]);
    const unlockedCodes = new Set(achievementsRes.rows.map(r => r.achievement_code));
    
    // Статистика
    const statsRes = await pool.query('SELECT * FROM user_global_stats WHERE user_id = $1', [userId]);
    const globalStats = statsRes.rows[0] || { gallery_opens: 0, voice_listens: 0 };
    const uniqueGrown = collectionRes.rows.filter(p => p.times > 0).length;
    const maxSingleGrown = collectionRes.rows.reduce((max, p) => Math.max(max, p.times), 0);

    const achievementsList = ACHIEVEMENTS.map(ach => {
      let current = 0;
      if (ach.type === 'count_unique') current = uniqueGrown;
      if (ach.type === 'max_single') current = maxSingleGrown;
      if (ach.type === 'stat_gallery') current = globalStats.gallery_opens;
      if (ach.type === 'stat_voice') current = globalStats.voice_listens;

      return {
        ...ach,
        unlocked: unlockedCodes.has(ach.code),
        current: Math.min(current, ach.threshold),
        unlocked_at: achievementsRes.rows.find(r => r.achievement_code === ach.code)?.unlocked_at
      };
    });

    // 3. Рейтинг
    const leaderboardRes = await pool.query(`
      SELECT u.id as user_id,
        u.email,
        COUNT(DISTINCT up.animal_location_id) FILTER (WHERE up.times_grown > 0) as unique_species,
        COALESCE(SUM(up.times_grown), 0) as total_grown
      FROM users u
      LEFT JOIN user_progress up ON u.id = up.user_id
      GROUP BY u.id
      ORDER BY unique_species DESC, total_grown DESC, u.id ASC
      LIMIT 50
    `);

    const myRankIndex = leaderboardRes.rows.findIndex((r) => Number(r.user_id) === userId);
    const safeLeaderboard = leaderboardRes.rows.map((row) => ({
      display_name: maskEmail(row.email),
      unique_species: Number(row.unique_species || 0),
      total_grown: Number(row.total_grown || 0),
      is_current_user: Number(row.user_id) === userId
    }));

    res.json({
      collection: collectionRes.rows,
      achievements: achievementsList,
      leaderboard: safeLeaderboard,
      stats: {
        uniqueGrown,
        totalGrown: collectionRes.rows.reduce((sum, p) => sum + p.times, 0),
        totalAchievements: unlockedCodes.size,
        maxAchievements: ACHIEVEMENTS.length,
        rank: myRankIndex + 1
      }
    });

  } catch (err) {
    logger.error({ event: 'profile.load_error', error: err.message || String(err), userId });
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isModelUpload = req.path.includes('/model');
      return res.status(400).json({
        error: isModelUpload
          ? '3D-модель превышает допустимый размер (10 МБ).'
          : 'Изображение превышает допустимый размер (2 МБ).'
      });
    }
    return res.status(400).json({ error: `Ошибка загрузки файла: ${err.message}` });
  }

  if (err?.message === 'Источник запроса не разрешён политикой CORS.') {
    return res.status(403).json({ error: 'Источник запроса не разрешён политикой CORS.' });
  }

  if (typeof err?.message === 'string') {
    const knownClientError = err.message.startsWith('Недопустимый') || err.message.startsWith('Некоррект');
    if (knownClientError) {
      return res.status(400).json({ error: err.message });
    }
  }

  logger.error({
    event: 'http.unhandled_error',
    path: req.path,
    method: req.method,
    error: err?.message || String(err)
  });
  return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const startServer = async () => {
  try {
    await ensureSecuritySchema();
    await ensureAnimalLocationsSchema();
    app.listen(port, () => {
      logger.info({ event: 'server.start', port, message: `ATLAS FAUNA SERVER running on http://localhost:${port}` });
    });
  } catch (error) {
    logger.error({ event: 'server.bootstrap_failed', error: error.message || String(error) });
    process.exit(1);
  }
};

startServer();


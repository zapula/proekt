import type { IAnimal, ISpecies } from '../animals';

const normalizeMarkerHaloRadius = (value: unknown) => {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded > 0 ? rounded : null;
};

export const normalizeModelUrl = (url?: string | null) => {
  const raw = (url || '').trim();
  if (!raw) return '';
  const normalizedPath = raw.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalizedPath) || normalizedPath.startsWith('/')) {
    return normalizedPath;
  }
  return `/${normalizedPath}`;
};

export const pickPreferredModelUrl = (
  source: { modelUrl?: string | null; modelUrlChild?: string | null; modelUrlAdult?: string | null },
  isAdult: boolean
) => {
  const base = normalizeModelUrl(source.modelUrl);
  const child = normalizeModelUrl(source.modelUrlChild);
  const adult = normalizeModelUrl(source.modelUrlAdult);

  if (isAdult) return adult || child || base;
  return child || adult || base;
};

export const toFolderName = (name: string) => {
  const trimmed = name.trim().toLowerCase();
  const slug = trimmed
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
  return slug || 'animal';
};

export const toAnimal = (item: any): IAnimal => ({
  locationId: item.location_id,
  id: item.species_id,
  name: item.name,
  category: item.category,
  diet: item.diet,
  isRedBook: Boolean(item.is_red_book ?? item.isRedBook),
  coordinates: [item.lat, item.lng],
  modelUrl: normalizeModelUrl(item.model_url),
  modelUrlChild: normalizeModelUrl(item.model_url_child),
  modelUrlAdult: normalizeModelUrl(item.model_url_adult),
  iconFile: item.icon_file,
  imageFolder: item.image_folder,
  photoCount: Number(item.photo_count ?? 0),
  markerHaloRadius: normalizeMarkerHaloRadius(item.marker_halo_radius)
});

export const toSpecies = (item: any): ISpecies => ({
  id: item.id,
  name: item.name,
  category: item.category,
  diet: item.diet,
  isRedBook: Boolean(item.is_red_book ?? item.isRedBook),
  modelUrl: normalizeModelUrl(item.modelUrl || item.model_url),
  modelUrlChild: normalizeModelUrl(item.modelUrlChild || item.model_url_child),
  modelUrlAdult: normalizeModelUrl(item.modelUrlAdult || item.model_url_adult),
  iconFile: item.iconFile || item.icon_file || '',
  imageFolder: item.imageFolder || item.image_folder || '',
  photoCount: Number(item.photoCount ?? item.photo_count ?? 0)
});

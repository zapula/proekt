export type RegionCode = 'Khabarovsk' | "Primor'ye" | 'Amur' | 'Yevrey' | 'Sakhalin';

export interface RegionConfig {
  label: string;
  center: [number, number];
  zoom: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export const REGION_CONFIG: Record<RegionCode, RegionConfig> = {
  Khabarovsk: {
    label: 'Хабаровский край',
    center: [50.6, 136.8],
    zoom: 5,
    bounds: { minLat: 46.0, maxLat: 62.6, minLng: 130.2, maxLng: 141.5 }
  },
  "Primor'ye": {
    label: 'Приморский край',
    center: [44.8, 133.5],
    zoom: 6,
    bounds: { minLat: 41.7, maxLat: 48.7, minLng: 130.0, maxLng: 139.3 }
  },
  Amur: {
    label: 'Амурская область',
    center: [52.8, 127.6],
    zoom: 5,
    bounds: { minLat: 48.8, maxLat: 57.9, minLng: 119.7, maxLng: 134.2 }
  },
  Yevrey: {
    label: 'Еврейская АО',
    center: [48.8, 132.7],
    zoom: 7,
    bounds: { minLat: 47.7, maxLat: 49.5, minLng: 130.0, maxLng: 133.9 }
  },
  Sakhalin: {
    label: 'Сахалинская область',
    center: [50.4, 143.4],
    zoom: 5,
    bounds: { minLat: 45.8, maxLat: 54.9, minLng: 141.0, maxLng: 154.3 }
  }
};

export const SUPPORTED_REGION_CODES = Object.keys(REGION_CONFIG) as RegionCode[];

export const REGION_SHOWCASE: Record<
  RegionCode,
  { subtitle: string; photoFolder: string }
> = {
  Khabarovsk: {
    subtitle: 'Крупнейший регион Дальнего Востока: тайга, горные хребты и долины крупных рек.',
    photoFolder: '/images/regions/khabarovsk'
  },
  "Primor'ye": {
    subtitle: 'Южные леса у моря, где встречаются амурский тигр, леопард и богатая прибрежная фауна.',
    photoFolder: '/images/regions/primorye'
  },
  Amur: {
    subtitle: 'Речной и лесостепной регион с контрастными сезонами и большим разнообразием видов.',
    photoFolder: '/images/regions/amur'
  },
  Yevrey: {
    subtitle: 'Компактный регион у Амура с пойменными экосистемами и смешанными лесами.',
    photoFolder: '/images/regions/yevrey'
  },
  Sakhalin: {
    subtitle: 'Островной регион с морскими экосистемами, туманными побережьями и горной тундрой.',
    photoFolder: '/images/regions/sakhalin'
  }
};

const getRegionDistance = (source: RegionCode, target: RegionCode) => {
  const [sourceLat, sourceLng] = REGION_CONFIG[source].center;
  const [targetLat, targetLng] = REGION_CONFIG[target].center;
  return Math.hypot(sourceLat - targetLat, sourceLng - targetLng);
};

export const REGION_NEARBY: Record<RegionCode, RegionCode[]> = SUPPORTED_REGION_CODES.reduce(
  (acc, sourceCode) => {
    acc[sourceCode] = SUPPORTED_REGION_CODES
      .filter((targetCode) => targetCode !== sourceCode)
      .sort((left, right) => getRegionDistance(sourceCode, left) - getRegionDistance(sourceCode, right))
      .slice(0, 3);
    return acc;
  },
  {} as Record<RegionCode, RegionCode[]>
);

export const isSupportedRegionCode = (value: string): value is RegionCode => {
  return SUPPORTED_REGION_CODES.includes(value as RegionCode);
};

export const isPointInsideRegionBounds = (
  coordinates: [number, number],
  bounds: RegionConfig['bounds']
) => {
  const [lat, lng] = coordinates;
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
};

export const getRegionByCoordinates = (coordinates: [number, number]): RegionCode | null => {
  return (
    SUPPORTED_REGION_CODES.find((code) =>
      isPointInsideRegionBounds(coordinates, REGION_CONFIG[code].bounds)
    ) || null
  );
};

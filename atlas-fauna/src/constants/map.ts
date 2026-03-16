export const ANIMAL_MARKER_SIZE = 66;
export const DEFAULT_ANIMAL_MARKER_HALO_RADIUS = 2000; // meters
export const MIN_ANIMAL_MARKER_HALO_RADIUS = 100; // meters
export const MAX_ANIMAL_MARKER_HALO_RADIUS = 100000; // meters
export const LANDING_SESSION_LOCK_KEY = 'atlas-fauna-landing-closed';

export const clampAnimalMarkerHaloRadius = (value: number) =>
  Math.max(MIN_ANIMAL_MARKER_HALO_RADIUS, Math.min(MAX_ANIMAL_MARKER_HALO_RADIUS, Math.round(value)));

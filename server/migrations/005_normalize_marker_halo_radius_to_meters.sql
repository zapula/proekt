UPDATE animal_locations
SET marker_halo_radius = marker_halo_radius * 50
WHERE marker_halo_radius BETWEEN 1 AND 84;

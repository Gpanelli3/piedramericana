-- Faldón se cobra por metro lineal (trabajo), no por m² de material.
UPDATE public.articulos
SET unidad = 'ML', calcula_material = false
WHERE lower(codigo) = 'fal';

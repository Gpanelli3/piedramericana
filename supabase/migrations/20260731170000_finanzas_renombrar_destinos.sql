-- Clarificar que no son cuentas bancarias conectadas: destinos internos de imputación.
UPDATE cuentas_financieras
SET nombre = 'Transferencia ARS'
WHERE nombre = 'Banco ARS' AND tipo = 'banco' AND moneda = 'ars';

UPDATE cuentas_financieras
SET nombre = 'Transferencia USD'
WHERE nombre = 'Banco USD' AND tipo = 'banco' AND moneda = 'usd';

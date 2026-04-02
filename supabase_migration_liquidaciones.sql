-- Migración: Rendimiento graso + Estados de liquidación
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE liquidaciones
  ADD COLUMN IF NOT EXISTS rendimiento_bruto  NUMERIC(5,2),   -- % rendimiento real de la aceituna
  ADD COLUMN IF NOT EXISTS punto_extraccion   NUMERIC(5,2),   -- % coste que se queda la almazara
  ADD COLUMN IF NOT EXISTS rendimiento_neto   NUMERIC(5,2),   -- rendimiento_bruto - punto_extraccion
  ADD COLUMN IF NOT EXISTS kg_aceite_final    NUMERIC(12,2),  -- kg_totales * rendimiento_neto / 100
  ADD COLUMN IF NOT EXISTS estado             TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador','pendiente_pago','pagada')),
  ADD COLUMN IF NOT EXISTS fecha_pago         TIMESTAMPTZ;    -- se rellena automáticamente al marcar como "pagada"

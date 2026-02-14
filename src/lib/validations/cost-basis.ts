// Cost Basis Validation Schemas

import { z } from 'zod';

export const lotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  qty: z.number().refine(val => val !== 0, 'Quantity cannot be zero'),
  price_per_unit: z.number().positive('Price must be positive'),
  notes: z.string().max(500).optional(),
});

export const createCostBasisSchema = z.object({
  token_id: z.string().min(1, 'Token ID is required').max(100),
  symbol: z.string().min(1, 'Symbol is required').max(20),
  method: z.enum(['manual', 'csv_import']).default('manual'),
  lots: z.array(lotSchema).min(1, 'At least one lot is required'),
});

export const updateCostBasisSchema = z.object({
  token_id: z.string().min(1, 'Token ID is required'),
  lots: z.array(lotSchema).min(1, 'At least one lot is required'),
  method: z.enum(['manual', 'csv_import']).optional(),
});

export const deleteCostBasisSchema = z.object({
  token_id: z.string().min(1, 'Token ID is required'),
});

export const addLotSchema = z.object({
  token_id: z.string().min(1, 'Token ID is required'),
  symbol: z.string().min(1, 'Symbol is required').max(20),
  lot: lotSchema,
});

export const csvImportSchema = z.object({
  csv_content: z.string().min(1, 'CSV content is required'),
  target_symbol: z.string().optional(),
  merge: z.boolean().default(true), // Merge with existing lots or replace
});

export type Lot = z.infer<typeof lotSchema>;
export type CreateCostBasisInput = z.infer<typeof createCostBasisSchema>;
export type UpdateCostBasisInput = z.infer<typeof updateCostBasisSchema>;
export type AddLotInput = z.infer<typeof addLotSchema>;
export type CSVImportInput = z.infer<typeof csvImportSchema>;

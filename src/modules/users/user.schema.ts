import { z } from 'zod';

export const updateProfileBodySchema = z.object({
  displayName: z.union([z.string().min(1).max(120), z.null()]),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

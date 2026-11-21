import { z } from 'zod';

export const participantLimitSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  user_name: z.string().optional(),
  neighbourhood: z.string().optional(),
  origin_lat: z.number().min(-90).max(90).optional(),
  origin_lon: z.number().min(-180).max(180).optional(),
  max_duration_s: z.number().min(600, 'Minimum commute duration is 10 minutes').max(14400, 'Maximum commute duration is 4 hours'),
});

export const createPactSchema = z.object({
  team_id: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(120, 'Title cannot exceed 120 characters').optional(),
  destination_name: z.string().min(1, 'Destination name is required').optional(),
  destination_place_id: z.string().optional(),
  destination_lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').optional(),
  destination_lon: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').optional(),
  destination_address: z.string().optional(),
  decision_deadline_utc: z.string().optional(),
  decision_deadline_ist: z.string().optional(),
  fallback_text: z.string().min(1, 'Fallback text is required').optional(),
  status: z.enum(['draft', 'awaiting_approval', 'armed', 'paused', 'closed', 'completed']).optional(),
  request_approvals: z.boolean().optional(),
  participant_limits: z.array(participantLimitSchema).optional(),
  participants: z.array(participantLimitSchema).optional(),
});

export const updatePactSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  destination_name: z.string().min(1).optional(),
  destination_place_id: z.string().optional(),
  destination_lat: z.number().min(-90).max(90).optional(),
  destination_lon: z.number().min(-180).max(180).optional(),
  destination_address: z.string().optional(),
  decision_deadline_ist: z.string().optional(),
  decision_deadline_utc: z.string().optional(),
  fallback_text: z.string().min(1).optional(),
  participant_limits: z.array(participantLimitSchema).optional(),
});

export const placesAutocompleteQuerySchema = z.object({
  q: z.string().optional(),
});

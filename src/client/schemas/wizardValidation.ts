import { z } from 'zod';

export const destinationStepSchema = z.object({
  title: z.string().min(2, 'Pact title must be at least 2 characters'),
  destination_name: z.string().min(2, 'Please select or enter a valid destination name'),
  destination_place_id: z.string().default('custom_dest_place'),
  destination_address: z.string().min(3, 'Address is required'),
  destination_lat: z.number({ message: 'Latitude must be a valid number' })
    .min(-90, 'Latitude must be >= -90')
    .max(90, 'Latitude must be <= 90'),
  destination_lon: z.number({ message: 'Longitude must be a valid number' })
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180'),
});

export const participantSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  user_name: z.string().min(1, 'Participant name is required'),
  neighbourhood: z.string().min(1, 'Origin neighborhood is required'),
  origin_lat: z.number({ message: 'Origin latitude must be a number' })
    .min(-90)
    .max(90),
  origin_lon: z.number({ message: 'Origin longitude must be a number' })
    .min(-180)
    .max(180),
  commute_limit_min: z.number()
    .min(20, 'Commute limit must be at least 20 minutes')
    .max(120, 'Commute limit cannot exceed 120 minutes')
    .refine((val) => val % 5 === 0, 'Commute limit must be in 5-minute increments'),
});

export const participantsStepSchema = z.object({
  participants: z.array(participantSchema).min(1, 'At least one participant is required'),
});

export const rulesStepSchema = z.object({
  deadline_date: z.string().min(1, 'Decision date is required'),
  deadline_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid 24-hour time (HH:MM) is required'),
  decision_deadline_ist: z.string().min(1, 'IST deadline string is required'),
  decision_deadline_utc: z.string().refine((val) => {
    const t = new Date(val).getTime();
    return !isNaN(t) && t > Date.now();
  }, { message: 'Decision deadline must be set to a future date and time' }),
  fallback_text: z.string().min(3, 'Fallback plan must be at least 3 characters long'),
});

export const fullWizardSchema = destinationStepSchema
  .merge(participantsStepSchema)
  .merge(rulesStepSchema);

export type DestinationStepData = z.infer<typeof destinationStepSchema>;
export type ParticipantData = z.infer<typeof participantSchema>;
export type ParticipantsStepData = z.infer<typeof participantsStepSchema>;
export type RulesStepData = z.infer<typeof rulesStepSchema>;
export type FullWizardData = z.infer<typeof fullWizardSchema>;

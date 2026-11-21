import { google, type calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import crypto from 'node:crypto';
import { getAuthenticatedClient, getPrismaClient } from './googleOAuth.js';

export class CalendarApiError extends Error {
  readonly statusCode: number;
  readonly details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = 'CalendarApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface CreateEventOptions {
  db?: any;
  clientOverride?: OAuth2Client;
  calendarApiOverride?: calendar_v3.Calendar;
}

export interface SwitchRemoteOptions {
  db?: any;
  clientOverride?: OAuth2Client;
  calendarApiOverride?: calendar_v3.Calendar;
}

/**
 * Creates Google Calendar event with summary "Office Day", location set to office address,
 * and attendees list populated from opted-in teammates' emails.
 * Stores calendarEventId on the plans table and logs to audit_log.
 */
export async function createOfficeDayEvent(
  planId: string,
  ownerSlackUserId: string,
  options: CreateEventOptions = {}
): Promise<{
  eventId: string;
  summary: string;
  location: string;
  htmlLink?: string;
  attendeesCount: number;
}> {
  const db = options.db || getPrismaClient();

  const plan = await db.plan.findUnique({
    where: { id: planId },
    include: {
      attendees: {
        include: {
          member: true,
        },
      },
    },
  });

  if (!plan) {
    throw new CalendarApiError(`Plan ${planId} not found`, 404);
  }

  if (plan.ownerSlackUserId !== ownerSlackUserId) {
    throw new CalendarApiError(
      `User ${ownerSlackUserId} is not the owner of plan ${planId}`,
      403
    );
  }

  // Obtain authenticated Google client
  const authClient =
    options.clientOverride ||
    (await getAuthenticatedClient({
      workspaceId: plan.workspaceId,
      slackUserId: ownerSlackUserId,
      db,
    }));

  const calendar = options.calendarApiOverride || google.calendar({ version: 'v3', auth: authClient });

  // Filter opted-in attendees who haven't skipped and have an email
  const attendeesList = (plan.attendees || [])
    .filter((att: any) => !att.hasSkipped && att.member?.slackEmail)
    .map((att: any) => ({ email: att.member.slackEmail as string }));

  // Calculate start and end timestamps (default 09:30 to 17:30 in Asia/Kolkata)
  const dateStr =
    plan.planDate instanceof Date
      ? plan.planDate.toISOString().split('T')[0]
      : String(plan.planDate).split('T')[0];

  const [hours, minutes] = (plan.arriveByTime || '09:30').split(':').map(Number);
  const startHour = Number.isFinite(hours) ? hours : 9;
  const startMin = Number.isFinite(minutes) ? minutes : 30;

  const startIso = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+05:30`;
  const endHour = Math.min(23, startHour + 8);
  const endIso = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+05:30`;

  let response: any;
  try {
    response = await calendar.events.insert({
      calendarId: 'primary',
      sendUpdates: 'all',
      requestBody: {
        summary: 'Office Day',
        location: plan.officeAddress,
        description: `Office Day at ${plan.officeAddress}. Managed and monitored by Tripwire Teams.`,
        start: {
          dateTime: startIso,
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endIso,
          timeZone: 'Asia/Kolkata',
        },
        attendees: attendeesList,
      },
    });
  } catch (error: any) {
    throw new CalendarApiError(
      `Google Calendar API rejected event creation: ${error.message || String(error)}`,
      error.status || error.code || 500,
      error
    );
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new CalendarApiError(
      `Google Calendar API returned unexpected HTTP ${response.status}`,
      response.status
    );
  }

  const createdEvent = response.data;
  if (!createdEvent || !createdEvent.id) {
    throw new CalendarApiError('Google Calendar API returned empty event ID', 500);
  }

  // Update plan in database with calendarEventId
  await db.plan.update({
    where: { id: planId },
    data: {
      calendarEventId: createdEvent.id,
    },
  });

  // Record external action in audit_log
  if (db.auditLog?.create) {
    try {
      await db.auditLog.create({
        data: {
          workspaceId: plan.workspaceId,
          actionType: 'CALENDAR_EVENT_CREATED',
          actorSlackUserId: ownerSlackUserId,
          targetEntity: `plan:${planId}`,
          detailsJson: JSON.stringify({
            calendarEventId: createdEvent.id,
            officeAddress: plan.officeAddress,
            attendeesCount: attendeesList.length,
          }),
        },
      });
    } catch (auditErr) {
      console.error('[CalendarService] Failed to record audit log:', auditErr);
    }
  }

  return {
    eventId: createdEvent.id,
    summary: createdEvent.summary || 'Office Day',
    location: createdEvent.location || plan.officeAddress,
    htmlLink: createdEvent.htmlLink,
    attendeesCount: attendeesList.length,
  };
}

/**
 * Patches existing calendar event to remote sync with Google Meet link.
 * Idempotent: safe against double-clicks.
 * Graceful error handling: never claims success without a 200 response from Google.
 */
export async function switchEventToRemote(
  planId: string,
  reasonSummary: string,
  options: SwitchRemoteOptions = {}
): Promise<{
  success: boolean;
  eventId: string;
  summary: string;
  location: string;
  meetLink: string | null;
  alreadyRemote: boolean;
}> {
  const db = options.db || getPrismaClient();

  const plan = await db.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new CalendarApiError(`Plan ${planId} not found`, 404);
  }

  if (!plan.calendarEventId) {
    throw new CalendarApiError(
      `Plan ${planId} has no associated calendarEventId. Event must be created first.`,
      400
    );
  }

  // Obtain authenticated client
  const authClient =
    options.clientOverride ||
    (await getAuthenticatedClient({
      workspaceId: plan.workspaceId,
      slackUserId: plan.ownerSlackUserId,
      db,
    }));

  const calendar = options.calendarApiOverride || google.calendar({ version: 'v3', auth: authClient });

  // 1. Fetch current event from Google to check idempotency
  let getRes: any;
  try {
    getRes = await calendar.events.get({
      calendarId: 'primary',
      eventId: plan.calendarEventId,
    });
  } catch (error: any) {
    throw new CalendarApiError(
      `Failed to retrieve calendar event ${plan.calendarEventId} from Google: ${error.message || String(error)}`,
      error.status || error.code || 500,
      error
    );
  }

  if (getRes.status !== 200 || !getRes.data) {
    throw new CalendarApiError(
      `Google Calendar API returned status ${getRes.status} when fetching event`,
      getRes.status
    );
  }

  const currentEvent = getRes.data;

  // Idempotency check: if already switched to remote, do not patch again
  const isAlreadyRemote =
    currentEvent.summary?.startsWith('[Remote]') &&
    currentEvent.location === 'Remote (Google Meet)';

  if (isAlreadyRemote) {
    const existingMeetLink =
      currentEvent.hangoutLink ||
      currentEvent.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
      currentEvent.conferenceData?.entryPoints?.[0]?.uri ||
      null;

    return {
      success: true,
      eventId: plan.calendarEventId,
      summary: currentEvent.summary || '[Remote] Team Sync',
      location: currentEvent.location || 'Remote (Google Meet)',
      meetLink: existingMeetLink,
      alreadyRemote: true,
    };
  }

  // 2. Prepare patch payload
  const explanation = `Switched to remote due to commute disruption: ${reasonSummary}. Automated by Tripwire Teams.`;
  const updatedDescription = currentEvent.description
    ? `${currentEvent.description}\n\n${explanation}`
    : explanation;

  // Generate unique request ID for conference creation
  const conferenceRequestId = crypto.randomUUID();

  let patchRes: any;
  try {
    patchRes = await calendar.events.patch({
      calendarId: 'primary',
      eventId: plan.calendarEventId,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: '[Remote] Team Sync',
        location: 'Remote (Google Meet)',
        description: updatedDescription,
        conferenceData: {
          createRequest: {
            requestId: conferenceRequestId,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      },
    });
  } catch (patchError: any) {
    // Graceful error handling: Google API error throws structured error without corrupting DB
    throw new CalendarApiError(
      `Google Calendar API failed to patch event to remote: ${patchError.message || String(patchError)}`,
      patchError.status || patchError.code || 500,
      patchError
    );
  }

  // Strict check: never claim success without a 200 response from Google
  if (patchRes.status !== 200) {
    throw new CalendarApiError(
      `Google Calendar API returned non-200 status (${patchRes.status}) when patching event`,
      patchRes.status
    );
  }

  const patchedEvent = patchRes.data;
  const meetLink =
    patchedEvent?.hangoutLink ||
    patchedEvent?.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
    patchedEvent?.conferenceData?.entryPoints?.[0]?.uri ||
    null;

  // 3. Update database record only after verified 200 response
  await db.plan.update({
    where: { id: planId },
    data: {
      status: 'REMOTE',
    },
  });

  // Record external action in audit_log
  if (db.auditLog?.create) {
    try {
      await db.auditLog.create({
        data: {
          workspaceId: plan.workspaceId,
          actionType: 'CALENDAR_CONVERT_REMOTE',
          actorSlackUserId: plan.ownerSlackUserId,
          targetEntity: `plan:${planId}`,
          detailsJson: JSON.stringify({
            calendarEventId: plan.calendarEventId,
            reasonSummary,
            meetLink,
            previousLocation: currentEvent.location,
          }),
        },
      });
    } catch (auditErr) {
      console.error('[CalendarService] Failed to record audit log for switchEventToRemote:', auditErr);
    }
  }

  return {
    success: true,
    eventId: plan.calendarEventId,
    summary: patchedEvent?.summary || '[Remote] Team Sync',
    location: patchedEvent?.location || 'Remote (Google Meet)',
    meetLink,
    alreadyRemote: false,
  };
}

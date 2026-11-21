import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GOOGLE_CALENDAR_SCOPE,
  createOAuth2Client,
  generateGoogleAuthUrl,
  exchangeCodeForTokens,
  saveGoogleRefreshToken,
  getAuthenticatedClient,
  refreshAccessToken,
  CalendarAuthError,
} from './googleOAuth.js';
import {
  createOfficeDayEvent,
  switchEventToRemote,
  CalendarApiError,
} from './calendarService.js';
import {
  generateOAuthState,
  verifyAndConsumeOAuthState,
  clearOAuthStates,
} from './oauthRoutes.js';
import { encrypt, decrypt } from '../../config/encryption.js';

describe('Google Calendar & Meet Feature Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOAuthStates();
  });

  describe('1. Google OAuth2 Client & Token Encryption', () => {
    it('enforces strictly the calendar.events scope and offline consent access', () => {
      expect(GOOGLE_CALENDAR_SCOPE).toBe('https://www.googleapis.com/auth/calendar.events');

      const state = 'test-csrf-state-12345';
      const authUrl = generateGoogleAuthUrl(state, 'http://localhost:3000/oauth/google/callback');

      expect(authUrl).toContain('access_type=offline');
      expect(authUrl).toContain('prompt=consent');
      expect(authUrl).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events');
      expect(authUrl).toContain(`state=${state}`);
    });

    it('encrypts refresh token before storing in google_tokens table', async () => {
      const plainRefreshToken = '1//0gMOCK_REFRESH_TOKEN_xyz1234567890';
      const mockDb = {
        googleToken: {
          upsert: vi.fn().mockImplementation(async ({ create }: any) => {
            return {
              id: 'token_123',
              ...create,
            };
          }),
        },
      };

      const saved = await saveGoogleRefreshToken({
        workspaceId: 'T_WORKSPACE_1',
        slackUserId: 'U_LEAD_1',
        refreshToken: plainRefreshToken,
        email: 'lead@example.com',
        db: mockDb,
      });

      expect(mockDb.googleToken.upsert).toHaveBeenCalledOnce();
      const callArg = mockDb.googleToken.upsert.mock.calls[0][0];

      // Stored token must NOT be the plain text
      expect(callArg.create.encryptedRefreshToken).not.toBe(plainRefreshToken);
      // Stored token must be valid AES-256-GCM format iv:authTag:ciphertext
      expect(callArg.create.encryptedRefreshToken.split(':').length).toBe(3);

      // Decrypting stored token must match original plain text
      const decrypted = decrypt(callArg.create.encryptedRefreshToken);
      expect(decrypted).toBe(plainRefreshToken);
    });

    it('decrypts refresh token when instantiating authenticated client', async () => {
      const plainRefreshToken = '1//0gMOCK_DECRYPT_TEST_TOKEN';
      const encrypted = encrypt(plainRefreshToken);

      const mockDb = {
        googleToken: {
          findUnique: vi.fn().mockResolvedValue({
            workspaceId: 'T_WORKSPACE_1',
            slackUserId: 'U_LEAD_1',
            encryptedRefreshToken: encrypted,
            email: 'lead@example.com',
          }),
          update: vi.fn(),
        },
      };

      const client = await getAuthenticatedClient({
        workspaceId: 'T_WORKSPACE_1',
        slackUserId: 'U_LEAD_1',
        db: mockDb,
      });

      expect(client).toBeDefined();
      // Verify credentials on client match decrypted token
      expect(client.credentials.refresh_token).toBe(plainRefreshToken);
    });

    it('throws CalendarAuthError if calendar is not connected for user', async () => {
      const mockDb = {
        googleToken: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      await expect(
        getAuthenticatedClient({
          workspaceId: 'T_WORKSPACE_1',
          slackUserId: 'U_UNCONNECTED_USER',
          db: mockDb,
        })
      ).rejects.toThrowError(CalendarAuthError);
    });

    it('refreshes expired access token using refresh token', async () => {
      const mockClient: any = {
        getAccessToken: vi.fn().mockResolvedValue({
          token: 'ya29.NEW_REFRESHED_ACCESS_TOKEN',
          res: { status: 200 },
        }),
      };

      const token = await refreshAccessToken(mockClient);
      expect(token).toBe('ya29.NEW_REFRESHED_ACCESS_TOKEN');
      expect(mockClient.getAccessToken).toHaveBeenCalledOnce();
    });
  });

  describe('2. CSRF State Parameter & OAuth Routes', () => {
    it('generates cryptographic state parameter and consumes it once', () => {
      const state = generateOAuthState('T_WORKSPACE_1', 'U_LEAD_1');
      expect(state).toHaveLength(64); // 32 bytes hex = 64 chars

      const payload = verifyAndConsumeOAuthState(state);
      expect(payload).not.toBeNull();
      expect(payload?.workspaceId).toBe('T_WORKSPACE_1');
      expect(payload?.slackUserId).toBe('U_LEAD_1');

      // Second consumption must return null (single-use token)
      const secondAttempt = verifyAndConsumeOAuthState(state);
      expect(secondAttempt).toBeNull();
    });

    it('rejects expired or forged state parameters', () => {
      expect(verifyAndConsumeOAuthState('non-existent-state')).toBeNull();
      expect(verifyAndConsumeOAuthState('')).toBeNull();
    });
  });

  describe('3. Event Creation with Attendees', () => {
    it('creates Google Calendar event with summary, office location, and attendee emails', async () => {
      const planId = 'plan_blr_office_01';
      const ownerId = 'U_LEAD_KABIR';
      const officeAddress = 'Google Anantha, Outer Ring Road, Bengaluru';

      const mockPlan = {
        id: planId,
        workspaceId: 'T_PAYTM_01',
        ownerSlackUserId: ownerId,
        officeAddress,
        planDate: new Date('2026-11-23T00:00:00Z'),
        arriveByTime: '09:30',
        status: 'PLANNED',
        calendarEventId: null,
        attendees: [
          {
            hasSkipped: false,
            member: {
              slackEmail: 'kabir@company.com',
            },
          },
          {
            hasSkipped: false,
            member: {
              slackEmail: 'ananya@company.com',
            },
          },
          {
            hasSkipped: true, // Skipped member should be excluded
            member: {
              slackEmail: 'skipped_user@company.com',
            },
          },
          {
            hasSkipped: false,
            member: {
              slackEmail: null, // Member without email excluded
            },
          },
        ],
      };

      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
          update: vi.fn().mockResolvedValue({ ...mockPlan, calendarEventId: 'gcal_event_998877' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit_1' }),
        },
      };

      const mockCalendarApi: any = {
        events: {
          insert: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: 'gcal_event_998877',
              summary: 'Office Day',
              location: officeAddress,
              htmlLink: 'https://calendar.google.com/event?eid=mock123',
            },
          }),
        },
      };

      const mockAuthClient: any = { credentials: {} };

      const result = await createOfficeDayEvent(planId, ownerId, {
        db: mockDb,
        clientOverride: mockAuthClient,
        calendarApiOverride: mockCalendarApi,
      });

      expect(result.eventId).toBe('gcal_event_998877');
      expect(result.summary).toBe('Office Day');
      expect(result.location).toBe(officeAddress);
      expect(result.attendeesCount).toBe(2);

      // Verify Google Calendar API call parameters
      expect(mockCalendarApi.events.insert).toHaveBeenCalledOnce();
      const insertArgs = mockCalendarApi.events.insert.mock.calls[0][0];

      expect(insertArgs.calendarId).toBe('primary');
      expect(insertArgs.sendUpdates).toBe('all');
      expect(insertArgs.requestBody.summary).toBe('Office Day');
      expect(insertArgs.requestBody.location).toBe(officeAddress);
      expect(insertArgs.requestBody.attendees).toEqual([
        { email: 'kabir@company.com' },
        { email: 'ananya@company.com' },
      ]);

      // Verify database update
      expect(mockDb.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { calendarEventId: 'gcal_event_998877' },
      });

      // Verify audit log creation
      expect(mockDb.auditLog.create).toHaveBeenCalledOnce();
      expect(mockDb.auditLog.create.mock.calls[0][0].data.actionType).toBe('CALENDAR_EVENT_CREATED');
    });

    it('throws 403 error if non-owner tries to create the event', async () => {
      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'plan_123',
            ownerSlackUserId: 'U_REAL_OWNER',
          }),
        },
      };

      await expect(
        createOfficeDayEvent('plan_123', 'U_IMPOSTER', { db: mockDb })
      ).rejects.toThrowError(CalendarApiError);
    });
  });

  describe('4. Event Patch to Remote with Google Meet & sendUpdates', () => {
    it('patches calendar event with "[Remote] Team Sync", Google Meet link, and sendUpdates=all', async () => {
      const planId = 'plan_blr_office_01';
      const eventId = 'gcal_event_998877';
      const disruptionReason = 'Outer Ring Road heavy traffic + 85% heavy rain';

      const mockPlan = {
        id: planId,
        workspaceId: 'T_PAYTM_01',
        ownerSlackUserId: 'U_LEAD_KABIR',
        calendarEventId: eventId,
        status: 'PLANNED',
      };

      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
          update: vi.fn().mockResolvedValue({ ...mockPlan, status: 'REMOTE' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit_2' }),
        },
      };

      const mockCalendarApi: any = {
        events: {
          get: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: eventId,
              summary: 'Office Day',
              location: 'Google Anantha, Outer Ring Road, Bengaluru',
              description: 'Initial office day sync.',
            },
          }),
          patch: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: eventId,
              summary: '[Remote] Team Sync',
              location: 'Remote (Google Meet)',
              hangoutLink: 'https://meet.google.com/abc-defg-hij',
              conferenceData: {
                conferenceId: 'abc-defg-hij',
                entryPoints: [
                  {
                    entryPointType: 'video',
                    uri: 'https://meet.google.com/abc-defg-hij',
                  },
                ],
              },
            },
          }),
        },
      };

      const mockAuthClient: any = { credentials: {} };

      const result = await switchEventToRemote(planId, disruptionReason, {
        db: mockDb,
        clientOverride: mockAuthClient,
        calendarApiOverride: mockCalendarApi,
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe(eventId);
      expect(result.summary).toBe('[Remote] Team Sync');
      expect(result.location).toBe('Remote (Google Meet)');
      expect(result.meetLink).toBe('https://meet.google.com/abc-defg-hij');
      expect(result.alreadyRemote).toBe(false);

      // Verify Google Calendar patch parameters
      expect(mockCalendarApi.events.patch).toHaveBeenCalledOnce();
      const patchArgs = mockCalendarApi.events.patch.mock.calls[0][0];

      expect(patchArgs.calendarId).toBe('primary');
      expect(patchArgs.eventId).toBe(eventId);
      expect(patchArgs.conferenceDataVersion).toBe(1);
      expect(patchArgs.sendUpdates).toBe('all');
      expect(patchArgs.requestBody.summary).toBe('[Remote] Team Sync');
      expect(patchArgs.requestBody.location).toBe('Remote (Google Meet)');
      expect(patchArgs.requestBody.description).toContain(
        `Switched to remote due to commute disruption: ${disruptionReason}. Automated by Tripwire Teams.`
      );
      expect(patchArgs.requestBody.conferenceData).toEqual({
        createRequest: {
          requestId: expect.any(String),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      });

      // Verify database update to REMOTE
      expect(mockDb.plan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: 'REMOTE' },
      });

      // Verify audit log entry
      expect(mockDb.auditLog.create).toHaveBeenCalledOnce();
      const auditArg = mockDb.auditLog.create.mock.calls[0][0].data;
      expect(auditArg.actionType).toBe('CALENDAR_CONVERT_REMOTE');
      expect(auditArg.targetEntity).toBe(`plan:${planId}`);
    });
  });

  describe('5. Idempotent Patch (Safe Against Double-Clicks)', () => {
    it('returns existing meet link without re-patching Google if event is already remote', async () => {
      const planId = 'plan_blr_office_01';
      const eventId = 'gcal_event_998877';

      const mockPlan = {
        id: planId,
        workspaceId: 'T_PAYTM_01',
        ownerSlackUserId: 'U_LEAD_KABIR',
        calendarEventId: eventId,
        status: 'REMOTE',
      };

      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      };

      const existingMeetLink = 'https://meet.google.com/already-existing-link';
      const mockCalendarApi: any = {
        events: {
          get: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: eventId,
              summary: '[Remote] Team Sync',
              location: 'Remote (Google Meet)',
              hangoutLink: existingMeetLink,
            },
          }),
          patch: vi.fn(),
        },
      };

      const mockAuthClient: any = { credentials: {} };

      const result = await switchEventToRemote(planId, 'Duplicate click attempt', {
        db: mockDb,
        clientOverride: mockAuthClient,
        calendarApiOverride: mockCalendarApi,
      });

      expect(result.success).toBe(true);
      expect(result.alreadyRemote).toBe(true);
      expect(result.meetLink).toBe(existingMeetLink);

      // Verify patch was NOT called
      expect(mockCalendarApi.events.patch).not.toHaveBeenCalled();
      // Verify database was NOT updated again
      expect(mockDb.plan.update).not.toHaveBeenCalled();
      // Verify no duplicate audit log
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('6. Graceful API Error Handling & DB Protection', () => {
    it('throws structured CalendarApiError and never updates database if Google API fails', async () => {
      const planId = 'plan_blr_office_01';
      const eventId = 'gcal_event_998877';

      const mockPlan = {
        id: planId,
        workspaceId: 'T_PAYTM_01',
        ownerSlackUserId: 'U_LEAD_KABIR',
        calendarEventId: eventId,
        status: 'PLANNED',
      };

      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      };

      const mockCalendarApi: any = {
        events: {
          get: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: eventId,
              summary: 'Office Day',
              location: 'Google Anantha, Bengaluru',
            },
          }),
          patch: vi.fn().mockRejectedValue(new Error('Google API quota exceeded / 503 Backend Error')),
        },
      };

      const mockAuthClient: any = { credentials: {} };

      await expect(
        switchEventToRemote(planId, 'Bad weather', {
          db: mockDb,
          clientOverride: mockAuthClient,
          calendarApiOverride: mockCalendarApi,
        })
      ).rejects.toThrowError(CalendarApiError);

      // Invariant: database must NOT be corrupted or updated to REMOTE
      expect(mockDb.plan.update).not.toHaveBeenCalled();
      // Invariant: no false success audit record written
      expect(mockDb.auditLog.create).not.toHaveBeenCalled();
    });

    it('throws structured error if Google API returns non-200 HTTP response', async () => {
      const planId = 'plan_blr_office_01';
      const eventId = 'gcal_event_998877';

      const mockPlan = {
        id: planId,
        workspaceId: 'T_PAYTM_01',
        ownerSlackUserId: 'U_LEAD_KABIR',
        calendarEventId: eventId,
        status: 'PLANNED',
      };

      const mockDb = {
        plan: {
          findUnique: vi.fn().mockResolvedValue(mockPlan),
          update: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      };

      const mockCalendarApi: any = {
        events: {
          get: vi.fn().mockResolvedValue({
            status: 200,
            data: {
              id: eventId,
              summary: 'Office Day',
              location: 'Google Anantha',
            },
          }),
          patch: vi.fn().mockResolvedValue({
            status: 403,
            data: { error: 'Calendar read-only / insufficient permissions' },
          }),
        },
      };

      const mockAuthClient: any = { credentials: {} };

      await expect(
        switchEventToRemote(planId, 'Disruption', {
          db: mockDb,
          clientOverride: mockAuthClient,
          calendarApiOverride: mockCalendarApi,
        })
      ).rejects.toThrowError(CalendarApiError);

      expect(mockDb.plan.update).not.toHaveBeenCalled();
    });
  });
});

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MiniLeafletMap } from '../components/MiniLeafletMap';
import { PlacesAutocompleteInput } from '../components/PlacesAutocompleteInput';
import type { VerifiedPlace } from '../components/VenueSearchModal';
import {
  destinationStepSchema,
  participantsStepSchema,
  rulesStepSchema,
  type ParticipantData,
} from '../schemas/wizardValidation';

const DRAFT_STORAGE_KEY = 'office_pact_wizard_draft';

// Curated popular coworking / office hubs in Bengaluru
const POPULAR_HUBS: VerifiedPlace[] = [
  {
    title: 'Google Anantha Bengaluru',
    place_id: 'place_google_anantha_blr',
    address: 'Google Anantha, Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru 560103',
    gps_coordinates: { latitude: 12.9352, longitude: 77.6946 },
  },
  {
    title: 'Paytm Office (One97 Communications)',
    place_id: 'place_paytm_office_blr',
    address: 'Paytm Office, RMZ Ecoworld, Outer Ring Road, Bellandur, Bengaluru 560103',
    gps_coordinates: { latitude: 12.9248, longitude: 77.6845 },
  },
  {
    title: 'WeWork Bellandur (Prestige Tech Park)',
    place_id: 'ChIJk7Q3BqcUrzsR-q3Qe-place-01',
    address: 'Prestige Tech Park, Outer Ring Rd, Bellandur, Bengaluru 560103',
    gps_coordinates: { latitude: 12.9290, longitude: 77.6760 },
  },
  {
    title: 'IndiQube Bellandur (Gamma)',
    place_id: 'ChIJj7sY-y0VrzsRo1q2a-place-02',
    address: 'Kadubeesanahalli, Outer Ring Rd, Bellandur, Bengaluru 560103',
    gps_coordinates: { latitude: 12.9345, longitude: 77.6892 },
  },
  {
    title: 'BHIVE Workspace - Residency Road',
    place_id: 'ChIJb6ZaP98TrzsR1902-place-04',
    address: 'Residency Rd, Shanthala Nagar, Ashok Nagar, Bengaluru 560025',
    gps_coordinates: { latitude: 12.9698, longitude: 77.6033 },
  },
];

// Helper to compute tomorrow's date YYYY-MM-DD
function getDefaultDeadlineDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function NewPactWizardPage() {
  const navigate = useNavigate();
  const { activeUser, currentCompany, teamMembers, setActionNotice, loadData, setSelectedPactId } = useApp();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Step 1: Destination & Origins state
  const defaultTitle = currentCompany?.name
    ? `${currentCompany.name.split(' ')[0]} In-Person Strategy Sync`
    : 'Bellandur In-Person Work Session';
  const [title, setTitle] = useState(defaultTitle);
  const [destinationQuery, setDestinationQuery] = useState(POPULAR_HUBS[0].title);
  const [selectedPlace, setSelectedPlace] = useState<VerifiedPlace>(POPULAR_HUBS[0]);
  const [manualCoordsOpen, setManualCoordsOpen] = useState(false);
  const [manualLat, setManualLat] = useState<number>(POPULAR_HUBS[0].gps_coordinates.latitude);
  const [manualLon, setManualLon] = useState<number>(POPULAR_HUBS[0].gps_coordinates.longitude);
  const [manualAddress, setManualAddress] = useState<string>(POPULAR_HUBS[0].address);

  // Step 2: Participants state (derived from active company members when available)
  const [participants, setParticipants] = useState<ParticipantData[]>(() => {
    if (teamMembers && teamMembers.length >= 2) {
      return [
        {
          user_id: teamMembers[0].user_id,
          user_name: teamMembers[0].user_name,
          neighbourhood: teamMembers[0].neighbourhood || 'Indiranagar',
          origin_lat: 12.9784,
          origin_lon: 77.6408,
          commute_limit_min: 60,
        },
        {
          user_id: teamMembers[1].user_id,
          user_name: teamMembers[1].user_name,
          neighbourhood: teamMembers[1].neighbourhood || 'HSR Layout',
          origin_lat: 12.9121,
          origin_lon: 77.6446,
          commute_limit_min: 60,
        },
      ];
    }
    return [
      {
        user_id: 'user_ananya',
        user_name: 'Ananya',
        neighbourhood: 'Indiranagar',
        origin_lat: 12.9784,
        origin_lon: 77.6408,
        commute_limit_min: 60,
      },
      {
        user_id: 'user_kabir',
        user_name: 'Kabir',
        neighbourhood: 'HSR Layout',
        origin_lat: 12.9121,
        origin_lon: 77.6446,
        commute_limit_min: 60,
      },
    ];
  });

  // Step 3: Rules & Deadline state
  const [deadlineDate, setDeadlineDate] = useState<string>(getDefaultDeadlineDate());
  const [deadlineTime, setDeadlineTime] = useState<string>('09:30');
  const [fallbackText, setFallbackText] = useState<string>('Switch to Google Meet');

  // Step 4: Cadence state
  const [checkFrequencyMin, setCheckFrequencyMin] = useState<number>(15);

  // Sync participants if teamMembers update
  useEffect(() => {
    if (teamMembers && teamMembers.length >= 2) {
      setParticipants((prev) => {
        if (prev[0]?.user_name === teamMembers[0].user_name) return prev;
        return [
          {
            user_id: teamMembers[0].user_id,
            user_name: teamMembers[0].user_name,
            neighbourhood: teamMembers[0].neighbourhood || 'Indiranagar',
            origin_lat: 12.9784,
            origin_lon: 77.6408,
            commute_limit_min: 60,
          },
          {
            user_id: teamMembers[1].user_id,
            user_name: teamMembers[1].user_name,
            neighbourhood: teamMembers[1].neighbourhood || 'HSR Layout',
            origin_lat: 12.9121,
            origin_lon: 77.6446,
            commute_limit_min: 60,
          },
        ];
      });
    }
  }, [teamMembers]);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const d = JSON.parse(savedRaw);
        if (d.step) setStep(d.step);
        if (d.title) setTitle(d.title);
        if (d.destinationQuery) setDestinationQuery(d.destinationQuery);
        if (d.selectedPlace) {
          setSelectedPlace(d.selectedPlace);
          setManualLat(d.selectedPlace.gps_coordinates.latitude);
          setManualLon(d.selectedPlace.gps_coordinates.longitude);
          setManualAddress(d.selectedPlace.address);
        }
        if (Array.isArray(d.participants) && d.participants.length > 0) {
          setParticipants(d.participants);
        }
        if (d.deadlineDate) setDeadlineDate(d.deadlineDate);
        if (d.deadlineTime) setDeadlineTime(d.deadlineTime);
        if (d.fallbackText) setFallbackText(d.fallbackText);
        if (d.checkFrequencyMin) setCheckFrequencyMin(d.checkFrequencyMin);
      }
    } catch (err) {
      console.warn('Failed to restore wizard draft from localStorage:', err);
    }
  }, []);

  // Save draft to localStorage
  useEffect(() => {
    try {
      const draftData = {
        step,
        title,
        destinationQuery,
        selectedPlace,
        participants,
        deadlineDate,
        deadlineTime,
        fallbackText,
        checkFrequencyMin,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (err) {
      console.warn('Failed to save wizard draft to localStorage:', err);
    }
  }, [
    step,
    title,
    destinationQuery,
    selectedPlace,
    participants,
    deadlineDate,
    deadlineTime,
    fallbackText,
    checkFrequencyMin,
  ]);

  // Handle destination selection
  const handleSelectDestination = (place: VerifiedPlace) => {
    setSelectedPlace(place);
    setDestinationQuery(place.title);
    setManualLat(place.gps_coordinates.latitude);
    setManualLon(place.gps_coordinates.longitude);
    setManualAddress(place.address);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.destination_name;
      delete next.destination_lat;
      delete next.destination_lon;
      return next;
    });
  };

  // Update manual coordinates
  const handleUpdateManualCoords = (newLat: number, newLon: number, newAddress?: string) => {
    setManualLat(newLat);
    setManualLon(newLon);
    if (newAddress !== undefined) setManualAddress(newAddress);
    setSelectedPlace((prev) => ({
      ...prev,
      address: newAddress !== undefined ? newAddress : prev.address,
      gps_coordinates: {
        latitude: newLat,
        longitude: newLon,
      },
    }));
  };

  // Participant limit slider
  const handleCommuteLimitChange = (index: number, newMin: number) => {
    const clamped = Math.max(20, Math.min(120, Math.round(newMin / 5) * 5));
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], commute_limit_min: clamped };
      return copy;
    });
  };

  // Participant neighborhood change
  const handleParticipantNeighborhoodSelect = (index: number, place: VerifiedPlace) => {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        neighbourhood: place.title,
        origin_lat: place.gps_coordinates.latitude,
        origin_lon: place.gps_coordinates.longitude,
      };
      return copy;
    });
  };

  // Helper for quick future deadline buttons
  const setQuickDeadline = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    // Convert to IST
    const istOffset = 5.5 * 3600 * 1000;
    const istTime = new Date(target.getTime() + istOffset);
    const dateStr = istTime.toISOString().split('T')[0];
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(Math.round(istTime.getUTCMinutes() / 5) * 5).padStart(2, '0');
    setDeadlineDate(dateStr);
    setDeadlineTime(`${hours}:${minutes === '60' ? '55' : minutes}`);
  };

  // Compute IST & UTC decision deadline
  const { istDeadlineString, utcDeadlineIso, isDeadlineInFuture } = useMemo(() => {
    try {
      const istIso = `${deadlineDate}T${deadlineTime}:00+05:30`;
      const dateObj = new Date(istIso);
      const isFuture = !isNaN(dateObj.getTime()) && dateObj.getTime() > Date.now();
      const dateFormatted = dateObj.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      return {
        istDeadlineString: `${deadlineTime} IST · ${dateFormatted}`,
        utcDeadlineIso: dateObj.toISOString(),
        isDeadlineInFuture: isFuture,
      };
    } catch {
      return {
        istDeadlineString: `${deadlineTime} IST · ${deadlineDate}`,
        utcDeadlineIso: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        isDeadlineInFuture: false,
      };
    }
  }, [deadlineDate, deadlineTime]);

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const payload = {
      title: title.trim(),
      destination_name: destinationQuery.trim() || selectedPlace.title,
      destination_place_id: selectedPlace.place_id,
      destination_address: manualAddress.trim() || selectedPlace.address,
      destination_lat: manualLat,
      destination_lon: manualLon,
    };
    const res = destinationStepSchema.safeParse(payload);
    if (!res.success) {
      const errors: Record<string, string> = {};
      for (const issue of res.error.issues) {
        errors[issue.path[0]?.toString() || 'general'] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const res = participantsStepSchema.safeParse({ participants });
    if (!res.success) {
      const errors: Record<string, string> = {};
      for (const issue of res.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    const payload = {
      deadline_date: deadlineDate,
      deadline_time: deadlineTime,
      decision_deadline_ist: istDeadlineString,
      decision_deadline_utc: utcDeadlineIso,
      fallback_text: fallbackText.trim(),
    };
    const res = rulesStepSchema.safeParse(payload);
    if (!res.success) {
      const errors: Record<string, string> = {};
      for (const issue of res.error.issues) {
        errors[issue.path[0]?.toString() || 'general'] = issue.message;
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  // Navigation handlers
  const handleNextStep = () => {
    setGeneralError(null);
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    } else if (step === 3) {
      if (validateStep3()) setStep(4);
    }
  };

  const handlePrevStep = () => {
    setGeneralError(null);
    setFieldErrors({});
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleJumpToStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep < step) {
      setFieldErrors({});
      setStep(targetStep);
    } else if (targetStep === step + 1) {
      handleNextStep();
    }
  };

  // Discard draft
  const handleDiscardDraft = () => {
    if (window.confirm('Are you sure you want to discard this draft? All inputs will reset to defaults.')) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to remove localStorage draft:', err);
      }
      setTitle(defaultTitle);
      setSelectedPlace(POPULAR_HUBS[0]);
      setDestinationQuery(POPULAR_HUBS[0].title);
      setManualLat(POPULAR_HUBS[0].gps_coordinates.latitude);
      setManualLon(POPULAR_HUBS[0].gps_coordinates.longitude);
      setManualAddress(POPULAR_HUBS[0].address);
      setDeadlineDate(getDefaultDeadlineDate());
      setDeadlineTime('09:30');
      setFallbackText('Switch to Google Meet');
      setStep(1);
      setFieldErrors({});
    }
  };

  // Pact creation submission
  const handleCreatePact = async (actionType: 'draft' | 'request_approvals') => {
    if (!activeUser) {
      setGeneralError('No active session user selected. Please select a user in the top bar.');
      return;
    }

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      setGeneralError('Please fix validation errors before submitting.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      const payload = {
        title: title.trim() || 'Office Pact Agreement',
        destination_name: destinationQuery.trim() || selectedPlace.title,
        destination_place_id: selectedPlace.place_id,
        destination_address: manualAddress.trim() || selectedPlace.address,
        destination_lat: manualLat,
        destination_lon: manualLon,
        decision_deadline_utc: utcDeadlineIso,
        decision_deadline_ist: istDeadlineString,
        fallback_text: fallbackText.trim(),
        status: actionType === 'request_approvals' ? 'awaiting_approval' : 'draft',
        request_approvals: actionType === 'request_approvals',
        company_id: currentCompany?.id || 'comp_paytm',
        participant_limits: participants.map((p) => ({
          user_id: p.user_id,
          user_name: p.user_name,
          neighbourhood: p.neighbourhood,
          origin_lat: p.origin_lat,
          origin_lon: p.origin_lon,
          max_duration_s: p.commute_limit_min * 60,
        })),
      };

      const res = await fetch('/api/pacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': activeUser.user_id,
          'x-company-id': currentCompany?.id || 'comp_paytm',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create pact');
      }

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clean localStorage draft on success:', err);
      }

      setActionNotice(
        actionType === 'request_approvals'
          ? `Pact created and submitted for team approvals!`
          : `Draft agreement saved successfully.`
      );

      await loadData(activeUser.user_id);

      if (data.pact?.id) {
        setSelectedPactId(data.pact.id);
        navigate(`/pacts/${data.pact.id}`);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container wizard-page-container">
      {/* Top Breadcrumb & Reset */}
      <div className="wizard-top-actions">
        <button
          type="button"
          className="btn-secondary-sm"
          onClick={() => navigate('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          &larr; Back to Dashboard
        </button>
        <button
          type="button"
          className="btn-secondary-sm text-danger"
          onClick={handleDiscardDraft}
          title="Reset form and delete stored draft from localStorage"
        >
          Discard Draft
        </button>
      </div>

      <div className="wizard-header">
        <h1 className="page-title">New Bilateral Office Pact</h1>
        <p className="page-subtitle">
          Establish an automated tripwire agreement for team members commuting in Bengaluru.
        </p>

        {/* 4-Step Stepper Bar */}
        <div className="wizard-stepper-bar" role="tablist" aria-label="Wizard Steps">
          <button
            type="button"
            role="tab"
            aria-selected={step === 1}
            className={`wizard-step-tab ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}
            onClick={() => handleJumpToStep(1)}
          >
            <span className="step-num">{step > 1 ? '✓' : '1'}</span>
            <span className="step-title">Destination & Route</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === 2}
            className={`wizard-step-tab ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}
            onClick={() => handleJumpToStep(2)}
          >
            <span className="step-num">{step > 2 ? '✓' : '2'}</span>
            <span className="step-title">Participants</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === 3}
            className={`wizard-step-tab ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}
            onClick={() => handleJumpToStep(3)}
          >
            <span className="step-num">{step > 3 ? '✓' : '3'}</span>
            <span className="step-title">Rule & Deadline</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={step === 4}
            className={`wizard-step-tab ${step === 4 ? 'active' : ''}`}
            onClick={() => handleJumpToStep(4)}
          >
            <span className="step-num">4</span>
            <span className="step-title">Review</span>
          </button>
        </div>
      </div>

      {generalError && (
        <div className="action-notification error" role="alert" style={{ marginBottom: '16px' }}>
          <strong>Error:</strong> {generalError}
        </div>
      )}

      {/* Main Wizard Form Card */}
      <div className="wizard-card-wrapper">
        {/* ================= STEP 1: DESTINATION & FROM ================= */}
        {step === 1 && (
          <div className="wizard-step-content" role="tabpanel" aria-label="Destination Step">
            <div className="step-header-row">
              <h2 className="step-heading">Step 1: Commute Corridors (From & To)</h2>
              <span className="step-badge">Step 1 of 4</span>
            </div>
            <p className="step-description">
              Configure the workplace meeting point (To) and commuter departure origins (From). Real-time Google Maps directions will monitor these commute corridors.
            </p>

            {/* Pact Title */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label htmlFor="pact-title-input" className="form-label">
                Pact Agreement Title
              </label>
              <input
                id="pact-title-input"
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Paytm & Google Anantha Strategy Meetup"
              />
              {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
            </div>

            {/* Destination Search (To) */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--pact-green, #1b4d3e)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>TO: Meeting Destination</span>
              </label>
              <PlacesAutocompleteInput
                id="dest-autocomplete"
                label="Search workplace or tech hub (Search-as-you-type)"
                placeholder="Type 'Google Anantha', 'Paytm', 'WeWork Bellandur', etc."
                value={destinationQuery}
                onChange={setDestinationQuery}
                onSelectPlace={handleSelectDestination}
              />
              {fieldErrors.destination_name && (
                <span className="field-error">{fieldErrors.destination_name}</span>
              )}
            </div>

            {/* Preset Hubs */}
            <div className="preset-hubs-container" style={{ marginBottom: '20px' }}>
              <span className="preset-label" style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '8px' }}>
                Or choose a verified Bengaluru tech corridor hub:
              </span>
              <div className="preset-hubs-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {POPULAR_HUBS.map((hub) => (
                  <button
                    key={hub.place_id}
                    type="button"
                    className={`preset-hub-pill ${selectedPlace.place_id === hub.place_id ? 'active' : ''}`}
                    onClick={() => handleSelectDestination(hub)}
                    style={{
                      background: selectedPlace.place_id === hub.place_id ? 'var(--pact-green-wash, #E8EFE8)' : 'var(--paper-raised, #FCFBF8)',
                      border: `1px solid ${selectedPlace.place_id === hub.place_id ? 'var(--pact-green, #245C46)' : 'var(--rule, #D5D8D0)'}`,
                      color: selectedPlace.place_id === hub.place_id ? 'var(--pact-green, #245C46)' : 'var(--ink, #202824)',
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-control, 6px)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: selectedPlace.place_id === hub.place_id ? 600 : 400,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                      <line x1="9" y1="22" x2="9" y2="22.01" />
                      <line x1="15" y1="22" x2="15" y2="22.01" />
                      <line x1="8" y1="6" x2="8" y2="6.01" />
                      <line x1="16" y1="6" x2="16" y2="6.01" />
                      <line x1="8" y1="10" x2="8" y2="10.01" />
                      <line x1="16" y1="10" x2="16" y2="10.01" />
                    </svg>
                    <span>{hub.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Commuter Departure Points (From) */}
            <div
              className="departure-origins-section"
              style={{
                backgroundColor: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink, #202824)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  FROM: Commuter Departure Points
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {participants.map((p, idx) => (
                  <div
                    key={p.user_id}
                    style={{
                      background: 'var(--paper-inset, #F4F3EE)',
                      border: '1px solid var(--rule-subtle, #E4E3DC)',
                      borderRadius: '6px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#2563EB',
                          color: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {p.user_name.charAt(0)}
                      </span>
                      <strong style={{ fontSize: '13px' }}>{p.user_name}</strong>
                    </div>
                    <label style={{ fontSize: '11px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '4px' }}>
                      Departure Neighborhood:
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={p.neighbourhood}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParticipants((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], neighbourhood: val };
                          return copy;
                        });
                      }}
                      style={{ fontSize: '12px', padding: '6px 10px' }}
                    />
                    <div style={{ fontSize: '10px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                      Origin: {p.origin_lat.toFixed(4)}, {p.origin_lon.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Leaflet Map with Both Origins and Destination */}
            <div className="destination-preview-card" style={{ marginBottom: '20px' }}>
              <div className="destination-meta-row" style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--pact-green, #1b4d3e)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{selectedPlace.title}</span>
                  </strong>
                  <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                    {manualAddress || selectedPlace.address}
                  </div>
                </div>
                <span className="corridor-summary-chip" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--pact-wash)', color: 'var(--pact-green)', padding: '4px 8px', borderRadius: '4px' }}>
                  {participants.length} Active Corridors
                </span>
              </div>

              {/* Map Preview */}
              <div className="mini-map-box">
                <MiniLeafletMap
                  lat={manualLat}
                  lon={manualLon}
                  title={selectedPlace.title}
                  address={manualAddress || selectedPlace.address}
                  height="260px"
                  origins={participants.map((p) => ({
                    lat: p.origin_lat,
                    lon: p.origin_lon,
                    name: p.user_name,
                    neighbourhood: p.neighbourhood,
                  }))}
                />
              </div>
            </div>

            {/* Manual Coordinate Entry Fallback */}
            <div className="manual-coords-fallback" style={{ marginBottom: '24px' }}>
              <button
                type="button"
                className="btn-text-toggle"
                onClick={() => setManualCoordsOpen(!manualCoordsOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pact-green, #245C46)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{manualCoordsOpen ? '▼ Hide' : '▶ Show'} Manual Coordinate Entry Fallback</span>
              </button>

              {manualCoordsOpen && (
                <div
                  className="manual-coords-panel"
                  style={{
                    marginTop: '10px',
                    padding: '14px',
                    backgroundColor: 'var(--paper-inset, #EFEEE8)',
                    borderRadius: 'var(--radius-control, 6px)',
                    border: '1px solid var(--rule, #D5D8D0)',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <label htmlFor="manual-lat-input" className="form-label" style={{ fontSize: '12px' }}>
                        Latitude (-90 to 90)
                      </label>
                      <input
                        id="manual-lat-input"
                        type="number"
                        step="0.0001"
                        className="form-input"
                        value={manualLat}
                        onChange={(e) => handleUpdateManualCoords(parseFloat(e.target.value) || 0, manualLon)}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-lon-input" className="form-label" style={{ fontSize: '12px' }}>
                        Longitude (-180 to 180)
                      </label>
                      <input
                        id="manual-lon-input"
                        type="number"
                        step="0.0001"
                        className="form-input"
                        value={manualLon}
                        onChange={(e) => handleUpdateManualCoords(manualLat, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="manual-address-input" className="form-label" style={{ fontSize: '12px' }}>
                      Custom Address / Landmark
                    </label>
                    <input
                      id="manual-address-input"
                      type="text"
                      className="form-input"
                      value={manualAddress}
                      onChange={(e) => handleUpdateManualCoords(manualLat, manualLon, e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="wizard-nav-buttons" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-primary" onClick={handleNextStep}>
                Next: Participants & Thresholds →
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PARTICIPANTS ================= */}
        {step === 2 && (
          <div className="wizard-step-content" role="tabpanel" aria-label="Participants Step">
            <div className="step-header-row">
              <h2 className="step-heading">Step 2: Participants & Commute Limits</h2>
              <span className="step-badge">Step 2 of 4</span>
            </div>
            <p className="step-description">
              Set each participant&apos;s departure origin and driving duration threshold. If travel time exceeds this limit twice consecutively, the tripwire triggers.
            </p>

            <div className="participants-stack" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {participants.map((p, idx) => (
                <div
                  key={p.user_id || idx}
                  className="participant-card-config"
                  style={{
                    backgroundColor: 'var(--paper-raised, #FCFBF8)',
                    border: '1px solid var(--rule, #D5D8D0)',
                    borderRadius: 'var(--radius-panel, 8px)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          background: 'var(--pact-green, #1B4D3E)',
                          color: '#FFF',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '15px',
                        }}
                      >
                        {p.user_name.charAt(0)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink, #1a1a1a)' }}>{p.user_name}</div>
                        <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                          Departure Origin: {p.neighbourhood}
                        </span>
                      </div>
                    </div>
                    <span className="origin-coords-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-muted)' }}>
                      {p.origin_lat.toFixed(4)}, {p.origin_lon.toFixed(4)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    {/* Participant Name */}
                    <div>
                      <label htmlFor={`part-name-${idx}`} className="form-label" style={{ fontSize: '12px' }}>
                        Commuter Name
                      </label>
                      <input
                        id={`part-name-${idx}`}
                        type="text"
                        className="form-input"
                        value={p.user_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParticipants((prev) => {
                            const c = [...prev];
                            c[idx] = { ...c[idx], user_name: val };
                            return c;
                          });
                        }}
                      />
                    </div>

                    {/* Origin Neighborhood */}
                    <div>
                      <PlacesAutocompleteInput
                        id={`part-hood-${idx}`}
                        label="Origin Neighborhood (Search-as-you-type)"
                        placeholder="Search neighborhood (e.g. Indiranagar, HSR, Koramangala...)"
                        value={p.neighbourhood}
                        onChange={(val) => {
                          setParticipants((prev) => {
                            const c = [...prev];
                            c[idx] = { ...c[idx], neighbourhood: val };
                            return c;
                          });
                        }}
                        onSelectPlace={(place) => handleParticipantNeighborhoodSelect(idx, place)}
                      />
                    </div>
                  </div>

                  {/* Commute Limit Slider & Quick Preset Pills */}
                  <div
                    className="commute-limit-container"
                    style={{
                      backgroundColor: 'var(--paper-inset, #F4F3EE)',
                      padding: '16px',
                      borderRadius: 'var(--radius-control, 6px)',
                      border: '1px solid var(--rule-subtle, #E4E3DC)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        Commute Duration Threshold:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--pact-green, #1B4D3E)', fontFamily: 'var(--font-mono)' }}>
                          {p.commute_limit_min}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>minutes</span>
                      </div>
                    </div>

                    {/* Range slider 20 to 120 min step 5 */}
                    <input
                      id={`limit-slider-${idx}`}
                      type="range"
                      min="20"
                      max="120"
                      step="5"
                      value={p.commute_limit_min}
                      onChange={(e) => handleCommuteLimitChange(idx, Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--pact-green, #1B4D3E)' }}
                      aria-label={`${p.user_name} commute limit slider`}
                    />

                    {/* Preset Pill Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginRight: '4px' }}>Presets:</span>
                      {[30, 45, 60, 75, 90].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleCommuteLimitChange(idx, mins)}
                          style={{
                            background: p.commute_limit_min === mins ? 'var(--pact-green, #1B4D3E)' : 'var(--paper-raised, #FCFBF8)',
                            color: p.commute_limit_min === mins ? '#FFFFFF' : 'var(--ink, #1a1a1a)',
                            border: `1px solid ${p.commute_limit_min === mins ? 'var(--pact-green, #1B4D3E)' : 'var(--rule, #D5D8D0)'}`,
                            padding: '4px 10px',
                            borderRadius: '14px',
                            fontSize: '12px',
                            fontWeight: p.commute_limit_min === mins ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Step 2 Actions */}
            <div className="wizard-nav-buttons" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn-secondary" onClick={handlePrevStep}>
                ← Back to Destination
              </button>
              <button type="button" className="btn-primary" onClick={handleNextStep}>
                Next: Rule & Deadline →
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: RULE & DEADLINE ================= */}
        {step === 3 && (
          <div className="wizard-step-content" role="tabpanel" aria-label="Rule & Deadline Step">
            <div className="step-header-row">
              <h2 className="step-heading">Step 3: Decision Deadline & Remote Fallback</h2>
              <span className="step-badge">Step 3 of 4</span>
            </div>
            <p className="step-description">
              Set the hard decision cutoff in Indian Standard Time (IST). If traffic exceeds thresholds before this time, the agreed remote plan executes automatically.
            </p>

            {/* Symmetrical Date & Time Picker */}
            <div
              className="deadline-picker-box"
              style={{
                backgroundColor: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <label className="form-label" style={{ display: 'block', marginBottom: '12px', fontWeight: 600 }}>
                Decision Deadline (Date & Time in IST - Asia/Kolkata)
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '14px' }}>
                <div>
                  <label htmlFor="deadline-date-input" style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Date (IST)</span>
                  </label>
                  <input
                    id="deadline-date-input"
                    type="date"
                    className="form-input"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px' }}
                  />
                </div>
                <div>
                  <label htmlFor="deadline-time-input" style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Time (IST)</span>
                  </label>
                  <input
                    id="deadline-time-input"
                    type="time"
                    className="form-input"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px' }}
                  />
                </div>
              </div>

              {/* Quick Helper Buttons for Future Times */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>Quick sets:</span>
                <button
                  type="button"
                  onClick={() => setQuickDeadline(1)}
                  style={{ background: 'var(--paper-inset)', border: '1px solid var(--rule)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDeadline(2)}
                  style={{ background: 'var(--paper-inset)', border: '1px solid var(--rule)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  +2 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDeadline(4)}
                  style={{ background: 'var(--paper-inset)', border: '1px solid var(--rule)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  +4 Hours
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeadlineDate(getDefaultDeadlineDate());
                    setDeadlineTime('09:00');
                  }}
                  style={{ background: 'var(--paper-inset)', border: '1px solid var(--rule)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Tomorrow 09:00 IST
                </button>
              </div>

              {/* Deadline Preview Card */}
              <div style={{
                background: isDeadlineInFuture ? 'var(--pact-wash, #eef4f0)' : 'var(--caution-wash, #fdf6ec)',
                border: `1px solid ${isDeadlineInFuture ? 'var(--pact-border, #c3d9cc)' : 'var(--caution-border, #e6a23c)'}`,
                padding: '10px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 500,
                color: isDeadlineInFuture ? 'var(--pact-green, #1b4d3e)' : 'var(--caution-ink, #755110)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Active Cutoff:
                </span>
                <strong>{istDeadlineString}</strong>
                {!isDeadlineInFuture && (
                  <span style={{ color: 'var(--error-ink, #c53030)', marginLeft: 'auto', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Cutoff is in the past; please pick a future time.
                  </span>
                )}
              </div>
            </div>

            {/* Remote Fallback Text with 3 Presets */}
            <div
              className="fallback-section-box"
              style={{
                backgroundColor: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <label htmlFor="fallback-plan-textarea" className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Agreed Remote Fallback Plan
              </label>
              <textarea
                id="fallback-plan-textarea"
                className="form-textarea"
                rows={3}
                value={fallbackText}
                onChange={(e) => setFallbackText(e.target.value)}
                placeholder="e.g. Switch to Google Meet and reschedule in-person sync"
                style={{ width: '100%', marginBottom: '12px' }}
              />
              {fieldErrors.fallback_text && (
                <span className="field-error" style={{ display: 'block', marginBottom: '8px' }}>
                  {fieldErrors.fallback_text}
                </span>
              )}

              {/* 3 One-Click Presets */}
              <div>
                <span style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '8px' }}>
                  One-click fallback presets:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Switch to Google Meet', 'Work from home & reschedule', 'Async status updates'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="preset-fallback-chip"
                      onClick={() => setFallbackText(preset)}
                      style={{
                        background: fallbackText === preset ? 'var(--pact-green-wash, #E8EFE8)' : 'var(--paper, #F7F6F2)',
                        border: `1px solid ${fallbackText === preset ? 'var(--pact-green, #245C46)' : 'var(--rule, #D5D8D0)'}`,
                        color: fallbackText === preset ? 'var(--pact-green, #245C46)' : 'var(--ink, #202824)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-control, 6px)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: fallbackText === preset ? 600 : 400,
                      }}
                    >
                      {fallbackText === preset ? '✓ ' : ''}{preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Read-Only Tripwire Rules */}
            <div
              className="how-it-works-chips-box"
              style={{
                backgroundColor: 'var(--paper-inset, #EFEEE8)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '14px 16px',
                marginBottom: '24px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Deterministic Decision Line Rules
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div
                  style={{
                    backgroundColor: 'var(--paper-raised, #FCFBF8)',
                    border: '1px solid var(--rule, #D5D8D0)',
                    borderRadius: 'var(--radius-control, 6px)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--pact-green, #245C46)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>2-Breach Confirmation Gate</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: '16px' }}>
                    Requires 2 consecutive commute observations above limit before triggering an alert, filtering out transient traffic spikes.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--paper-raised, #FCFBF8)',
                    border: '1px solid var(--rule, #D5D8D0)',
                    borderRadius: 'var(--radius-control, 6px)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--pact-green, #245C46)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>5-Minute Recovery Margin</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: '16px' }}>
                    If traffic clears and estimate drops within 5 minutes under the limit during confirmation, the tripwire resets automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div className="wizard-nav-buttons" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn-secondary" onClick={handlePrevStep}>
                ← Back to Participants
              </button>
              <button type="button" className="btn-primary" onClick={handleNextStep}>
                Next: Review & Confirm →
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: REVIEW ================= */}
        {step === 4 && (
          <div className="wizard-step-content" role="tabpanel" aria-label="Review Step">
            <div className="step-header-row">
              <h2 className="step-heading">Step 4: Agreement Review & Action</h2>
              <span className="step-badge">Step 4 of 4</span>
            </div>
            <p className="step-description">
              Verify the plain-English terms, review the automated watch schedule, and choose whether to save as draft or request approvals.
            </p>

            {/* Plain-English Agreement Summary */}
            <div
              className="plain-english-summary-box"
              style={{
                backgroundColor: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule-strong, #848E82)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--pact-green, #245C46)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Plain-English Team Agreement
              </div>

              <div style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--ink, #202824)' }}>
                “On <strong>{deadlineDate}</strong>, the team agrees to meet at{' '}
                <strong>{destinationQuery.trim() || selectedPlace.title}</strong> ({manualAddress || selectedPlace.address}).
                Real-time traffic will monitor commute estimates for{' '}
                {participants.map((p, idx) => (
                  <span key={p.user_id}>
                    {idx > 0 ? ' and ' : ''}
                    <strong>{p.user_name}</strong> (origin: {p.neighbourhood}, max <strong>{p.commute_limit_min} min</strong>)
                  </span>
                ))}{' '}
                until <strong>{istDeadlineString}</strong>. If either commute breaches threshold twice consecutively, the team will automatically pivot to: <em>‘{fallbackText}’</em>.”
              </div>
            </div>

            {/* Automated Commute Watch Schedule Card */}
            <div
              className="schedule-overview-box"
              style={{
                backgroundColor: 'var(--paper-raised, #FCFBF8)',
                border: '1px solid var(--rule, #D5D8D0)',
                borderRadius: 'var(--radius-panel, 8px)',
                padding: '18px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏱️</span> Automated Commute Watch Schedule
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="freq-select" style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                    Check Cadence:
                  </label>
                  <select
                    id="freq-select"
                    className="user-select"
                    value={checkFrequencyMin}
                    onChange={(e) => setCheckFrequencyMin(Number(e.target.value))}
                    style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px' }}
                  >
                    <option value={10}>Every 10 minutes</option>
                    <option value={15}>Every 15 minutes (Standard)</option>
                    <option value={30}>Every 30 minutes</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '10px' }}>
                <div style={{ background: 'var(--paper-inset)', padding: '12px', borderRadius: '6px', border: '1px solid var(--rule)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '4px' }}>Active Watch Window</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>2 hours before deadline</span>
                </div>
                <div style={{ background: 'var(--paper-inset)', padding: '12px', borderRadius: '6px', border: '1px solid var(--rule)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '4px' }}>Verification Gate</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>2 consecutive breaches</span>
                </div>
                <div style={{ background: 'var(--paper-inset)', padding: '12px', borderRadius: '6px', border: '1px solid var(--rule)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '4px' }}>Decision Cutoff</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pact-green)' }}>
                    {istDeadlineString.split('·')[0].trim()}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                Real-time Google Maps directions queries run deterministically in the background. No browser polling loop executes live traffic queries.
              </div>
            </div>

            {/* Action Notice */}
            <div
              style={{
                backgroundColor: 'var(--pact-green-wash, #E8EFE8)',
                border: '1px solid var(--pact-green, #245C46)',
                color: 'var(--pact-green-hover, #1B4937)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-control, 6px)',
                fontSize: '13px',
                marginBottom: '24px',
              }}
            >
              <strong>Bilateral Workflow:</strong> &ldquo;Save Draft&rdquo; preserves the agreement without notifying counterparts. &ldquo;Create & Request Approvals&rdquo; sets the pact to <strong>awaiting_approval</strong> so both colleagues can review and sign.
            </div>

            {/* Step 4 Actions */}
            <div className="wizard-nav-buttons" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrevStep}
                disabled={submitting}
              >
                ← Back to Rules
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => handleCreatePact('draft')}
                >
                  {submitting ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submitting}
                  onClick={() => handleCreatePact('request_approvals')}
                >
                  {submitting ? 'Creating...' : 'Create & Request Approvals →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

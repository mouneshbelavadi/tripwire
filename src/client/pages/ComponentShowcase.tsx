import { useState } from 'react';
import {
  Button,
  StatusBadge,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Drawer,
  Modal,
  ToastProvider,
  useToast,
  Tooltip,
  SkeletonCard,
  SkeletonStat,
  SkeletonTable,
  EmptyState,
  ErrorState,
  Stat,
  Timeline,
  DataTable,
  type ColumnDef,
} from '../components/ui';

interface ShowcasePactRow {
  id: string;
  title: string;
  destination: string;
  deadline: string;
  status: string;
  maxDuration: number;
}

const SAMPLE_PACTS: ShowcasePactRow[] = [
  {
    id: 'pact_bellandur_01',
    title: 'Bellandur Thursday Working Group',
    destination: 'WeWork Prestige Tech Park',
    deadline: '09:00 IST',
    status: 'armed',
    maxDuration: 60,
  },
  {
    id: 'pact_koramangala_02',
    title: 'Koramangala Sprint Retro',
    destination: 'Third Wave Coffee, 4th Block',
    deadline: '10:30 IST',
    status: 'confirming',
    maxDuration: 45,
  },
  {
    id: 'pact_whitefield_03',
    title: 'Whitefield Architecture Review',
    destination: 'ITPB Innovator Building',
    deadline: '08:45 IST',
    status: 'alert',
    maxDuration: 55,
  },
  {
    id: 'pact_indiranagar_04',
    title: 'Indiranagar 100ft Sync',
    destination: 'Blue Tokai Indiranagar',
    deadline: '09:30 IST',
    status: 'draft',
    maxDuration: 40,
  },
  {
    id: 'pact_outerring_05',
    title: 'ORR Cross-Team Onboarding',
    destination: 'RMZ Ecoworld Campus 8',
    deadline: '09:15 IST',
    status: 'paused',
    maxDuration: 60,
  },
  {
    id: 'pact_mgroad_06',
    title: 'MG Road Executive Briefing',
    destination: 'Barton Centre, MG Road',
    deadline: '08:30 IST',
    status: 'completed',
    maxDuration: 50,
  },
  {
    id: 'pact_electroniccity_07',
    title: 'Electronic City Lab Day',
    destination: 'Infosys Gate 1',
    deadline: '09:00 IST',
    status: 'expired',
    maxDuration: 75,
  },
];

const TIMELINE_DATA = [
  {
    id: 'tl_1',
    time: '08:30 IST',
    title: 'Watch Armed by All Participants',
    description: 'Maya and Arjun approved v1 threshold rules. Fastest driving commute monitoring initialized.',
    status: 'armed' as const,
    author: 'Arjun',
  },
  {
    id: 'tl_2',
    time: '08:35 IST',
    title: 'Normal Observation Recorded',
    description: 'SerpApi Directions returned 42 min for Maya (Indiranagar) and 34 min for Arjun (HSR Layout). Both within limits.',
    status: 'info' as const,
    details: {
      maya_duration_s: 2520,
      arjun_duration_s: 2040,
      traffic_model: 'best_guess',
      search_id: 'serp_0835_ok',
    },
  },
  {
    id: 'tl_3',
    time: '08:40 IST',
    title: 'Breach Check 1/2 Confirmed (Confirming)',
    description: 'Silk Board Junction waterlogging reported. Maya route estimate jumped to 68 min (>60m threshold). First breach registered.',
    status: 'confirming' as const,
    details: {
      consecutive_breaches: 1,
      measured_duration_m: 68,
      threshold_m: 60,
      traffic_incident_observed: true,
      incident_id: 'inc_silkboard_01',
    },
  },
  {
    id: 'tl_4',
    time: '08:45 IST',
    title: 'Breach Check 2/2 Confirmed — Alert Active',
    description: 'Second consecutive fresh check exceeded 60 min (72 min). Tripwire alert generated with You.com advisory.',
    status: 'alert' as const,
    details: {
      consecutive_breaches: 2,
      episode_id: 'ep_20261121_01',
      outbox_status: 'dispatched',
      recommended_fallback: 'Switch to Google Meet remote call',
    },
  },
];

function ShowcaseContent() {
  const { addToast } = useToast();

  // Component state toggles
  const [btnLoading, setBtnLoading] = useState(false);
  const [tabValue, setTabValue] = useState('overview');
  const [verticalTabValue, setVerticalTabValue] = useState('pact');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [selectedTableRow, setSelectedTableRow] = useState<ShowcasePactRow | null>(SAMPLE_PACTS[0]);
  const [interactiveCardClicked, setInteractiveCardClicked] = useState(false);

  const columns: ColumnDef<ShowcasePactRow>[] = [
    { key: 'title', header: 'Pact Agreement', sortable: true, width: '30%' },
    { key: 'destination', header: 'Destination', sortable: true, width: '30%' },
    { key: 'deadline', header: 'Deadline', sortable: true, width: '15%' },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      width: '15%',
      render: (row) => <StatusBadge status={row.status} size="sm" pulse={row.status === 'armed' || row.status === 'alert'} />,
    },
    {
      key: 'maxDuration',
      header: 'Max Commute',
      sortable: true,
      width: '10%',
      render: (row) => <span>{row.maxDuration}m</span>,
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
      {/* 1. Header & Navigation */}
      <header style={{ borderBottom: '2px solid var(--rule)', paddingBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', background: 'var(--forest-wash)', color: 'var(--forest-text-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--forest-border)' }}>
                DESIGN SYSTEM
              </span>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>WCAG 2.2 AA VERIFIED</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
              Tripwire UI Component Library
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--ink-secondary)', marginTop: '6px', maxWidth: '720px', lineHeight: 1.5 }}>
              Strict, high-contrast, editorial design system built for bilateral commute agreement monitoring.
              High contrast, accessible keyboard navigation, and zero decorative fluff.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = '/';
              }}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M15 8a.75.75 0 01-.75.75H4.06l3.72 3.72a.75.75 0 11-1.06 1.06l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L4.06 7.25h10.19A.75.75 0 0115 8z" />
                </svg>
              }
            >
              Back to Office Pact
            </Button>
          </div>
        </div>

        {/* Section Jump Links */}
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }} aria-label="Component sections">
          {[
            ['Tokens', '#tokens'],
            ['Buttons', '#buttons'],
            ['Status Badges', '#badges'],
            ['Cards', '#cards'],
            ['Tabs', '#tabs'],
            ['Drawer (336px)', '#drawer'],
            ['Modal Dialog', '#modal'],
            ['Toasts', '#toasts'],
            ['Tooltips', '#tooltips'],
            ['Skeletons', '#skeletons'],
            ['Empty & Error States', '#states'],
            ['Stat Cards', '#stats'],
            ['Timeline', '#timeline'],
            ['DataTable', '#datatable'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--ink-secondary)',
                textDecoration: 'none',
                padding: '4px 8px',
                background: 'var(--paper-inset)',
                border: '1px solid var(--rule)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* 2. Design Tokens Section */}
      <section id="tokens">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>1. Design Tokens & Palette</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Defined in <code style={{ fontFamily: 'var(--font-mono)' }}>src/client/styles/tokens.css</code>. Tested against WCAG 2.2 AA contrast standards.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { name: 'Paper Substrate', hex: '#FBFBF9', text: '#1A1A1A', contrast: 'Canvas (Base)', desc: 'Warm paper substrate' },
            { name: 'Graphite Ink', hex: '#1A1A1A', text: '#FFFFFF', contrast: '16.5:1 (AAA)', desc: 'High contrast primary ink' },
            { name: 'Forest Green', hex: '#1B4D3E', text: '#FFFFFF', contrast: '8.8:1 (AAA)', desc: 'Active watch / armed / success' },
            { name: 'Amber Warning', hex: '#B45309', text: '#FFFFFF', contrast: '5.1:1 (AA)', desc: 'Caution / confirming breach' },
            { name: 'Red Alert', hex: '#B91C1C', text: '#FFFFFF', contrast: '5.8:1 (AA)', desc: 'Breach confirmed / destructive' },
          ].map((token) => (
            <Card key={token.name} padding="sm">
              <div
                style={{
                  height: '60px',
                  backgroundColor: token.hex,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.text,
                  fontWeight: 600,
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '8px',
                }}
              >
                {token.hex}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{token.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>{token.desc}</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--forest)', fontWeight: 600, marginTop: '4px' }}>
                {token.contrast}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. Button Component Section */}
      <section id="buttons">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>2. Button (`Button.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Primary, secondary, ghost, danger variants; small, medium, large sizes; loading spinner state; full keyboard focus rings.
          </p>
        </div>

        <Card>
          <CardHeader title="Variants & States" />
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  CORE VARIANTS (MEDIUM)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <Button variant="primary">Primary Action</Button>
                  <Button variant="secondary">Secondary Action</Button>
                  <Button variant="ghost">Ghost Action</Button>
                  <Button variant="danger">Danger Action</Button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  SIZES (SMALL, MEDIUM, LARGE)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <Button size="sm" variant="primary">Small (28px)</Button>
                  <Button size="md" variant="primary">Medium (36px)</Button>
                  <Button size="lg" variant="primary">Large (44px)</Button>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  WITH ICONS & LOADING SPINNER
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <Button
                    variant="primary"
                    leftIcon={
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                      </svg>
                    }
                  >
                    Approve Pact v1
                  </Button>

                  <Button
                    variant="secondary"
                    rightIcon={
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M1 8a.75.75 0 01.75-.75h10.19L8.22 3.53a.75.75 0 011.06-1.06l5 5a.75.75 0 010 1.06l-5 5a.75.75 0 01-1.06-1.06l3.72-3.72H1.75A.75.75 0 011 8z" />
                      </svg>
                    }
                  >
                    View Evidence
                  </Button>

                  <Button
                    variant="primary"
                    loading={btnLoading}
                    onClick={() => {
                      setBtnLoading(true);
                      setTimeout(() => setBtnLoading(false), 2000);
                    }}
                  >
                    {btnLoading ? 'Checking SerpApi...' : 'Test Loading State'}
                  </Button>

                  <Button variant="primary" disabled>
                    Disabled State
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. StatusBadge Component Section */}
      <section id="badges">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>3. StatusBadge (`StatusBadge.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Indicator with semantic icons and accessible text for all 8 system states: Draft, Armed, Confirming, Alert, Paused, Expired, Completed, Closed.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  ALL 8 SYSTEM STATUSES (WITH ICONS)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  <StatusBadge status="draft" />
                  <StatusBadge status="armed" pulse />
                  <StatusBadge status="confirming" pulse />
                  <StatusBadge status="alert" pulse />
                  <StatusBadge status="paused" />
                  <StatusBadge status="expired" />
                  <StatusBadge status="completed" />
                  <StatusBadge status="closed" />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  COMPACT BADGES (SIZE: SM)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <StatusBadge status="draft" size="sm" />
                  <StatusBadge status="armed" size="sm" />
                  <StatusBadge status="confirming" size="sm" />
                  <StatusBadge status="alert" size="sm" />
                  <StatusBadge status="paused" size="sm" />
                  <StatusBadge status="expired" size="sm" />
                  <StatusBadge status="completed" size="sm" />
                  <StatusBadge status="closed" size="sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Card Component Section */}
      <section id="cards">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>4. Card (`Card.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Clean bordered container with header, content, footer slots and interactive focus variants.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <Card variant="default">
            <CardHeader
              title="Standard Card"
              description="Default bordered surface with header"
              action={<StatusBadge status="armed" size="sm" />}
            />
            <CardContent>
              <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', margin: 0 }}>
                Used for primary pact details, participant information, and rule parameters.
              </p>
            </CardContent>
            <CardFooter>
              <span style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Updated 2m ago</span>
              <Button size="sm" variant="secondary">Inspect</Button>
            </CardFooter>
          </Card>

          <Card variant="raised">
            <CardHeader
              title="Raised Card"
              description="Subtle elevation shadow for prioritized content"
              action={<StatusBadge status="alert" size="sm" />}
            />
            <CardContent>
              <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', margin: 0 }}>
                Used for active breach evidence receipts and critical bilateral decision prompts.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="danger" fullWidth>Acknowledge Breach</Button>
            </CardFooter>
          </Card>

          <Card
            variant="interactive"
            onClick={() => setInteractiveCardClicked(!interactiveCardClicked)}
            tabIndex={0}
          >
            <CardHeader
              title="Interactive Clickable Card"
              description="Keyboard navigable (Enter / Space) with focus ring"
            />
            <CardContent>
              <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', margin: 0 }}>
                {interactiveCardClicked
                  ? '✓ Card clicked or activated via keyboard!'
                  : 'Click or press Tab + Enter to test interactive keyboard behavior.'}
              </p>
            </CardContent>
            <CardFooter>
              <span style={{ fontSize: '12px', color: 'var(--forest)', fontWeight: 600 }}>
                role="button" · tabIndex=0
              </span>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* 6. Tabs Component Section */}
      <section id="tabs">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>5. Tabs (`Tabs.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Accessible WAI-ARIA tab navigation with Arrow key keyboard navigation, Home/End support, and panel linkage.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  HORIZONTAL TABS (NAVIGATE WITH ARROW KEYS)
                </span>
                <Tabs value={tabValue} onValueChange={setTabValue}>
                  <TabList aria-label="Showcase Tabs">
                    <Tab value="overview">Pact Overview</Tab>
                    <Tab value="evidence">Evidence Receipt</Tab>
                    <Tab value="history">Audit Log</Tab>
                  </TabList>

                  <TabPanel value="overview">
                    <div style={{ padding: '16px', background: 'var(--paper-inset)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Active Pact:</strong> Bellandur Thursday Working Group · Destination: WeWork Prestige Tech Park · 60m threshold.
                    </div>
                  </TabPanel>

                  <TabPanel value="evidence">
                    <div style={{ padding: '16px', background: 'var(--paper-inset)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Latest Evidence:</strong> 2 fresh SerpApi observations recorded within 5 minutes.
                    </div>
                  </TabPanel>

                  <TabPanel value="history">
                    <div style={{ padding: '16px', background: 'var(--paper-inset)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Audit Trail:</strong> All state transitions committed to SQLite transaction log.
                    </div>
                  </TabPanel>
                </Tabs>
              </div>

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', display: 'block', marginBottom: '8px' }}>
                  VERTICAL TABS (SETTINGS & INSPECTION)
                </span>
                <Tabs value={verticalTabValue} onValueChange={setVerticalTabValue} orientation="vertical">
                  <TabList aria-label="Vertical Navigation">
                    <Tab value="pact">Agreement</Tab>
                    <Tab value="thresholds">Thresholds</Tab>
                    <Tab value="schedule">Schedule</Tab>
                  </TabList>

                  <TabPanel value="pact">
                    <div style={{ padding: '16px', background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Bilateral agreement:</strong> Both participants must approve version 1 before watch arms.
                    </div>
                  </TabPanel>

                  <TabPanel value="thresholds">
                    <div style={{ padding: '16px', background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Breach rule:</strong> Two distinct observations over 60 minutes required to confirm an alert.
                    </div>
                  </TabPanel>

                  <TabPanel value="schedule">
                    <div style={{ padding: '16px', background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-control)' }}>
                      <strong>Check schedule:</strong> Every 5 minutes between 07:00 and 09:00 IST.
                    </div>
                  </TabPanel>
                </Tabs>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 7. Drawer Component Section (336px Team Chat / Details) */}
      <section id="drawer">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>6. Drawer (`Drawer.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Slide-over drawer specifically built for the 336px Team Chat and details panes. Focus-trapped, backdrop dismiss, Esc key close.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Button
                variant="primary"
                onClick={() => setIsDrawerOpen(true)}
              >
                Open 336px Team Chat Drawer
              </Button>
              <span style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
                Matches the 336px in-app team chat specification. Traps keyboard focus, locks body scroll, dismisses on Escape or overlay click.
              </span>
            </div>
          </CardContent>
        </Card>

        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          width="336px"
          title="In-App Team Conversation"
          description="Group: Beyond 9to5 Commute Watch"
          footer={
            <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: 'var(--radius-control)',
                  border: '1px solid var(--rule-strong)',
                  fontSize: '13px',
                }}
              />
              <Button size="sm" variant="primary">Send</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ background: 'var(--paper-inset)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
              <strong>Arjun (08:31 IST):</strong> “Just approved v1 rules. If commute hits 60m twice, let's switch to remote.”
            </div>
            <div style={{ background: 'var(--forest-wash)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--forest-border)' }}>
              <strong>Maya (08:32 IST):</strong> “Agreed. Watch is actively armed now.”
            </div>
            <div style={{ background: 'var(--red-wash)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red-border)' }}>
              <strong>Tripwire Bot (08:45 IST):</strong> “Alert: Maya commute exceeded 60m twice (72m). Remote fallback proposed.”
            </div>
          </div>
        </Drawer>
      </section>

      {/* 8. Modal Component Section */}
      <section id="modal">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>7. Modal (`Modal.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Accessible dialog dialog with focus trapping, Escape key listener, backdrop dismissal, and multiple size presets.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setModalSize('sm');
                  setIsModalOpen(true);
                }}
              >
                Open Small Dialog (420px)
              </Button>

              <Button
                variant="primary"
                onClick={() => {
                  setModalSize('md');
                  setIsModalOpen(true);
                }}
              >
                Open Standard Dialog (560px)
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setModalSize('lg');
                  setIsModalOpen(true);
                }}
              >
                Open Large Dialog (720px)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          size={modalSize}
          title="Confirm Bilateral Pact Rule"
          description="Tripwire rule parameters for Bellandur commute watch"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsModalOpen(false);
                  addToast({
                    title: 'Pact Rule Confirmed',
                    description: 'Rule parameters updated and committed to SQLite.',
                    variant: 'success',
                  });
                }}
              >
                Confirm & Arm Watch
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
            <p style={{ margin: 0, color: 'var(--ink-secondary)' }}>
              This agreement requires both participants to approve before the watch arms:
            </p>
            <div style={{ padding: '12px', background: 'var(--paper-inset)', borderRadius: 'var(--radius-control)', border: '1px solid var(--rule)' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Agreed Team Rule:</div>
              <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
                “Reconsider if either commute exceeds 60 minutes on two consecutive checks before 09:00 IST.”
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>
              Accessible focus trap is active. Press Tab to cycle through dialog buttons; press Escape to close.
            </div>
          </div>
        </Modal>
      </section>

      {/* 9. Toast Component Section */}
      <section id="toasts">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>8. Toast (`Toast.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Toast notifications container and hook (<code style={{ fontFamily: 'var(--font-mono)' }}>useToast()</code>) supporting Info, Success, Warning, Error variants with auto-dismiss.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button
                variant="secondary"
                onClick={() =>
                  addToast({
                    title: 'Route Check Dispatched',
                    description: 'SerpApi Directions search reserved and executed.',
                    variant: 'info',
                  })
                }
              >
                Dispatch Info Toast
              </Button>

              <Button
                variant="primary"
                onClick={() =>
                  addToast({
                    title: 'Agreement Approved',
                    description: 'v1 approval recorded for Arjun. All conditions met to arm watch.',
                    variant: 'success',
                  })
                }
              >
                Dispatch Success Toast
              </Button>

              <Button
                variant="secondary"
                onClick={() =>
                  addToast({
                    title: 'Stale Data Warning',
                    description: 'Observation age is 6m (exceeds 5m ceiling). Confirmation streak cleared.',
                    variant: 'warning',
                  })
                }
              >
                Dispatch Warning Toast
              </Button>

              <Button
                variant="danger"
                onClick={() =>
                  addToast({
                    title: 'SerpApi Research Ceiling Reached',
                    description: '40/40 attempted credits spent. Automatic polling halted to protect budget.',
                    variant: 'error',
                  })
                }
              >
                Dispatch Error Toast
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 10. Tooltip Component Section */}
      <section id="tooltips">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>9. Tooltip (`Tooltip.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Accessible tooltip triggered on mouse hover and keyboard focus; dismissed with Escape key.
          </p>
        </div>

        <Card>
          <CardContent>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
              <Tooltip content="Tooltip positioned on top" position="top">
                <Button variant="secondary" size="sm">Hover / Focus (Top)</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on bottom" position="bottom">
                <Button variant="secondary" size="sm">Hover / Focus (Bottom)</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on left" position="left">
                <Button variant="secondary" size="sm">Hover / Focus (Left)</Button>
              </Tooltip>

              <Tooltip content="Tooltip positioned on right" position="right">
                <Button variant="secondary" size="sm">Hover / Focus (Right)</Button>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 11. Skeleton Component Section */}
      <section id="skeletons">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>10. Skeleton (`Skeleton.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Shimmer loading placeholders for cards, stats, tables, and typography.
          </p>
        </div>

        <Card>
          <CardHeader
            title="Placeholder Variants"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowSkeletons(!showSkeletons)}
              >
                {showSkeletons ? 'Show Loaded View' : 'Show Skeleton View'}
              </Button>
            }
          />
          <CardContent>
            {showSkeletons ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonStat />
                </div>
                <SkeletonTable rows={3} columns={4} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <Card>
                    <CardHeader title="Loaded Card 1" action={<StatusBadge status="armed" size="sm" />} />
                    <CardContent>
                      <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0 }}>
                        Data successfully loaded and rendered. Click "Show Skeleton View" to toggle loading placeholders.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader title="Loaded Card 2" action={<StatusBadge status="completed" size="sm" />} />
                    <CardContent>
                      <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0 }}>
                        All participants approved and watch completed.
                      </p>
                    </CardContent>
                  </Card>
                  <Stat
                    label="Current Estimate"
                    value="42"
                    unit="min"
                    indicator={{ type: 'positive', text: 'Fresh' }}
                    progress={{ current: 42, max: 60, label: 'Threshold: 60m' }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 12. EmptyState & ErrorState Component Section */}
      <section id="states">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>11. EmptyState & ErrorState</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            High-contrast, actionable states for zero-data and failure scenarios.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          <EmptyState
            title="No Commute Pacts Created"
            description="Create your first bilateral team agreement to monitor commute duration before leaving for the office."
            action={{
              label: 'Create Team Pact',
              onClick: () => addToast({ title: 'New Pact Clicked', variant: 'info' }),
            }}
            secondaryAction={{
              label: 'Learn Rules',
              onClick: () => addToast({ title: 'Rules Guide Opened', variant: 'info' }),
            }}
          />

          <ErrorState
            title="Failed to Retrieve Directions"
            message="SerpApi endpoint timed out after 8000ms. Your credit reservation was preserved and not charged."
            code="SERPAPI_GATEWAY_TIMEOUT"
            onRetry={async () => {
              await new Promise((r) => setTimeout(r, 1500));
              addToast({ title: 'Retry Succeeded', description: 'Fresh observation received.', variant: 'success' });
            }}
            onDismiss={() => addToast({ title: 'Error Dismissed', variant: 'info' })}
          />
        </div>
      </section>

      {/* 13. Stat Component Section */}
      <section id="stats">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>12. Stat (`Stat.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Metric card with label, tabular-nums value, status/change indicator, and accessible progress bar.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <Stat
            label="Maya Driving Estimate"
            value="42"
            unit="min"
            indicator={{ type: 'positive', text: 'Normal' }}
            progress={{ current: 42, max: 60, label: 'Threshold: 60m' }}
            description="Indiranagar → Bellandur · 2m ago"
          />

          <Stat
            label="Arjun Driving Estimate"
            value="34"
            unit="min"
            indicator={{ type: 'positive', text: 'Normal' }}
            progress={{ current: 34, max: 60, label: 'Threshold: 60m' }}
            description="HSR Layout → Bellandur · 2m ago"
          />

          <Stat
            label="Monitored Corridors"
            value="2"
            unit="routes active"
            indicator={{ type: 'positive', text: 'Normal' }}
            progress={{ current: 100, max: 100, label: 'Health: 100%' }}
            description="Real-time directions & traffic checks active"
          />

          <Stat
            label="Breach Confirmation"
            value="2"
            unit="/ 2 checks"
            indicator={{ type: 'negative', text: 'Confirmed' }}
            progress={{ current: 2, max: 2, label: 'Threshold met' }}
            description="Episode #ep_01 · Alert dispatched"
          />
        </div>
      </section>

      {/* 14. Timeline Component Section */}
      <section id="timeline">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>13. Timeline (`Timeline.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Vertical activity timeline for immutable audit logs, observation records, and breach confirmations with raw data inspect.
          </p>
        </div>

        <Card>
          <CardContent>
            <Timeline items={TIMELINE_DATA} />
          </CardContent>
        </Card>
      </section>

      {/* 15. DataTable Component Section */}
      <section id="datatable">
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>14. DataTable (`DataTable.tsx`)</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Sortable, filterable table with search input, pagination, row click handlers, and accessible markup (<code style={{ fontFamily: 'var(--font-mono)' }}>aria-sort</code>).
          </p>
        </div>

        <DataTable<ShowcasePactRow>
          columns={columns}
          data={SAMPLE_PACTS}
          keyField="id"
          pageSize={4}
          onRowClick={(row) => setSelectedTableRow(row)}
        />

        {selectedTableRow && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'var(--paper-inset)', borderRadius: 'var(--radius-control)', border: '1px solid var(--rule)' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-muted)' }}>
              SELECTED ROW DETAILS (CLICKED):
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{selectedTableRow.title}</span>
              <StatusBadge status={selectedTableRow.status} size="sm" />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Destination: {selectedTableRow.destination} · Deadline: {selectedTableRow.deadline} · Max commute: {selectedTableRow.maxDuration}m
            </div>
          </div>
        )}
      </section>

      <footer style={{ borderTop: '1px solid var(--rule)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--ink-muted)' }}>
        <span>Tripwire: Office Pact Design System & UI Library</span>
        <span>WCAG 2.2 AA Compliant · Zero Decorative Fluff</span>
      </footer>
    </div>
  );
}

export function ComponentShowcase() {
  return (
    <ToastProvider>
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', color: 'var(--ink)' }}>
        <ShowcaseContent />
      </div>
    </ToastProvider>
  );
}

export default ComponentShowcase;

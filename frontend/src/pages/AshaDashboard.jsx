import React, { useEffect, useMemo, useState, useRef } from 'react';
import supabase from '../helpers/supabaseClient';
import {
  Shield, Search, CheckCircle, Users, Calendar, User, ArrowLeft, Activity, HeartPulse, Stethoscope, MessageSquare, X, MapPin
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

const cls = (...a) => a.filter(Boolean).join(' ');
const fmt = (d) => new Date(d).toLocaleString();
const fmtDateShort = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function AshaDashboard({ workerId: workerIdProp }) {
  const [workerId] = useState(workerIdProp || "040f5544-6a7c-42e1-92ac-5e82c8003bc3");
  const [tab, setTab] = useState('patients'); // 'patients' | 'appointments' | 'patient'
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState({ type: '', message: '' });

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientVitals, setPatientVitals] = useState([]);
  const [vitalsLoading, setVitalsLoading] = useState(false);

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPeer, setChatPeer] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
    const wsRef = useRef(null);

    // Add this useEffect somewhere inside AshaDashboard (at the top level)
useEffect(() => {
  // Cleanup on unmount
  return () => {
    if (wsRef.current) {
      wsRef.current.close();   // Close WS gracefully
      wsRef.current = null;    // Clear ref
      console.log('WebSocket connection closed on component unmount');
    }
  };
}, []);


  // Load assigned patients & appointments
  useEffect(() => {
    if (!workerId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setBanner({ type: '', message: '' });

        const { data: patData, error: patErr } = await supabase
          .from('profiles')
          .select('id,name,phone,gender,age,language,village,district,state,conditions,role,assigned_worker_id')
          .eq('assigned_worker_id', workerId)
          .eq('role', 'patient')
          .order('name', { ascending: true });

        if (patErr) throw patErr;

        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
        const { data: apptData, error: apptErr } = await supabase
          .from('appointments')
          .select('id,patient_id,worker_id,scheduled_time,status,notes')
          .eq('worker_id', workerId)
          .gte('scheduled_time', since)
          .order('scheduled_time', { ascending: true });

        if (apptErr) throw apptErr;

        if (mounted) {
          setPatients(patData || []);
          setAppointments(apptData || []);
        }
      } catch (err) {
        console.error(err);
        setBanner({ type: 'error', message: err.message || 'Failed to load dashboard data.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [workerId]);

  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.village || '').toLowerCase().includes(q) ||
      (p.district || '').toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [patients, search]);

  const getChatRoom = async (patientId) => {
  try {
    const res = await fetch(`http://localhost:8003/chat/room/${patientId}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data; // { room_id, helper_id }
  } catch (err) {
    console.error('Failed to get chat room:', err);
    return null;
  }
};


  const openPatient = async (p) => {
    setSelectedPatient(p);
    setTab('patient');
    setVitalsLoading(true);
    setPatientVitals([]);
    try {
      const { data, error } = await supabase
        .from('vitals')
        .select('id,type,value,unit,measured_at')
        .eq('patient_id', p.id)
        .order('measured_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPatientVitals(data || []);
    } catch (err) {
      console.error(err);
      setBanner({ type: 'error', message: 'Failed to load patient vitals.' });
    } finally {
      setVitalsLoading(false);
    }
  };

  const goBack = () => {
    setSelectedPatient(null);
    setTab('patients');
  };

  // Chat modal handlers
const startChat = async (patient) => {
  console.log(patient);
  const roomData = await getChatRoom(patient.id);
  console.log(roomData)
  if (!roomData) {
    alert('Cannot start chat. No room found.');
    return;
  }

  setChatPeer(patient);
  setChatMessages([{ id: 1, text: `You’re now connected with ${patient.name}.`, sender: 'system' }]);

  console.log("Connecting to WS URL:", `ws://localhost:8003/ws/${roomData.room_id}`);


  try {
  const ws = new WebSocket(`ws://localhost:8003/ws/${roomData.room_id}`);
  wsRef.current = ws;

  ws.onopen = () => {
    console.log('Connected to room:', roomData.room_id);
  };
  // ws.onmessage = (event) => {
  //   const msg = JSON.parse(event.data);
  //   setChatMessages(prev => [...prev, {
  //     id: Date.now(),
  //     text: msg.text,
  //     sender: msg.sender === 'helper' ? 'patient' : 'peer'  // for helper side
  //   }]);
  // };
  ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  // Ignore messages sent by this client
  if (msg.sender === 'helper' && msg.clientId) return;

  setChatMessages(prev => [...prev, {
    id: Date.now(),
    text: msg.text,
    sender: msg.sender === 'helper' ? 'patient' : 'peer'
  }]);
};

  ws.onclose = () => console.log('WebSocket closed:', roomData.room_id);
  ws.onerror = (err) => console.error('WebSocket error:', err);
} catch (err) {
  console.error('WebSocket failed:', err);
}
  // Connect to WebSocket
  // const ws = new WebSocket(`ws://localhost:8003/ws/${roomData.room_id}`);
  // wsRef.current = ws;

  setChatOpen(true);
};



const sendChat = (text) => {
  if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

  const msg = { sender: 'helper', text, clientId: Date.now() }; // add clientId
  wsRef.current.send(JSON.stringify(msg));

  // Show it immediately in UI
  setChatMessages(prev => [...prev, { id: msg.clientId, text, sender: 'helper' }]);
};



  if (!workerId) {
    return (
      <Shell title="ASHA Dashboard" right={<div />}>
        <EmptyState text="Resolving your account..." />
      </Shell>
    );
  }

  if (tab === 'patient' && selectedPatient) {
    return (
      <>
        <Shell
          title="Patient Profile"
          left={(
            <button onClick={goBack} className="p-1">
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
          )}
        >
          {banner.type && <Banner {...banner} />}
          <PatientProfile patient={selectedPatient} vitals={patientVitals} loading={vitalsLoading} />
        </Shell>

        {/* Chat Modal */}
        {chatOpen && (
          <ChatModal
            peer={chatPeer}
            messages={chatMessages}
            onClose={() => setChatOpen(false)}
            onSend={sendChat}
          />
        )}
      </>
    );
  }

  return (
    <>
    {/* <TopNavbar /> */}
      <Shell
        title="ASHA Dashboard"
        left={<Shield className="w-6 h-6 text-emerald-600" />}
        right={<div />}
      >
        {banner.type && <Banner {...banner} />}

        {/* Tabs */}
        <div className="px-4 pt-2">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setTab('patients')}
              className={cls(
                'flex-1 py-2 text-sm font-semibold rounded-md',
                tab === 'patients' ? 'bg-white shadow text-emerald-700' : 'text-gray-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" /> Patients
              </div>
            </button>
            <button
              onClick={() => setTab('appointments')}
              className={cls(
                'flex-1 py-2 text-sm font-semibold rounded-md',
                tab === 'appointments' ? 'bg-white shadow text-emerald-700' : 'text-gray-600'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" /> Appointments
              </div>
            </button>
          </div>
        </div>

        {/* Search (patients tab only) */}
        {tab === 'patients' && (
          <div className="px-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, village, district, phone"
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <main className="p-4 space-y-4">
          {loading ? (
            <Loading />
          ) : tab === 'patients' ? (
            filteredPatients.length ? (
              <div className="space-y-3">
                {filteredPatients.map((p) => (
                  <PatientPillCard
                    key={p.id}
                    patient={p}
                    onChat={() => startChat(p)}
                    onOpenProfile={() => openPatient(p)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text={search ? 'No matching patients found.' : 'No patients assigned yet.'} />
            )
          ) : (
            <AppointmentsList
              appointments={appointments}
              patients={patients}
              onOpenPatient={(pid) => {
                const pat = patients.find(p => p.id === pid);
                if (pat) openPatient(pat);
              }}
            />
          )}
        </main>

        {/* Footer notice */}
        <footer className="p-4 border-t border-gray-200">
          <div className="flex items-start text-xs text-gray-500">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
            <span>Patient details are visible only for your assigned cases.</span>
          </div>
        </footer>
      </Shell>

      {/* Chat Modal */}
      {chatOpen && (
        <ChatModal
          peer={chatPeer}
          messages={chatMessages}
          onClose={() => setChatOpen(false)}
          onSend={sendChat}
        />
      )}
      {/* <BottomNavbar /> */}
    </>
  );
}

/* ---------- Layout helpers ---------- */
function Shell({ title, left, right, children }) {
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="w-full max-w-md mx-auto bg-white flex flex-col min-h-screen">
        <header className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {left || <div className="w-6" />}
            <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          </div>
          {right || <div className="w-6" />}
        </header>
        {children}
      </div>
    </div>
  );
}

function Banner({ type, message }) {
  return (
    <div
      className={cls(
        'mx-4 mt-3 mb-1 rounded-md p-3 text-sm',
        type === 'success'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      )}
    >
      {message}
    </div>
  );
}

function Loading() {
  return (
    <div className="py-16 flex items-center justify-center text-gray-500">
      Loading…
    </div>
  );
}

function EmptyState({ text = 'Nothing here yet.' }) {
  return <div className="py-16 text-center text-gray-500">{text}</div>;
}

/* ---------- Cards & Lists ---------- */

// Pill-style patient card with language & conditions from profiles
function PatientPillCard({ patient, onChat, onOpenProfile }) {
  const location = [patient.village, patient.district].filter(Boolean).join(', ');
  const conditions = Array.isArray(patient.conditions) ? patient.conditions : [];

  return (
    <div className="relative bg-white border border-gray-200 rounded-2xl px-3 py-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-900 truncate">{patient.name}</span>
          </div>

          {/* meta: location + language */}
          <div className="flex items-center text-[12px] text-gray-500 gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {location || 'Nearby'}
            </span>
            {patient.language && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  Language:
                  <span className="text-gray-700">{patient.language}</span>
                </span>
              </>
            )}
          </div>

          {/* condition chips */}
          {conditions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {conditions.map((c) => (
                <span
                  key={c}
                  className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                >
                  {c.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chat icon button */}
        <button
          onClick={onChat}
          className="p-2 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
          aria-label="Chat"
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Profile CTA */}
      <div className="mt-2 mx-auto text-center">
        <button
          onClick={onOpenProfile}
          className="text-xs text-emerald-700 font-medium hover:underline"
        >
          View profile
        </button>
      </div>
    </div>
  );
}

function AppointmentsList({ appointments, patients, onOpenPatient }) {
  if (!appointments.length) return <EmptyState text="No upcoming appointments." />;
  const patMap = new Map(patients.map(p => [p.id, p]));
  return (
    <div className="space-y-3">
      {appointments.map((a) => {
        const p = patMap.get(a.patient_id);
        return (
          <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-semibold text-gray-800">
                  {new Date(a.scheduled_time).toLocaleDateString()} • {fmtTime(a.scheduled_time)}
                </span>
              </div>
              <span className={cls(
                'text-xs px-2 py-1 rounded-full',
                a.status === 'scheduled' ? 'bg-emerald-50 text-emerald-700' :
                a.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                a.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
              )}>
                {a.status || 'scheduled'}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              Patient: {p?.name || a.patient_id}
            </div>
            {a.notes && (
              <div className="mt-1 text-xs text-gray-500">
                Note: {a.notes}
              </div>
            )}
            <div className="mt-2">
              <button
                className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white"
                onClick={() => onOpenPatient(a.patient_id)}
              >
                Open Profile
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Patient Profile ---------- */
function PatientProfile({ patient, vitals, loading }) {
  const byType = useMemo(() => {
    const g = new Map();
    (vitals || []).forEach(v => {
      if (!g.has(v.type)) g.set(v.type, []);
      g.get(v.type).push(v);
    });
    return g;
  }, [vitals]);

  const lastOf = (t) => (byType.get(t) || [])[0];

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <User className="w-6 h-6 text-emerald-700" />
          </div>
        </div>
        <div className="mt-2 font-semibold text-gray-900">{patient.name}</div>
        <div className="text-xs text-gray-500">
          {patient.gender || '—'} • {patient.age ? `${patient.age} yrs` : 'Age N/A'}
        </div>
        {patient.phone && (
          <div className="text-xs text-gray-600 mt-1">{patient.phone}</div>
        )}
        <div className="mt-3 text-xs text-gray-600">
          {(patient.village || patient.district || patient.state)
            ? [patient.village, patient.district, patient.state].filter(Boolean).join(', ')
            : 'Address not provided'}
        </div>
        {patient.conditions?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {patient.conditions.map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {c.replace('_',' ')}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-semibold text-gray-800">Latest Vitals</h3>
        </div>
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading vitals…</div>
        ) : vitals?.length ? (
          <div className="grid grid-cols-2 gap-3">
            <VitalTile label="Blood Glucose" v={lastOf('Blood Glucose')} icon={<Stethoscope className="w-4 h-4" />} />
            <VitalTile label="Blood Pressure" v={lastOf('Blood Pressure')} icon={<HeartPulse className="w-4 h-4" />} />
            <VitalTile label="Weight" v={lastOf('Weight')} icon={<Users className="w-4 h-4" />} />
            <VitalTile label="Heart Rate" v={lastOf('Heart Rate')} icon={<Activity className="w-4 h-4" />} />
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500 text-sm">No vitals recorded yet.</div>
        )}
      </div>

      {/* --- CHARTS: one at a time with switcher buttons --- */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-semibold text-gray-800">Trends</h3>
        </div>
        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <PastVitalsSwitcher vitals={vitals} />
        )}
      </div>
    </div>
  );
}

function VitalTile({ label, v, icon }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-500">{label}</span>
        <span className="text-emerald-700">{icon}</span>
      </div>
      <div className="mt-1">
        <div className="text-lg font-semibold text-gray-900">
          {v ? `${v.value} ${v.unit}` : '—'}
        </div>
        <div className="text-[11px] text-gray-500">
          {v ? fmt(v.measured_at) : 'No data'}
        </div>
      </div>
    </div>
  );
}

/* ---------- Chart Switcher (Recharts) ---------- */


function TinyTooltip({ label, payload }) {
  if (!payload || !Array.isArray(payload) || payload.length === 0) return null;

  // recharts passes label as a number timestamp when XAxis is type="number"
  const labelDate = typeof label === 'number' ? new Date(label) : new Date(String(label));
  const labelText = isNaN(labelDate) ? '' : labelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="rounded-lg bg-white px-3 py-2 shadow border border-gray-100 text-xs">
      {labelText && <div className="font-medium text-gray-800 mb-1">{labelText}</div>}
      {payload
        .filter(Boolean) // guard against null entries
        .map((p) => (
          <div key={(p && p.dataKey) || Math.random()} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p?.color }} />
            <span className="text-gray-600">{p?.name || p?.dataKey}:</span>
            <span className="font-semibold text-gray-900">{p?.value}</span>
          </div>
        ))}
    </div>
  );
}

function useVitalsSeries(vitals) {
  return React.useMemo(() => {
    const byType = new Map();

    (vitals || []).forEach((v) => {
      if (!v || !v.type || v.value == null || !v.measured_at) return;
      const key = v.type.trim();
      const ts = +new Date(v.measured_at); // <- numeric timestamp
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key).push({
        date: ts,
        value: Number(v.value),
        unit: v.unit || '',
      });
    });

    // sort ascending
    for (const [, arr] of byType) arr.sort((a, b) => a.date - b.date);

    // Blood Pressure: try to split systolic/diastolic if unit hints exist
    const rawBP = byType.get('Blood Pressure') || [];
    const bpSys = rawBP
      .filter((r) => /sys|systolic/i.test(r.unit))
      .map((r) => ({ date: r.date, systolic: r.value }));
    const bpDia = rawBP
      .filter((r) => /dia|diastolic/i.test(r.unit))
      .map((r) => ({ date: r.date, diastolic: r.value }));

    let bpMerged = [];
    if (bpSys.length || bpDia.length) {
      const map = new Map();
      bpSys.forEach(({ date, systolic }) => map.set(date, { date, systolic }));
      bpDia.forEach(({ date, diastolic }) => {
        const row = map.get(date) || { date };
        row.diastolic = diastolic;
        map.set(date, row);
      });
      bpMerged = Array.from(map.values()).sort((a, b) => a.date - b.date);
    } else {
      bpMerged = rawBP.map((d) => ({ date: d.date, value: d.value }));
    }

    return {
      glucose: (byType.get('Blood Glucose') || []).map((d) => ({ date: d.date, value: d.value })),
      weight: (byType.get('Weight') || []).map((d) => ({ date: d.date, value: d.value })),
      hr: (byType.get('Heart Rate') || []).map((d) => ({ date: d.date, value: d.value })),
      bp: bpMerged,
      hasSplitBP: bpSys.length > 0 || bpDia.length > 0,
    };
  }, [vitals]);
}

function PastVitalsSwitcher({ vitals }) {
  const { glucose, bp, hasSplitBP, weight, hr } = useVitalsSeries(vitals);
  const [active, setActive] = React.useState('glucose');

  const current = React.useMemo(() => {
    switch (active) {
      case 'glucose': return { data: glucose, type: 'area', title: 'Blood Glucose', unit: 'mg/dL', color: '#7c3aed' };
      case 'bp':      return { data: bp, type: hasSplitBP ? 'bp-split' : 'line', title: 'Blood Pressure', unit: 'mmHg', color: '#0ea5e9' };
      case 'weight':  return { data: weight, type: 'area', title: 'Weight', unit: 'kg', color: '#10b981' };
      case 'hr':      return { data: hr, type: 'line', title: 'Heart Rate', unit: 'bpm', color: '#f59e0b' };
      default:        return { data: [], type: 'line', title: '', unit: '', color: '#0ea5e9' };
    }
  }, [active, glucose, bp, hasSplitBP, weight, hr]);

  const hasData = Array.isArray(current.data) && current.data.length > 0;
  const gradId = `vital-grad-${active}`; // unique per active tab

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl">
        <div className="mb-2">
          <div className="text-sm font-semibold text-gray-800">{current.title}</div>
          {current.unit && <div className="text-[11px] text-gray-500">{current.unit}</div>}
        </div>

        <div className="h-56 w-full">
          {!hasData ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              No data to display.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {current.type === 'area' ? (
                <AreaChart data={current.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={current.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={current.color} stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    scale="time"
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={(props) => <TinyTooltip {...props} />} />
                  <Area type="monotone" dataKey="value" stroke={current.color} fill={`url(#${gradId})`} strokeWidth={2} />
                </AreaChart>
              ) : current.type === 'line' ? (
                <LineChart data={current.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    scale="time"
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={(props) => <TinyTooltip {...props} />} />
                  <Line type="monotone" dataKey="value" name={current.title} stroke={current.color} strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                // bp-split
                <LineChart data={current.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis
                    dataKey="date"
                    type="number"
                    scale="time"
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={(props) => <TinyTooltip {...props} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Switcher buttons */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { key: 'glucose', label: 'Glucose' },
          { key: 'bp', label: 'BP' },
          { key: 'weight', label: 'Weight' },
          { key: 'hr', label: 'Heart' },
        ].map((b) => (
          <button
            key={b.key}
            onClick={() => setActive(b.key)}
            className={cls(
              'text-xs px-3 py-2 rounded-md border transition',
              active === b.key
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
            aria-pressed={active === b.key}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
/* ---------- Chat Modal ---------- */
function ChatModal({ peer, messages, onSend, onClose }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peer]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="p-3 border-b border-gray-200 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">{peer?.name || 'Chat'}</div>
            <div className="text-[11px] text-emerald-700">Online</div>
          </div>
          <button className="p-1 rounded-md hover:bg-gray-100" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="h-[60vh] sm:h-96 overflow-y-auto p-3 bg-gray-50 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={cls('flex', m.sender === 'helper' ? 'justify-end' : 'justify-start')}>
              <div className={cls(
                'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                m.sender === 'patient' && 'bg-emerald-600 text-white rounded-br-none',
                m.sender === 'helper' && 'bg-white text-gray-800 rounded-bl-none border border-gray-200',
                m.sender === 'system' && 'bg-transparent text-gray-500 text-xs'
              )}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="p-2 border-t border-gray-200 bg-white flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
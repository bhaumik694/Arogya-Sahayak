import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../helpers/supabaseClient';
import {
	Heart,
	Droplet,
	Gauge,
	Weight,
	User,
	Plus,
	X,
	MessageSquare,
	Phone,
	MapPin,
	Building2,
	Star,
	Calendar,
} from 'lucide-react';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';

/* ---------------------- Date helpers (no TZ) ---------------------- */
const ymd = (d) => {
	const dt = d instanceof Date ? d : new Date(d);
	const Y = dt.getFullYear();
	const M = String(dt.getMonth() + 1).padStart(2, '0');
	const D = String(dt.getDate()).padStart(2, '0');
	return `${Y}-${M}-${D}`;
};
const tsNoTZ = (dateKey, time = '00:00:00') => `${dateKey} ${time}`;
const dateKeyFromDB = (ts) =>
	typeof ts === 'string' ? ts.slice(0, 10) : ymd(ts);

/* ---------------------- Main Dashboard ---------------------- */
export default function PatientDashboard() {
	const [userId, setUserId] = useState(null);
	const [profile, setProfile] = useState(null);
	const [vitals, setVitals] = useState([]);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState('');
	const wsRef = useRef(null);
	const { t } = useTranslation();

	// worker + chat + appointment
	const [assignedWorker, setAssignedWorker] = useState(null);
	const [chatOpen, setChatOpen] = useState(false);
	const [chatMsgs, setChatMsgs] = useState([]);
	const [apptOpen, setApptOpen] = useState(false);

	const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
	const todayKey = useMemo(() => ymd(new Date()), []);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				setLoading(true);
				const { data, error } = await supabase.auth.getUser();
				if (error) throw error;
				const uid = data?.user?.id || null;
				if (!uid) throw new Error('Not signed in');
				if (!mounted) return;
				setUserId(uid);

				const { data: prof, error: pErr } = await supabase
					.from('profiles')
					.select(
						'id, name, age, gender, language, village, district, state, conditions, assigned_worker_id'
					)
					.eq('id', uid)
					.single();
				if (pErr) throw pErr;
				setProfile(prof || null);

				if (prof?.assigned_worker_id) {
					const { data: worker, error: wErr } = await supabase
						.from('health_volunteers_raw')
						.select(
							'id, name, organization, rating, experience, location, languages, specialization, number, lat_long'
						)
						.eq('id', prof.assigned_worker_id)
						.maybeSingle();
					if (wErr) throw wErr;
					setAssignedWorker(worker || null);
				} else {
					setAssignedWorker(null);
				}

				await fetchAllVitals(uid);
			} catch (e) {
				console.error(e);
				setErr(e.message || 'Failed to load data');
			} finally {
				mounted && setLoading(false);
			}
		})();

		const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
			setUserId(session?.user?.id || null);
		});

		return () => {
			mounted = false;
			sub?.subscription?.unsubscribe?.();

			// ✅ Close WebSocket if open
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
				console.log('WebSocket closed on unmount');
			}
		};
	}, []);

	const fetchAllVitals = async (uid = userId) => {
		if (!uid) return;
		const { data: rows, error } = await supabase
			.from('vitals')
			.select('id, patient_id, type, value, unit, measured_at, created_at')
			.eq('patient_id', uid)
			.order('measured_at', { ascending: true });
		if (error) throw error;
		setVitals(rows || []);
	};

	const valueForToday = (type) =>
		(vitals || []).find(
			(v) => v.type === type && dateKeyFromDB(v.measured_at) === todayKey
		) || null;

	const todays = {
		glucose: valueForToday('Blood Glucose'),
		systolic: valueForToday('Systolic Blood Pressure'),
		diastolic: valueForToday('Diastolic Blood Pressure'),
		weight: valueForToday('Weight'),
		hr: valueForToday('Heart Rate'),
	};

	const userName = profile?.name || 'You';

	const handleSaveVitals = async (newVals) => {
		if (!userId) return;
		try {
			const measured_at = tsNoTZ(todayKey, '00:00:00');
			const created_at = tsNoTZ(todayKey, '00:00:00');

			const candidates = [
				{ type: 'Blood Glucose', unit: 'mg/dL', val: Number(newVals.glucose) },
				{
					type: 'Systolic Blood Pressure',
					unit: 'mmHg',
					val: Number(newVals.bpSys),
				},
				{
					type: 'Diastolic Blood Pressure',
					unit: 'mmHg',
					val: Number(newVals.bpDia),
				},
				{ type: 'Weight', unit: 'kg', val: Number(newVals.weight) },
				{ type: 'Heart Rate', unit: 'bpm', val: Number(newVals.hr) },
			];

			const dayStart = tsNoTZ(todayKey, '00:00:00');
			const dayEnd = tsNoTZ(todayKey, '23:59:59');

			for (const c of candidates) {
				if (Number.isNaN(c.val)) continue;

				const { data: existing, error: selErr } = await supabase
					.from('vitals')
					.select('id')
					.eq('patient_id', userId)
					.eq('type', c.type)
					.gte('measured_at', dayStart)
					.lte('measured_at', dayEnd)
					.limit(1);
				if (selErr) throw selErr;

				if (existing && existing.length) {
					const id = existing[0].id;
					const { error: upErr } = await supabase
						.from('vitals')
						.update({ value: c.val, unit: c.unit, measured_at })
						.eq('id', id);
					if (upErr) throw upErr;
				} else {
					const { error: inErr } = await supabase.from('vitals').insert([
						{
							patient_id: userId,
							type: c.type,
							value: c.val,
							unit: c.unit,
							measured_at,
							created_at,
						},
					]);
					if (inErr) throw inErr;
				}
			}

			await fetchAllVitals();
			setIsVitalsModalOpen(false);
		} catch (e) {
			alert(e.message || "Failed to save today's vitals");
		}
	};

	// --- Chat open helper
	const openChat = () => {
		if (!assignedWorker) return;

		// Initialize messages
		setChatMsgs([
			{
				id: 1,
				text: `You’re now connected with ${assignedWorker.name}.`,
				sender: 'helper',
			},
		]);
		setChatOpen(true);

		// If already connected, skip
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

		console.log(`${userId}_${assignedWorker.id}`);

		// Create new WebSocket connection
		wsRef.current = new WebSocket(
			`ws://localhost:8003/ws/${userId}_${assignedWorker.id}`
		);

		wsRef.current.onopen = () => {
			console.log('WebSocket connected');
		};

		wsRef.current.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data); // expect { id, sender, text }
				if (msg.sender !== 'patient') msg.sender = 'helper';
				setChatMsgs((prev) => {
					const exists = prev.some((m) => m.id === msg.id);
					return exists ? prev : [...prev, msg];
				}); // append incoming messages
			} catch (e) {
				console.error('WS invalid message', event.data);
			}
		};

		wsRef.current.onclose = () => {
			console.log('WebSocket disconnected');
		};

		wsRef.current.onerror = (err) => {
			console.error('WebSocket error', err);
		};
	};

	if (loading) {
		return (
			<div className="min-h-screen grid place-items-center text-gray-600">
				Loading…
			</div>
		);
	}

	if (err) {
		return (
			<div className="min-h-screen grid place-items-center p-6">
				<div className="max-w-sm w-full bg-white border rounded-xl p-4 text-center">
					<p className="text-red-600 text-sm">{err}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-100 font-sans">
			<div className="w-full max-w-md mx-auto bg-gray-50 flex flex-col h-screen relative">
				<TopNavbar />
				<main className="flex-1 overflow-y-auto p-4 space-y-6 my-20">
					{/* Header */}
					<div className="ml-20 flex items-center mx-auto gap-3">
						<div className="w-10 h-10 rounded-full bg-emerald-100 grid place-items-center">
							<User className="w-5 h-5 text-emerald-700" />
						</div>
						<div>
							<p className="text-sm text-gray-500">{t('dashboard.welcome')}</p>
							<h1 className="text-lg font-bold text-gray-800">{userName}</h1>
						</div>
					</div>

					{/* TODAY SUMMARY */}
					<TodayVitalsSummary
						dateKey={todayKey}
						vitals={todays}
						onUpdateClick={() => setIsVitalsModalOpen(true)}
					/>

					{/* TRENDS */}
					<VitalsTrendChart vitals={vitals} />

					{/* ---------- ASSIGNED WORKER (HelperCard style) ---------- */}
					<HelperCard
						helper={assignedWorker}
						onChat={openChat} // only icon opens chat
						onBook={() => setApptOpen(true)} // book appointment
					/>
				</main>

				<BottomNavbar />

				{isVitalsModalOpen && (
					<UpdateVitalsModal
						onClose={() => setIsVitalsModalOpen(false)}
						onSave={handleSaveVitals}
					/>
				)}

				{chatOpen && (
					<ChatModal
						peer={assignedWorker}
						messages={chatMsgs}
						onClose={() => setChatOpen(false)}
						onSend={(text) => {
							const msg = { id: Date.now(), sender: 'patient', text };

							// Optimistic UI update
							setChatMsgs((prev) => [...prev, msg]);

							// Send via WebSocket if connected
							if (
								wsRef.current &&
								wsRef.current.readyState === WebSocket.OPEN
							) {
								wsRef.current.send(JSON.stringify(msg));
							} else {
								console.warn('WebSocket not connected');
							}
						}}
					/>
				)}

				{apptOpen && (
					<AppointmentModal
						onClose={() => setApptOpen(false)}
						onConfirm={async ({ date, time }) => {
							try {
								if (!userId || !assignedWorker?.id) return;
								const dateKey = ymd(date);
								const scheduled_time = tsNoTZ(dateKey, time + ':00'); // 'HH:MM:SS'
								const { error } = await supabase.from('appointments').insert({
									patient_id: userId,
									worker_id: assignedWorker.id,
									scheduled_time,
									status: 'scheduled',
									notes: null,
								});
								if (error) throw error;
								setApptOpen(false);
								alert('Appointment booked!');
							} catch (e) {
								alert(e.message || 'Failed to book appointment');
							}
						}}
					/>
				)}
			</div>
		</div>
	);
}

/* ---------------------- Sub-components ---------------------- */

const TodayVitalsSummary = ({ dateKey, vitals, onUpdateClick }) => {
	const { t } = useTranslation();
	const bpText =
		vitals.systolic?.value != null && vitals.diastolic?.value != null
			? `${vitals.systolic.value}/${vitals.diastolic.value} mmHg`
			: 'N/A';

	return (
		<div className="bg-white rounded-xl shadow-sm p-4">
			<div className="flex justify-between items-center mb-1">
				<h2 className="font-bold text-gray-800">{t('dashboard.vitals')}</h2>
				<span className="text-xs text-gray-500">{dateKey}</span>
			</div>
			<div className="flex justify-end mb-3">
				<button
					onClick={onUpdateClick}
					className="flex items-center gap-1 text-sm bg-emerald-600 text-white font-semibold px-3 py-2 rounded-lg hover:bg-emerald-700">
					<Plus size={16} /> {t('dashboard.update')}
				</button>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<VitalCard
					icon={Droplet}
					color="red"
					label={t('dashboard.glucose')}
					value={vitals.glucose?.value ?? '—'}
					unit="mg/dL"
				/>
				<VitalCard
					icon={Heart}
					color="blue"
					label={t('dashboard.pressure')}
					value={bpText}
					unit=""
				/>
				<VitalCard
					icon={Weight}
					color="yellow"
					label={t('dashboard.weight')}
					value={vitals.weight?.value ?? '—'}
					unit="kg"
				/>
				<VitalCard
					icon={Gauge}
					color="green"
					label={t('dashboard.pressure')}
					value={vitals.hr?.value ?? '—'}
					unit="bpm"
				/>
			</div>
		</div>
	);
};

const VitalCard = ({ icon: Icon, color, label, value, unit }) => {
	const colorClasses = {
		red: 'bg-red-50 text-red-600',
		blue: 'bg-blue-50 text-blue-600',
		yellow: 'bg-yellow-50 text-yellow-600',
		green: 'bg-green-50 text-green-600',
	};
	return (
		<div className="bg-gray-50 rounded-lg p-3">
			<div className="flex items-center gap-2 mb-1">
				<div
					className={`w-7 h-7 rounded-full grid place-items-center ${colorClasses[color]}`}>
					<Icon size={16} />
				</div>
				<p className="text-xs text-gray-600 font-medium">{label}</p>
			</div>
			<p className="text-xl font-bold text-gray-800">
				{value}{' '}
				<span className="text-sm font-normal text-gray-500">{unit || ''}</span>
			</p>
		</div>
	);
};

const VitalsTrendChart = ({ vitals }) => {
	const { t } = useTranslation();
	const [timeRange, setTimeRange] = useState('all'); // 'all' | 'week' | 'month'
	const [activeVital, setActiveVital] = useState('Blood Glucose');

	const chartData = useMemo(() => {
		if (!vitals?.length) return [];
		const keys = vitals.map((v) => dateKeyFromDB(v.measured_at));
		const uniqueKeys = Array.from(new Set(keys)).sort();
		let windowKeys = uniqueKeys;
		if (timeRange === 'week') windowKeys = uniqueKeys.slice(-7);
		if (timeRange === 'month') windowKeys = uniqueKeys.slice(-30);

		const rows = windowKeys.map((k) => ({
			key: k,
			name: new Date(k + 'T00:00:00').toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
			}),
			'Blood Glucose': null,
			Systolic: null,
			Diastolic: null,
			Weight: null,
			'Heart Rate': null,
		}));
		const byKey = new Map(rows.map((r) => [r.key, r]));
		for (const v of vitals) {
			const k = dateKeyFromDB(v.measured_at);
			const row = byKey.get(k);
			if (!row) continue;
			const num = Number(v.value);
			if (v.type === 'Blood Glucose') row['Blood Glucose'] = num;
			else if (v.type === 'Systolic Blood Pressure') row['Systolic'] = num;
			else if (v.type === 'Diastolic Blood Pressure') row['Diastolic'] = num;
			else if (v.type === 'Weight') row['Weight'] = num;
			else if (v.type === 'Heart Rate') row['Heart Rate'] = num;
		}
		return rows;
	}, [vitals, timeRange]);

	const renderSeries = () => {
		if (activeVital === 'Blood Pressure') {
			return (
				<>
					<Line
						type="monotone"
						dataKey="Systolic"
						stroke="#ef4444"
						strokeWidth={2}
						yAxisId="left"
					/>
					<Line
						type="monotone"
						dataKey="Diastolic"
						stroke="#3b82f6"
						strokeWidth={2}
						yAxisId="left"
					/>
				</>
			);
		}
		const mapping = {
			'Blood Glucose': { key: 'Blood Glucose', color: '#7c3aed' },
			Weight: { key: 'Weight', color: '#10b981' },
			'Heart Rate': { key: 'Heart Rate', color: '#f59e0b' },
		};
		const { key, color } = mapping[activeVital];
		return (
			<Line
				type="monotone"
				dataKey={key}
				stroke={color}
				strokeWidth={2}
				yAxisId="left"
			/>
		);
	};

	return (
		<div className="bg-white rounded-xl shadow-sm p-4">
			<div className="flex justify-between items-center">
				<h2 className="font-bold text-gray-800">{t('dashboard.trend')}</h2>
				<div className="flex bg-gray-100 rounded-lg p-1 text-sm">
					{[t('dashboard.all'), t('dashboard.week'), t('dashboard.month')].map((r) => (
						<button
							key={r}
							onClick={() => setTimeRange(r)}
							className={`px-3 py-1 rounded-md ${
								timeRange === r ? 'bg-white shadow' : ''
							}`}
							title={r === 'all' ? 'All data' : r}>
							{r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1)}
						</button>
					))}
				</div>
			</div>
			<div className="flex gap-2 my-3 border-b pb-2">
				{[
					t('dashboard.glucose'),
					t('dashboard.pressure'),
					t('dashboard.weight'),
					t('dashboard.hr'),
				].map((v) => (
					<button
						key={v}
						onClick={() => setActiveVital(v)}
						className={`text-xs px-2 py-1 rounded-md ${
							activeVital === v
								? 'bg-emerald-100 text-emerald-700 font-semibold'
								: 'text-gray-600'
						}`}>
						{v}
					</button>
				))}
			</div>
			<div className="h-56 -ml-4">
				<ResponsiveContainer
					width="100%"
					height="100%">
					<LineChart
						data={chartData}
						margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="#e5e7eb"
						/>
						<XAxis
							dataKey="name"
							tick={{ fontSize: 10 }}
						/>
						<YAxis
							yAxisId="left"
							tick={{ fontSize: 10 }}
						/>
						<Tooltip />
						<Legend wrapperStyle={{ fontSize: '12px' }} />
						{renderSeries()}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
};

/* ---------------------- HelperCard UI (with chat icon + Book) ---------------------- */
function HelperCard({ helper, onChat, onBook }) {
	const { t } = useTranslation();
	if (!helper) {
		return (
			<div className="bg-white rounded-xl shadow-sm p-4">
				<h2 className="font-bold text-gray-800 mb-2">
					{t('dashboard.worker')}
				</h2>
				<p className="text-sm text-gray-500">{t('dashboard.noworker')}</p>
			</div>
		);
	}
	const chips = (s) =>
		(s || '')
			.split(',')
			.map((x) => x.trim())
			.filter(Boolean);

	return (
		<div className="relative bg-white border border-gray-200 rounded-2xl px-3 py-3 shadow-sm">
			<div className="flex items-start gap-3">
				<div className="w-12 h-12 rounded-full bg-emerald-100 grid place-items-center">
					<span className="text-emerald-700 font-semibold">
						{helper.name?.slice(0, 1) || 'W'}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-semibold text-gray-900 truncate">
							{helper.name}
						</span>
						{typeof helper.rating === 'number' && (
							<span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
								<Star className="w-3.5 h-3.5" /> {helper.rating.toFixed(1)}
							</span>
						)}
					</div>

					{/* meta row */}
					<div className="flex items-center text-[12px] text-gray-500 gap-3 mt-0.5 flex-wrap">
						{helper.organization && (
							<span className="inline-flex items-center gap-1">
								<Building2 className="w-3.5 h-3.5" />
								{helper.organization}
							</span>
						)}
						{helper.location && (
							<span className="inline-flex items-center gap-1">
								<MapPin className="w-3.5 h-3.5" />
								{helper.location}
							</span>
						)}
						{Number.isInteger(helper.experience) && (
							<span>{helper.experience} yrs</span>
						)}
					</div>

					{/* chips */}
					<div className="mt-2 flex flex-wrap gap-1">
						{chips(helper.languages).map((l) => (
							<span
								key={`lang-${l}`}
								className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
								{l}
							</span>
						))}
						{chips(helper.specialization).map((s) => (
							<span
								key={`spec-${s}`}
								className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
								{s}
							</span>
						))}
					</div>
				</div>

				{/* actions: chat icon only + book button */}
				<div className="flex flex-col items-end gap-2">
					<button
						onClick={onChat}
						className="p-2 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
						aria-label={t('dashboard.chat')}
						title={t('dashboard.chat')}>
						<MessageSquare className="w-5 h-5" />
					</button>
					<button
						onClick={onBook}
						className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700"
						title={t('dashboard.appointment')}>
						<Calendar className="w-4 h-4" />
						{t('dashboard.book')}
					</button>
				</div>
			</div>
		</div>
	);
}

/* ---------------------- Chat Modal ---------------------- */
function ChatModal({ peer, messages, onSend, onClose }) {
	const [text, setText] = useState('');
	const endRef = useRef(null);
	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);
	const { t } = useTranslation();
	const submit = (e) => {
		e.preventDefault();
		if (!text.trim()) return;
		onSend(text.trim());
		setText('');
	};

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
			<div
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
			/>
			<div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
				<div className="p-3 border-b border-gray-200 flex items-center gap-3">
					<div className="w-9 h-9 rounded-full bg-emerald-100 grid place-items-center">
						<span className="text-emerald-700 text-sm font-semibold">
							{peer?.name?.slice(0, 1) || 'W'}
						</span>
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-semibold text-gray-900 truncate">
							{peer?.name || t('dashboard.worker')}
						</div>
						<div className="text-[11px] text-emerald-700">Online</div>
					</div>
					<button
						className="p-1 rounded-md hover:bg-gray-100"
						onClick={onClose}
						aria-label="Close">
						<X className="w-5 h-5 text-gray-700" />
					</button>
				</div>

				<div className="h-[60vh] sm:h-96 overflow-y-auto p-3 bg-gray-50 space-y-3">
					{messages.map((m) => (
						<div
							key={m.id}
							className={`flex ${
								m.sender === 'patient' ? 'justify-end' : 'justify-start'
							}`}>
							<div
								className={[
									'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
									m.sender === 'patient' &&
										'bg-emerald-600 text-white rounded-br-none',
									m.sender === 'helper' &&
										'bg-white text-gray-800 rounded-bl-none border border-gray-200',
									m.sender === 'system' &&
										'bg-transparent text-gray-500 text-xs',
								]
									.filter(Boolean)
									.join(' ')}>
								{m.text}
							</div>
						</div>
					))}
					<div ref={endRef} />
				</div>

				<form
					onSubmit={submit}
					className="p-2 border-t border-gray-200 bg-white flex items-center gap-2">
					<input
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Type a message…"
						className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
					/>
					<button
						type="submit"
						className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
						{t('dashboard.send')}
					</button>
				</form>
			</div>
		</div>
	);
}

/* ---------------------- Appointment Modal (book & insert) ---------------------- */
function AppointmentModal({ onClose, onConfirm }) {
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState(null);
	const [selectedTime, setSelectedTime] = useState(null);
	const { t } = useTranslation();
	const today = new Date();
	const timeSlots = ['09:00', '10:30', '12:00', '15:00', '16:30', '18:00']; // 24h, seconds added on insert

	const daysInMonth = new Date(
		currentMonth.getFullYear(),
		currentMonth.getMonth() + 1,
		0
	).getDate();
	const firstDayOfMonth = new Date(
		currentMonth.getFullYear(),
		currentMonth.getMonth(),
		1
	).getDay();

	const clickDay = (day) => {
		const d = new Date(
			currentMonth.getFullYear(),
			currentMonth.getMonth(),
			day
		);
		const startOfToday = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate()
		);
		if (d <= startOfToday) return; // future only
		setSelectedDate(d);
		setSelectedTime(null);
	};
	const changeMonth = (off) =>
		setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + off, 1));

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
			<div
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
			/>
			<div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
				<header className="p-4 flex justify-between items-center border-b">
					<h3 className="font-bold text-lg">{t('dashboard.appointment')}</h3>
					<button onClick={onClose}>
						<X />
					</button>
				</header>
				<main className="p-4">
					<div className="flex items-center justify-between mb-2">
						<button
							onClick={() => changeMonth(-1)}
							className="px-2 py-1 rounded-md border">
							{'<--'}
						</button>
						<h4 className="font-semibold">
							{currentMonth.toLocaleString('default', {
								month: 'long',
								year: 'numeric',
							})}
						</h4>
						<button
							onClick={() => changeMonth(1)}
							className="px-2 py-1 rounded-md border">
							{'-->'}
						</button>
					</div>
					<div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
						{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
							<div key={d}>{d}</div>
						))}
					</div>
					<div className="grid grid-cols-7 gap-1 text-center text-sm">
						{Array.from({ length: firstDayOfMonth }).map((_, i) => (
							<div key={`e-${i}`} />
						))}
						{Array.from({ length: daysInMonth }).map((_, i) => {
							const day = i + 1;
							const d = new Date(
								currentMonth.getFullYear(),
								currentMonth.getMonth(),
								day
							);
							const startOfToday = new Date(
								today.getFullYear(),
								today.getMonth(),
								today.getDate()
							);
							const isPastOrToday = d <= startOfToday;
							const isSelected =
								selectedDate?.toDateString() === d.toDateString();
							let cls = 'w-9 h-9 grid place-items-center rounded-full';
							if (isPastOrToday) cls += ' text-gray-300';
							else if (isSelected) cls += ' bg-emerald-600 text-white';
							else cls += ' bg-green-100 text-green-700 hover:bg-green-200';
							return (
								<button
									key={day}
									onClick={() => clickDay(day)}
									className={cls}
									disabled={isPastOrToday}>
									{day}
								</button>
							);
						})}
					</div>

					{selectedDate && (
						<div className="mt-4">
							<h4 className="font-semibold text-sm mb-2">
								{t('dashboard.time_select')} • {selectedDate.toDateString()}
							</h4>
							<div className="grid grid-cols-3 gap-2">
								{timeSlots.map((t) => {
									const sel = selectedTime === t;
									let cls = 'p-2 rounded-lg text-sm text-center border ';
									cls += sel
										? 'bg-emerald-600 text-white border-emerald-600'
										: 'border-gray-300 text-gray-700 hover:bg-emerald-50';
									return (
										<button
											key={t}
											onClick={() => setSelectedTime(t)}
											className={cls}>
											{t}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</main>
				<footer className="p-4 border-t">
					<button
						onClick={() =>
							onConfirm({ date: selectedDate, time: selectedTime })
						}
						disabled={!selectedDate || !selectedTime}
						className="w-full py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">
						{t('dashboard.confirm')}
					</button>
				</footer>
			</div>
		</div>
	);
}

/* ---------------------- Update Vitals Modal ---------------------- */
const UpdateVitalsModal = ({ onClose, onSave }) => {
	//  const { t } = useTranslation();
	const [newVitals, setNewVitals] = useState({
		glucose: '',
		bpSys: '',
		bpDia: '',
		weight: '',
		hr: '',
	});
	const { t } = useTranslation();
	const onChange = (e) =>
		setNewVitals((p) => ({ ...p, [e.target.name]: e.target.value }));
	const save = () => {
		const { glucose, bpSys, bpDia, weight, hr } = newVitals;
		if (glucose && bpSys && bpDia && weight && hr) onSave(newVitals);
		else alert({ message: t('dashboard.alert') });
	};
	return (
		<div className="absolute inset-0 backdrop-blur-[1px] bg-black/5 flex items-center justify-center p-4 z-50">
			<div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
				<header className="p-4 flex justify-between items-center border-b">
					<h3 className="font-bold text-lg">{t('dashboard.update_vitals')}</h3>
					<button onClick={onClose}>
						<X />
					</button>
				</header>
				<main className="p-4 space-y-4">
					<div>
						<label className="text-sm font-medium text-gray-700">
							{t('dashboard.glucose')} (mg/dL)
						</label>
						<input
							name='glucose'
							type="number"
							inputMode="numeric"
							value={newVitals.glucose}
							onChange={onChange}
							className="w-full mt-1 border rounded-lg px-3 py-2"
						/>
					</div>
					<div>
						<label className="text-sm font-medium text-gray-700">
							{t('pressure')}(mmHg)
						</label>
						<div className="flex gap-2 mt-1">
							<input
								name="bpSys"
								type="number"
								placeholder={t('dashboard.sbp')}
								inputMode="numeric"
								value={newVitals.bpSys}
								onChange={onChange}
								className="w-full border rounded-lg px-3 py-2"
							/>
							<input
								name="bpDia"
								type="number"
								placeholder={t('dashboard.dbp')}
								inputMode="numeric"
								value={newVitals.bpDia}
								onChange={onChange}
								className="w-full border rounded-lg px-3 py-2"
							/>
						</div>
					</div>
					<div>
						<label className="text-sm font-medium text-gray-700">
							{t('dashboard.weight')} (kg)
						</label>
						<input
							name="weight"
							type="number"
							step="0.1"
							inputMode="decimal"
							value={newVitals.weight}
							onChange={onChange}
							className="w-full mt-1 border rounded-lg px-3 py-2"
						/>
					</div>
					<div>
						<label className="text-sm font-medium text-gray-700">
							{t('dashboard.hr')} (bpm)
						</label>
						<input
							name="hr"
							type="number"
							inputMode="numeric"
							value={newVitals.hr}
							onChange={onChange}
							className="w-full mt-1 border rounded-lg px-3 py-2"
						/>
					</div>
				</main>
				<footer className="p-4 border-t flex justify-end gap-2">
					<button
						onClick={onClose}
						className="px-4 py-2 rounded-lg border">
						{t('dashboard.cancel')}
					</button>
					<button
						onClick={save}
						className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">
						{t('dashboard.save')}
					</button>
				</footer>
			</div>
		</div>
	);
};

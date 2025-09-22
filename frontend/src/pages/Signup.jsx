import { useEffect, useRef, useState } from 'react';
import supabase from '../helpers/supabaseClient';
import { Heart, Phone, User, MapPin, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo2 from '../assets/logo2.png';

const PHONE_PREFIX = '+91';
const STORAGE_KEY = 'signup_wizard_v1';

const CHRONIC_CONDITIONS = [
  'diabetes','hypertension','heart_disease','kidney_disease',
  'asthma','arthritis','thyroid','obesity',
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
];

function loadSaved() {
  try {
	const raw = localStorage.getItem(STORAGE_KEY);
	return raw ? JSON.parse(raw) : null;
  } catch {
	return null;
  }
}

const Step1 = ({
  formData, onPhoneChange, onPhoneKeyDown, phoneRef,
  sendOtp, loading, otpSent, setOtp, otp, verifyOtp, otpVerified, setField
}) => (
  <div className="space-y-4">
	<div className="text-center mb-6">
	  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
		<Phone className="w-8 h-8 text-emerald-600" />
	  </div>
	  <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
	  <p className="text-sm text-gray-500">We’ll use this to keep you connected</p>
	</div>

	<div className="space-y-3">
	  <div>
		<label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number *</label>
		<input
		  ref={phoneRef}
		  id="phone"
		  type="tel"
		  inputMode="tel"
		  autoComplete="tel"
		  placeholder={`${PHONE_PREFIX} 98765 43210`}
		  value={formData.phone}
		  onChange={onPhoneChange}
		  onKeyDown={onPhoneKeyDown}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  required
		/>
	  </div>

	  {!otpSent ? (
		<button
		  type="button"
		  onClick={sendOtp}
		  disabled={loading || !formData.phone}
		  className="w-full rounded-md bg-emerald-600 text-white py-2 font-medium hover:bg-emerald-700 disabled:opacity-50"
		>
		  {loading ? 'Sending OTP...' : 'Send OTP'}
		</button>
	  ) : (
		<div className="space-y-3">
		  <div>
			<label htmlFor="otp" className="block text-sm font-medium text-gray-700">Enter OTP</label>
			<input
			  id="otp"
			  type="text"
			  inputMode="numeric"
			  placeholder="6-digit code"
			  value={otp}
			  onChange={(e) => setOtp(e.target.value)}
			  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		  </div>
		  <button
			type="button"
			onClick={verifyOtp}
			disabled={loading || !otp}
			className="w-full rounded-md bg-green-600 text-white py-2 font-medium hover:bg-green-700 disabled:opacity-50"
		  >
			{loading ? 'Verifying...' : otpVerified ? 'Verified ✅' : 'Verify OTP'}
		  </button>
		</div>
	  )}

	  <div>
		<label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Optional)</label>
		<input
		  id="email"
		  type="email"
		  placeholder="your.email@example.com"
		  value={formData.email}
		  onChange={(e) => setField('email', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		/>
	  </div>
	</div>
  </div>
);

const Step2 = ({ formData, setField }) => (
  <div className="space-y-4">
	<div className="text-center mb-6">
	  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
		<User className="w-8 h-8 text-emerald-600" />
	  </div>
	  <h3 className="text-lg font-semibold text-gray-900">Personal Details</h3>
	  <p className="text-sm text-gray-500">Help us know you better</p>
	</div>

	<div className="space-y-3">
	  <div>
		<label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name *</label>
		<input
		  id="name"
		  type="text"
		  placeholder="Enter your full name"
		  value={formData.name}
		  onChange={(e) => setField('name', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  required
		/>
	  </div>

	  <div className="grid grid-cols-2 gap-4">
		<div>
		  <label htmlFor="age" className="block text-sm font-medium text-gray-700">Age</label>
		  <input
			id="age"
			type="number"
			placeholder="25"
			value={formData.age}
			onChange={(e) => setField('age', e.target.value)}
			className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  />
		</div>

		<div>
		  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">Gender</label>
		  <select
			id="gender"
			value={formData.gender}
			onChange={(e) => setField('gender', e.target.value)}
			className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  >
			<option value="">Select</option>
			<option value="male">Male</option>
			<option value="female">Female</option>
			<option value="other">Other</option>
		  </select>
		</div>
	  </div>

	  <div className="grid grid-cols-2 gap-4">
		<div>
		  <label htmlFor="weight" className="block text-sm font-medium text-gray-700">Weight (kg)</label>
		  <input
			id="weight"
			type="number"
			placeholder="65"
			value={formData.weight}
			onChange={(e) => setField('weight', e.target.value)}
			className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  />
		</div>
		<div>
		  <label htmlFor="height" className="block text-sm font-medium text-gray-700">Height (cm)</label>
		  <input
			id="height"
			type="number"
			placeholder="170"
			value={formData.height}
			onChange={(e) => setField('height', e.target.value)}
			className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		  />
		</div>
	  </div>

	  <div>
		<label htmlFor="meal_preference" className="block text-sm font-medium text-gray-700">Meal Preference</label>
		<select
		  id="meal_preference"
		  value={formData.meal_preference || ''}
		  onChange={(e) => setField('meal_preference', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
		>
		  <option value="">Select</option>
		  <option value="veg">Vegetarian</option>
		  <option value="non-veg">Non-Vegetarian</option>
		</select>
	  </div>

	  <div>
		<label htmlFor="language" className="block text-sm font-medium text-gray-700">Preferred Language</label>
		<select
		  id="language"
		  value={formData.language}
		  onChange={(e) => setField('language', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
		>
		  <option value="en">English</option>
		  <option value="hi">हिंदी (Hindi)</option>
		  <option value="mr">मराठी (Marathi)</option>
		  <option value="gu">ગુજરાતી (Gujarati)</option>
		  <option value="bn">বাংলা (Bengali)</option>
		  <option value="ta">தமிழ் (Tamil)</option>
		  <option value="te">తెలుగు (Telugu)</option>
		  <option value="kn">ಕನ್ನಡ (Kannada)</option>
		</select>
	  </div>
	</div>
  </div>
);

const Step3 = ({ formData, setField, handleConditionChange }) => (
  <div className="space-y-4">
	<div className="text-center mb-6">
	  <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
		<Stethoscope className="w-8 h-8 text-teal-600" />
	  </div>
	  <h3 className="text-lg font-semibold text-gray-900">Health Information</h3>
	  <p className="text-sm text-gray-500">Help us provide better care</p>
	</div>

	<div className="space-y-3">
	  <div>
		<label className="block text-sm font-medium text-gray-700">Role *</label>
		<select
		  value={formData.role}
		  onChange={(e) => setField('role', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
		>
		  <option value="">Select your role</option>
		  <option value="patient">Patient - I need health management support</option>
		  <option value="worker">Health Worker - I provide community health support</option>
		</select>
	  </div>

	  {(formData.role === 'patient' || formData.role === '') && (
		<>
		  <div>
			<label className="block text-sm font-medium text-gray-700 mb-2">
			  Do you have any chronic conditions? (Select all that apply)
			</label>
			<div className="grid grid-cols-2 gap-3">
			  {CHRONIC_CONDITIONS.map((condition) => (
				<label key={condition} className="flex items-center gap-2 text-sm capitalize">
				  <input
					type="checkbox"
					className="h-4 w-4 text-emerald-600 rounded border-gray-300"
					checked={formData.conditions.includes(condition)}
					onChange={(e) => handleConditionChange(condition, e.target.checked)}
				  />
				  {condition.replace('_', ' ')}
				</label>
			  ))}
			</div>
		  </div>

		  {formData.conditions.length > 0 && (
			<>
			  <div>
				<label htmlFor="chronicSince" className="block text-sm font-medium text-gray-700">
				  When did you first get diagnosed? (Optional)
				</label>
				<input
				  id="chronicSince"
				  type="date"
				  value={formData.chronicSince}
				  onChange={(e) => setField('chronicSince', e.target.value)}
				  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
				/>
			  </div>

			  <div>
				<label className="block text-sm font-medium text-gray-700">Risk Level Assessment</label>
				<select
				  value={formData.riskLevel}
				  onChange={(e) => setField('riskLevel', e.target.value)}
				  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
				>
				  <option value="low">Low - Well managed, regular checkups</option>
				  <option value="medium">Medium - Some challenges, need support</option>
				  <option value="high">High - Frequent issues, need close monitoring</option>
				</select>
			  </div>
			</>
		  )}
		</>
	  )}
	</div>
  </div>
);

const Step4 = ({ formData, setField }) => (
  <div className="space-y-4">
	<div className="text-center mb-6">
	  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
		<MapPin className="w-8 h-8 text-green-700" />
	  </div>
	  <h3 className="text-lg font-semibold text-gray-900">Location Details</h3>
	  <p className="text-sm text-gray-500">Help us connect you with local health workers</p>
	</div>

	<div className="space-y-3">
	  <div>
		<label htmlFor="state" className="block text-sm font-medium text-gray-700">State</label>
		<select
		  id="state"
		  value={formData.state}
		  onChange={(e) => setField('state', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
		>
		  <option value="">Select your state</option>
		  {INDIAN_STATES.map((s) => (
			<option key={s} value={s}>{s}</option>
		  ))}
		</select>
	  </div>

	  <div>
		<label htmlFor="district" className="block text-sm font-medium text-gray-700">District</label>
		<input
		  id="district"
		  type="text"
		  placeholder="Enter your district"
		  value={formData.district}
		  onChange={(e) => setField('district', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		/>
	  </div>

	  <div>
		<label htmlFor="village" className="block text-sm font-medium text-gray-700">Village/City</label>
		<input
		  id="village"
		  type="text"
		  placeholder="Enter your village or city"
		  value={formData.village}
		  onChange={(e) => setField('village', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		/>
	  </div>

	  <div>
		<label htmlFor="address" className="block text-sm font-medium text-gray-700">Full Address</label>
		<textarea
		  id="address"
		  rows={3}
		  placeholder="Enter your complete address"
		  value={formData.address}
		  onChange={(e) => setField('address', e.target.value)}
		  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
		/>
	  </div>

	  {/* Geolocation */}
	  <div className="pt-1">
		<button
		  type="button"
		  onClick={() => {
			if (!navigator.geolocation) {
			  alert('Geolocation is not supported in this browser.');
			  return;
			}
			navigator.geolocation.getCurrentPosition(
			  (pos) => {
				const { latitude, longitude } = pos.coords;
				setField('latitude', latitude);
				setField('longitude', longitude);
			  },
			  (err) => {
				alert('Unable to fetch location: ' + err.message);
			  },
			  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
			);
		  }}
		  className="w-full rounded-md bg-emerald-50 text-emerald-700 py-2 font-medium hover:bg-emerald-100"
		>
		  Use current location
		</button>

		{formData.latitude != null && formData.longitude != null ? (
		  <p className="mt-2 text-xs text-gray-600">
			Location set: {Number(formData.latitude).toFixed(5)}, {Number(formData.longitude).toFixed(5)}
		  </p>
		) : (
		  <p className="mt-2 text-xs text-gray-500">Location not set</p>
		)}
	  </div>
	</div>
  </div>
);

export default function SignupForm() {
  const saved = loadSaved();
  const [formData, setFormData] = useState(
	saved?.formData ?? {
	  phone: `${PHONE_PREFIX} `,
	  email: '',
	  password: '',
	  name: '',
	  age: '',
	  gender: '',
	  language: 'en',
	  weight: '',
	  height: '',
	  role: '',
	  conditions: [],
	  chronicSince: '',
	  riskLevel: 'low',
	  address: '',
	  village: '',
	  district: '',
	  state: '',
	  meal_preference: '',
	  latitude: null,
	  longitude: null,
	}
  );
  const [currentStep, setCurrentStep] = useState(saved?.currentStep ?? 1);
  const [otpSent, setOtpSent] = useState(saved?.otpSent ?? false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(saved?.otpVerified ?? false);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const phoneRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
	if (!saved && !formData.phone?.startsWith(PHONE_PREFIX)) {
	  setFormData((p) => ({ ...p, phone: `${PHONE_PREFIX} ` }));
	}

  }, []);


  useEffect(() => {
	localStorage.setItem(
	  STORAGE_KEY,
	  JSON.stringify({ formData, currentStep, otpSent, otpVerified })
	);
  }, [formData, currentStep, otpSent, otpVerified]);

  const setField = (field, value) =>
	setFormData((prev) => ({ ...prev, [field]: value }));

  const handleConditionChange = (condition, checked) => {
	setFormData((prev) => ({
	  ...prev,
	  conditions: checked
		? [...prev.conditions, condition]
		: prev.conditions.filter((c) => c !== condition),
	}));
  };

  const normalizePhone = (raw) => {
	if (!raw.startsWith(PHONE_PREFIX)) {
	  raw = raw.replace(/^\+?0*91\s?/, '');
	  raw = `${PHONE_PREFIX} ${raw}`;
	}
	const head = raw.slice(0, PHONE_PREFIX.length);
	let tail = raw.slice(PHONE_PREFIX.length);
	tail = tail.replace(/[^\d\s]/g, '');
	tail = tail.replace(/\s+/g, ' ');
	tail = tail.replace(/^\s*/, ' ');
	return head + tail;
  };

  const onPhoneChange = (e) => setField('phone', normalizePhone(e.target.value));

  const onPhoneKeyDown = (e) => {
	if (!phoneRef.current) return;
	const pos = phoneRef.current.selectionStart ?? 0;
	const selEnd = phoneRef.current.selectionEnd ?? pos;
	const withinPrefix = pos <= PHONE_PREFIX.length && selEnd <= PHONE_PREFIX.length;
	if ((e.key === 'Backspace' && pos <= PHONE_PREFIX.length) || (e.key === 'Delete' && withinPrefix)) {
	  e.preventDefault();
	}
  };

  const e164Phone = () => formData.phone.replace(/\s+/g, '');

  // OTP
  const sendOtp = async () => {
	setBanner({ type: '', message: '' });
	const phone = e164Phone();
	if (!phone || !phone.startsWith(PHONE_PREFIX) || phone.length < 13) {
	  setBanner({ type: 'error', message: 'Enter a valid Indian phone (+91XXXXXXXXXX).' });
	  return;
	}
	try {
	  setLoading(true);
	  const { error } = await supabase.auth.signInWithOtp({ phone });
	  if (error) throw error;
	  setOtpSent(true);
	  setBanner({ type: 'success', message: 'OTP sent to your phone.' });
	} catch (err) {
	  console.error('sendOtp error:', err);
	  setBanner({ type: 'error', message: err.message || 'Failed to send OTP.' });
	} finally {
	  setLoading(false);
	}
  };

  const verifyOtp = async () => {
	setBanner({ type: '', message: '' });
	const phone = e164Phone();
	if (!otp) {
	  setBanner({ type: 'error', message: 'Please enter the OTP code.' });
	  return;
	}
	try {
	  setLoading(true);
	  const { data, error } = await supabase.auth.verifyOtp({
		phone, token: otp, type: 'sms',
	  });
	  if (error) throw error;
	  if (data?.session) {
		setOtpVerified(true);
		setBanner({ type: 'success', message: 'Phone verified!' });
	  } else {
		setBanner({ type: 'error', message: 'Invalid OTP or session not created.' });
	  }
	} catch (err) {
	  console.error('verifyOtp error:', err);
	  setBanner({ type: 'error', message: err.message || 'OTP verification failed.' });
	} finally {
	  setLoading(false);
	}
  };

  // Submit -> profiles upsert
  const handleSubmit = async (e) => {
	e.preventDefault();
	setBanner({ type: '', message: '' });

	if (!formData.phone || !formData.name || !formData.role) {
	  setBanner({ type: 'error', message: 'Required fields missing: phone, name, and role.' });
	  return;
	}
	if (!otpVerified) {
	  setBanner({ type: 'error', message: 'Please verify your phone number via OTP before creating the account.' });
	  return;
	}

	try {
	  setLoading(true);
	  const { data: userResp, error: userErr } = await supabase.auth.getUser();
	  if (userErr) throw userErr;
	  const user = userResp?.user;
	  if (!user) throw new Error('No authenticated user after OTP verification.');

	  const profilePayload = {
		id: user.id,
		phone: e164Phone(),
		email: formData.email || null,
		name: formData.name,
		age: formData.age ? Number(formData.age) : null,
		gender: formData.gender || null,
		language: formData.language || 'en',
		weight: formData.weight ? Number(formData.weight) : null,
		height: formData.height ? Number(formData.height) : null,
		role: formData.role,
		conditions: formData.conditions,
		chronic_since: formData.chronicSince || null,
		risk_level: formData.riskLevel || 'low',
		address: formData.address || null,
		village: formData.village || null,
		district: formData.district || null,
		state: formData.state || null,
		meal_preference: formData.meal_preference || null,
		latitude: formData.latitude,
		longitude: formData.longitude,
	  };

	  const { data: existing, error: selectErr } = await supabase
		.from('profiles')
		.select('id')
		.eq('id', user.id)
		.single();

	  if (selectErr && selectErr.code !== 'PGRST116') {
		console.error('profiles.select error:', selectErr);
		throw selectErr;
	  }

	  if (existing?.id) {
		const { error: upErr } = await supabase
		  .from('profiles')
		  .update(profilePayload)
		  .eq('id', user.id);
		if (upErr) {
		  console.error('profiles.update error:', upErr);
		  throw upErr;
		}
	  } else {
		const { error: insErr } = await supabase
		  .from('profiles')
		  .insert(profilePayload);
		if (insErr) {
		  console.error('profiles.insert error:', insErr);
		  throw insErr;
		}
	  }

	  setBanner({ type: 'success', message: 'Registration complete! Profile saved successfully.' });
	  navigate('/login');
	} catch (err) {
	  console.error('handleSubmit error:', err);
	  setBanner({ type: 'error', message: err.message || 'Profile save failed.' });
	} finally {
	  setLoading(false);
	}
  };

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const renderStepContent = () => {
	switch (currentStep) {
	  case 1:
		return (
		  <Step1
			formData={formData}
			onPhoneChange={onPhoneChange}
			onPhoneKeyDown={onPhoneKeyDown}
			phoneRef={phoneRef}
			sendOtp={sendOtp}
			loading={loading}
			otpSent={otpSent}
			setOtp={setOtp}
			otp={otp}
			verifyOtp={verifyOtp}
			otpVerified={otpVerified}
			setField={setField}
		  />
		);
	  case 2:
		return <Step2 formData={formData} setField={setField} />;
	  case 3:
		return (
		  <Step3
			formData={formData}
			setField={setField}
			handleConditionChange={handleConditionChange}
		  />
		);
	  case 4:
		return <Step4 formData={formData} setField={setField} />;
	  default:
		return null;
	}
  };

  return (
	<div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
	  <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow border border-gray-200">
		<div className="text-center px-6 pt-8">
			<img src={logo2} alt="" />
		  <p className="text-sm text-gray-500">
			Your trusted health companion for chronic disease management
		  </p>
		</div>

		<div className="px-6 pb-8 pt-6">
		  {/* Progress */}
		  <div className="mb-6">
			<div className="flex justify-between items-center mb-2">
			  <span className="text-sm text-gray-500">Step {currentStep} of 4</span>
			  <span className="text-sm text-emerald-600 font-medium">
				{Math.round((currentStep / 4) * 100)}%
			  </span>
			</div>
			<div className="w-full bg-gray-200 rounded-full h-2">
			  <div
				className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
				style={{ width: `${(currentStep / 4) * 100}%` }}
			  />
			</div>
		  </div>

		  {/* Banner */}
		  {banner.type && (
			<div
			  className={`mb-4 rounded-md p-3 text-sm ${
				banner.type === 'success'
				  ? 'bg-green-50 text-green-700 border border-green-200'
				  : 'bg-red-50 text-red-700 border border-red-200'
			  }`}
			>
			  {banner.message}
			</div>
		  )}

		  <form className="space-y-6">
			{renderStepContent()}

			<div className="flex gap-3 pt-2">
			  {currentStep > 1 && (
				<button
				  type="button"
				  onClick={prevStep}
				  className="flex-1 rounded-md border border-gray-300 py-2 font-medium hover:bg-gray-50"
				>
				  Previous
				</button>
			  )}

			  {currentStep < 4 ? (
				<button
				  type="button"
				  onClick={nextStep}
				  className="flex-1 rounded-md bg-emerald-600 text-white py-2 font-semibold hover:bg-emerald-700"
				  disabled={currentStep === 1 && !otpVerified}
				  title={currentStep === 1 && !otpVerified ? 'Verify OTP to continue' : ''}
				>
				  Continue
				</button>
			  ) : (
				<button
				  onClick={handleSubmit}
				  type="submit"
				  className="flex-1 rounded-md bg-emerald-600 text-white py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
				  disabled={loading}
				>
				  {loading ? 'Saving...' : 'Create Account'}
				</button>
			  )}
			</div>
		  </form>

		  <div className="mt-6 text-center">
			<div className="text-center">
			  <p className="text-sm text-gray-600">
				Don't have an account?{' '}
				<button
				  onClick={() => navigate('/login')}
				  className="text-emerald-600 hover:underline font-medium"
				>
				  Log in here
				</button>
			  </p>
			</div>
			<p className="text-xs text-gray-500">
			  By creating an account, you agree to our{' '}
			  <a href="#" className="text-emerald-600 hover:underline">Terms of Service</a>{' '}
			  and{' '}
			  <a href="#" className="text-emerald-600 hover:underline">Privacy Policy</a>.
			</p>
		  </div>
		</div>
	  </div>
	</div>
  );
}

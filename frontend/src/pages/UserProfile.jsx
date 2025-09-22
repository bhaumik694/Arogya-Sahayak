import React, { use, useEffect, useState } from 'react';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';
import {
	User,
	Share2,
	Calendar,
	Heart,
	FileText,
	UserCircle,
	Settings,
} from 'lucide-react';

// import { User } from 'lucide-react';
import supabase from '../helpers/supabaseClient';
const UserProfile = () => {
	const [userData, setUserData] = useState({});
	const [appointments, setAppointments] = useState({});
	const [filter, setFilter] = useState('scheduled'); // default filter
	const [loading, setLoading] = useState(false);
	const [workers, setWorkers] = useState([]);
	// const userId = localStorage.getItem('uniqueUserId');
	useEffect(() => {
		const getData = async () => {
			try {
				// 1. Get logged-in user
				const {
					data: { user },
					error: userError,
				} = await supabase.auth.getUser();

				if (userError) throw userError;
				if (!user) {
					console.warn('No user found.');
					return;
				}

				console.log('✅ Auth user:', user);

				// 2. Get profile
				const { data: profileData, error: profileError } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();

				if (profileError) throw profileError;
				setUserData(profileData);
				console.log('✅ Profile:', profileData);

				// 3. Get appointments
				const { data: appointmentsData, error: appointmentsError } =
					await supabase
						.from('appointments')
						.select('*, health_volunteers_raw(name,organization)')
						.eq('patient_id', user.id); // 👈 check if this column exists

				if (appointmentsError) throw appointmentsError;

				console.log('✅ Appointments fetched:', appointmentsData);
				setAppointments(appointmentsData || []);

				//get worker
			} catch (err) {
				console.error('❌ Error fetching data:', err.message);
			}
		};

		getData();
	}, []);

	// const personalDetails =  supabase.fetch()
	return (
		<div className="max-w-sm mx-auto bg-[#F5F7F3] min-h-screen my-20">
			{/* Header */}
			<TopNavbar />

			{/* Profile Section */}
			<div className="p-4">
				<div className="flex items-center gap-3 mb-4">
					<div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
						<User className="w-6 h-6 text-orange-600" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-gray-800">
							{userData.name}
						</h2>
						<p className="text-sm text-gray-500">{userData.phone}</p>
					</div>
				</div>

				<div className="flex gap-2 mb-6">
					<button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-[50px] text-sm font-medium">
						<User className="w-4 h-4" />
						Edit Profile
					</button>
					<button className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-[50px] text-sm">
						<Share2 className="w-4 h-4" />
						Share ID
					</button>
				</div>

				{/* Personal Details */}
				<div className="mb-6  p-4 color-white bg-white rounded-lg shadow-xl">
					<h3 className="text-gray-800 font-medium mb-3">Personal Details</h3>

					<div className="grid grid-cols-2 gap-4 text-sm">
						<div className="p-4 rounded-[25px] bg-[#E8F6EE]">
							<p className="text-gray-500 mb-1">Address</p>
							<p className="text-gray-800 font-bold">{userData.address}</p>
						</div>
						<div className="p-4 rounded-[25px] bg-[#E8F6EE]">
							<p className="text-gray-500 mb-1">Risk</p>
							<p className="text-gray-800 font-bold">{userData.risk_level}</p>
						</div>
						<div className="p-4 rounded-[25px] bg-[#E8F6EE]">
							<p className="text-gray-500 mb-1">Weight</p>
							<p className="text-gray-800 font-bold">{userData.weight} Kg</p>
						</div>
						<div className="p-4 rounded-[25px] bg-[#E8F6EE]">
							<p className="text-gray-500 mb-1">Height</p>
							<p className="text-gray-800 font-bold">{userData.height}cm</p>
						</div>
					</div>

					<div className="mt-4">
						<p className="text-gray-500 mb-2 text-sm">Health Conditions</p>
						<span className="space-x-4">
							{userData.conditions?.map((condition, index) => (
								<span
									key={index}
									className="bg-transparent text-black border border-gray-300 px-3 py-1 rounded-full text-xs">
									{condition}
								</span>
							))}
						</span>
					</div>
				</div>

				<div className="max-w-md mx-auto mt-6">
					{/* Filter Buttons */}
					<div className="flex gap-2 mb-4">
						{['scheduled', 'completed', 'cancelled'].map((status) => (
							<button
								key={status}
								onClick={() => setFilter(status)}
								className={`px-4 py-2 text-sm rounded-[50px] font-medium transition ${
									filter === status
										? 'bg-emerald-600 text-white'
										: 'text-gray-600 hover:border hover:border-emerald-200'
								}`}>
								{status.charAt(0).toUpperCase() + status.slice(1)}
							</button>
						))}
					</div>

					{/* Appointment Items */}
					{loading ? (
						<p>Loading...</p>
					) : appointments.length > 0 ? (
						<div className="space-y-3">
							{appointments
								.filter((appt) => appt.status === filter) // 👈 filter before mapping
								.map((appt) => (
									<div
										key={appt.id}
										className="flex items-center gap-3 p-3  bg-white shadow-md rounded-lg">
										<div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
											<User className="w-5 h-5 text-green-600" />
										</div>
										<div className="flex-1">
											<p className="text-sm font-medium text-gray-800">
												Dr. {appt.health_volunteers_raw.name} •{' '}
												{appt.health_volunteers_raw.organization}
											</p>
											<p className="text-xs text-gray-500">
												{new Date(appt.scheduled_time).toLocaleString()}
											</p>
										</div>
										<span
											className={`text-xs px-2 py-1 rounded ${
												appt.status === 'scheduled'
													? 'bg-orange-100 text-orange-700'
													: appt.status === 'completed'
													? 'bg-green-100 text-green-700'
													: 'bg-red-100 text-red-700'
											}`}>
											{appt.status.charAt(0).toUpperCase() +
												appt.status.slice(1)}
										</span>
									</div>
								))}
						</div>
					) : (
						<p className="text-gray-500">No {filter} appointments.</p>
					)}
				</div>
			</div>

			{/* Bottom Navigation */}
			<BottomNavbar />
		</div>
	);
};

export default UserProfile;

import React, { useState, useEffect } from 'react';
import { Phone, Lock, Shield, ArrowRight, X } from 'lucide-react';
import supabase from '../helpers/supabaseClient';
import { useTranslation } from 'react-i18next';
import logo2 from '../assets/logo2.png'

export default function App() {
	const handleLogin = () => {
		console.log('Login successful! Redirecting to dashboard...');
		window.location.href = '/dashboard';
	};

	const handleSignup = () => {
		console.log('Redirecting to signup...');
		window.location.href = '/signup';
	};

	return (
		<LoginPage
			onLogin={handleLogin}
			onSignup={handleSignup}
		/>
	);
}

const LoginPage = ({ onLogin, onSignup }) => {
	const { t } = useTranslation();
	const [loginMode, setLoginMode] = useState('password');
	const [formData, setFormData] = useState({
		phone: '',
		password: '',
		otp: '',
	});
	const [isOtpSent, setIsOtpSent] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [notification, setNotification] = useState({ message: '', type: '' });
	const [resendTimer, setResendTimer] = useState(0);

	useEffect(() => {
		let timer;
		if (resendTimer > 0) {
			timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
		}
		return () => clearTimeout(timer);
	}, [resendTimer]);

	const showNotification = (message, type = 'error') => {
		setNotification({ message, type });
		setTimeout(() => setNotification({ message: '', type: '' }), 4000);
	};

	const handleInputChange = (field, value) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	// Send OTP using Supabase
	const handleSendOtp = async () => {
		if (!formData.phone) {
			showNotification(t('loginPage.enterPhone'));
			return;
		}
		if (resendTimer > 0) return;

		setIsLoading(true);
		const { error } = await supabase.auth.signInWithOtp({
			phone: formData.phone,
		});

		if (error) {
			showNotification(error.message);
			setIsLoading(false);
			return;
		}

		setIsOtpSent(true);
		setIsLoading(false);
		setResendTimer(30);
		showNotification('OTP sent to your phone number!', 'success');
	};

	// Handle login with Supabase
	const handleLogin = async () => {
		setIsLoading(true);

		if (loginMode === 'password') {
			if (!formData.phone || !formData.password) {
				showNotification(t('loginPage.plsEnterBoth'));
				setIsLoading(false);
				return;
			}

			const { data, error } = await supabase.auth.signInWithPassword({
				phone: formData.phone,
				password: formData.password,
			});

			if (error) {
				showNotification(error.message);
				setIsLoading(false);
				return;
			}

			onLogin();
		} else {
			if (!formData.phone || !formData.otp) {
				showNotification('Please enter both phone number and OTP.');
				setIsLoading(false);
				return;
			}

			const { data, error } = await supabase.auth.verifyOtp({
				phone: formData.phone,
				token: formData.otp,
				type: 'sms',
			});

			if (error) {
				showNotification(error.message);
				setIsLoading(false);
				return;
			}
			const user = data.user;

			console.log(user);
			// if (user) {
			// 	// localStorage.setItem('uniqueUserId', user.id); // UUID from Supabase
			// 	// optionally store phone as well
			// 	// localStorage.setItem('userPhone', user.phone);
			// }
			onLogin();
		}
		setIsLoading(false);
	};

	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
			<div className="w-full max-w-md space-y-6">
				{/* Logo/Header */}
				<div className="text-center">
						{/* <Shield className="w-10 h-10 text-emerald-600" />*/}
						<img src={logo2} alt="" className='h-36 '/>
					{/* <h1 className="text-3xl font-bold text-gray-800">आरोग्य सहायक</h1>
					<p className="text-md text-gray-500">Aarogya Sahayak</p> */}
					<p className="text-sm text-gray-500 mt-2">
						{t('Your Trusted Health Companion')}
					</p>
				</div>

				{/* Login Card */}
				<div className="bg-white border border-gray-200 rounded-2xl shadow-xl">
					<div className="p-6 sm:p-8">
						<div className="text-center mb-6">
							<h2 className="text-xl font-semibold text-gray-900">
								{t('loginPage.title')}
							</h2>
							<p className="text-sm text-gray-500 mt-1">
								{t('loginPage.subtitle')}
							</p>
						</div>
						<div className="space-y-4">
							{/* Notification Banner */}
							{notification.message && (
								<div
									className={`p-3 rounded-lg flex items-center text-sm ${
										notification.type === 'success'
											? 'bg-green-50 text-green-800 border border-green-200'
											: 'bg-red-50 text-red-800 border border-red-200'
									}`}>
									<span className="flex-grow">{notification.message}</span>
									<button
										onClick={() => setNotification({ message: '', type: '' })}
										className="ml-2">
										<X className="w-4 h-4" />
									</button>
								</div>
							)}

							{/* Login Mode Toggle */}
							<div className="flex bg-gray-100 rounded-lg p-1">
								<button
									onClick={() => setLoginMode('password')}
									className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
										loginMode === 'password'
											? 'bg-white text-emerald-700 shadow-sm'
											: 'text-gray-500 hover:text-gray-800'
									}`}>
									{t('loginPage.tabs.password')}
								</button>
								<button
									onClick={() => setLoginMode('otp')}
									className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
										loginMode === 'otp'
											? 'bg-white text-emerald-700 shadow-sm'
											: 'text-gray-500 hover:text-gray-800'
									}`}>
									{t('loginPage.tabs.otp')}
								</button>
							</div>

							{/* Phone Number */}
							<div className="space-y-1">
								<label className="text-sm font-medium text-gray-700">
									{t('loginPage.phonePlaceholder')}
								</label>
								<div className="relative">
									<Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
									<input
										type="tel"
										placeholder="+91 98765 43210"
										value={formData.phone}
										onChange={(e) => handleInputChange('phone', e.target.value)}
										className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
									/>
								</div>
							</div>

							{/* Password or OTP */}
							{loginMode === 'password' ? (
								<div className="space-y-1">
									<label className="text-sm font-medium text-gray-700">
										{t('loginPage.passwordPlaceholder')}
									</label>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
										<input
											type="password"
											placeholder={t('loginPage.passwordPlaceholder')}
											value={formData.password}
											onChange={(e) =>
												handleInputChange('password', e.target.value)
											}
											className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
										/>
									</div>
									<button
										onClick={() => setLoginMode('otp')}
										className="text-xs text-emerald-600 hover:underline text-right w-full block pt-1">
										{t('loginPage.forgotPassword')}
									</button>
								</div>
							) : (
								<div className="space-y-3">
									{!isOtpSent ? (
										<button
											onClick={handleSendOtp}
											disabled={!formData.phone || isLoading}
											className="w-full py-2 px-4 border border-emerald-600 text-emerald-600 font-semibold rounded-md hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
											{isLoading ? 'Sending...' : 'Send OTP'}
										</button>
									) : (
										<div className="space-y-1">
											<label className="text-sm font-medium text-gray-700">
												{t('loginPage.enterOTP')}
											</label>
											<input
												type="text"
												placeholder="Enter 6-digit OTP"
												value={formData.otp}
												onChange={(e) =>
													handleInputChange('otp', e.target.value)
												}
												maxLength={6}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-center tracking-widest"
											/>
											<div className="flex justify-between items-center pt-1">
												<button
													onClick={handleSendOtp}
													className="text-xs text-emerald-600 hover:underline disabled:text-gray-400 disabled:no-underline"
													disabled={isLoading || resendTimer > 0}>
													{t('loginPage.resendOTP')}
													{resendTimer > 0 ? `(${resendTimer}s)` : ''}
												</button>
											</div>
										</div>
									)}
								</div>
							)}

							{/* Login Button */}
							<button
								onClick={handleLogin}
								disabled={isLoading}
								className="w-full flex items-center justify-center bg-emerald-600 text-white font-semibold py-2.5 px-4 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
								{isLoading ? 'Signing In...' : t('loginPage.signInButton')}
								<ArrowRight className="w-4 h-4 ml-2" />
							</button>

							{/* Divider */}
							<div className="relative py-2">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-gray-300" />
								</div>
								<div className="relative flex justify-center text-xs">
									<span className="bg-white px-2 text-gray-500">Or</span>
								</div>
							</div>

							{/* Sign Up Link */}
							<div className="text-center">
								<p className="text-sm text-gray-600">
									{t('loginPage.noAccountText')}
									<button
										onClick={onSignup}
										className="text-emerald-600 hover:underline font-medium">
										{t('loginPage.signUpLink')}
									</button>
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="text-center text-xs text-gray-400">
					<p>{t('loginPage.termsText')}</p>
				</div>
			</div>
		</div>
	);
};

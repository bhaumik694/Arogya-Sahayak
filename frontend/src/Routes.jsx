import React from 'react';
import {
	Navigate,
	Routes,
	BrowserRouter as Router,
	Route,
} from 'react-router-dom';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Home from './pages/Home';
import ConnectHelper from './pages/ConnectHelpers';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import AshaDashboard from './pages/AshaDashboard'
import FeedPage from './pages/FeedPage'

const Routers = () => {
	return (
		<>
			<Routes>
				<Route
					path="/"
					element={<Home />}
				/>
				<Route
					path="/signup"
					element={<Signup />}
				/>
				<Route
					path="/dashboard"
					element={<Dashboard />}
				/>
				<Route
					path="/login"
					element={<Login />}
				/>
				<Route
					path="/helpers"
					element={<ConnectHelper />}
				/>
				<Route
				    path="/profile"
					element={<UserProfile />}
				/>
				<Route
				    path="/asha"
					element={<AshaDashboard />}
				/>
				<Route
				    path="/feed"
					element={<FeedPage />}
				/>

			</Routes>
		</>
	);
};

export default Routers;

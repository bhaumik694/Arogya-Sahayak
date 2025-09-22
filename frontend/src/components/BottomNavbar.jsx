import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Heart, Users, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BottomNavbar = () => {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
    { name: t('bottomNav.dashboard'), icon: LayoutDashboard, path: '/dashboard' },
    { name: t('bottomNav.feed'), icon: Heart, path: '/feed' },
    { name: t('bottomNav.helpers'), icon: Users, path: '/helpers' },
    { name: t('bottomNav.profile'), icon: User, path: '/profile' },
  ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm max-w-sm mx-auto border-t border-gray-200 z-40">
            <div className="flex justify-around h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link 
                            key={item.name} 
                            to={item.path}
                            className={`flex flex-col items-center justify-center w-full pt-2 transition-colors duration-200 ${
                                isActive ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-500'
                            }`}
                        >
                            <item.icon className="h-6 w-6 mb-1" />
                            <span className="text-xs font-medium">{item.name}</span>
                            {/* Active indicator */}
                            <div className={`w-10 h-1 mt-1 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavbar;


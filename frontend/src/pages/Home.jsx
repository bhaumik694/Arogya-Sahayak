import React, { useState, useEffect } from 'react';
import Image from '../assets/hm1.jpg';
import img from '../assets/image.png';
import { useNavigate } from 'react-router-dom';
import {
    Languages,
    Users,
    BellRing,
    HeartPulse,
    Newspaper,
    Hospital,
    ShieldCheck
} from 'lucide-react';
import TopNavbar from '../components/TopNavbar';
import { useTranslation } from "react-i18next";
import img3 from '../assets/img3.jpeg';

// --- Language Modal Component ---
const LanguageModal = ({ onSave, initialLanguage }) => {
    const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'हिंदी (Hindi)' },
        { code: 'mr', name: 'मराठी (Marathi)' },
        { code: 'ta', name: 'தமிழ் (Tamil)' },
        { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
        { code: 'bn', name: 'বাংলা (Bengali)' },
        { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
        { code: 'te', name: 'తెలుగు (Telugu)' },
    ];

    const handleSave = () => {
        onSave(selectedLanguage);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[2px] bg-black/15 bg-opacity-50">
            <div className="bg-white rounded-4xl shadow-2xl p-6 w-full max-w-sm mx-4 ">
                <div className="text-center">
                    <Languages className="mx-auto w-12 h-12 text-emerald-600 mb-3" />
                    <h2 className="text-xl font-bold text-gray-800">Choose Your Language</h2>
                    <p className="text-gray-500 mt-1">Select your preferred language to continue.</p>
                </div>
                <div className="mt-6">
                    <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                        {languages.map(lang => (
                            <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                    </select>
                </div>
                <div className="mt-6">
                    <button
                        onClick={handleSave}
                        className="w-full p-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Save and Continue
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main Home Component ---
const Home = () => {
    const { t, i18n } = useTranslation();
	const navigate = useNavigate();
    const [isLangModalOpen, setLangModalOpen] = useState(false);

    // Effect to show the language modal on first visit
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentLanguage = localStorage.getItem('i18nextLng');
            if (!currentLanguage) {
                setLangModalOpen(true);
            }
        }, 2000);

        // Cleanup the timer if the component unmounts
        return () => clearTimeout(timer);
    }, []);

    const handleSaveLanguage = (langCode) => {
        i18n.changeLanguage(langCode);
        localStorage.setItem('i18nextLng', langCode);
        setLangModalOpen(false);
    };

    // Make features translatable
    const features = [
        { icon: <Languages className="w-8 h-8 text-emerald-600" />, title: t('home.features.multilingual.title'), description: t('home.features.multilingual.description') },
        { icon: <Users className="w-8 h-8 text-emerald-600" />, title: t('home.features.connect.title'), description: t('home.features.connect.description') },
        { icon: <BellRing className="w-8 h-8 text-emerald-600" />, title: t('home.features.reminders.title'), description: t('home.features.reminders.description') },
        { icon: <HeartPulse className="w-8 h-8 text-emerald-600" />, title: t('home.features.vitals.title'), description: t('home.features.vitals.description') },
        { icon: <Newspaper className="w-8 h-8 text-emerald-600" />, title: t('home.features.feed.title'), description: t('home.features.feed.description') },
        { icon: <Hospital className="w-8 h-8 text-emerald-600" />, title: t('home.features.clinics.title'), description: t('home.features.clinics.description') },
        { icon: <ShieldCheck className="w-8 h-8 text-emerald-600" />, title: t('home.features.privacy.title'), description: t('home.features.privacy.description') },
    ];

    return (
        <>
            {isLangModalOpen && <LanguageModal onSave={handleSaveLanguage} initialLanguage={i18n.language} />}
            <TopNavbar />
            <div className="w-full flex flex-col mt-20">
                {/* Hero Section */}
				<h1 className="font-bold text-2xl mx-auto md:text-4xl p-2 font-sans">{t('home.hero.title')}</h1>
				<h5 className="font-bold text-lg mx-auto md:text-xl p-2 font-sans">{t('home.hero.subtitle1')}</h5>
                <div className="flex flex-col md:flex-row items-center h-auto md:h-screen justify-center p-4 md:p-10 gap-6">
                    <div className="w-full md:w-1/2 rounded-lg flex items-center justify-center">
                        <img src={Image} alt={t('home.hero.image_alt')} className="rounded-lg selection:bg-transparent w-full h-auto" />
                    </div>
                    <div className="w-full md:w-1/2 text-center md:text-left">
                        <p className="p-2 font-semibold font-sans text-gray-700">{t('home.hero.subtitle')}</p>
                        <div className="flex flex-col md:flex-row gap-4 p-2">
                            <button  onClick={() => navigate('/signup')} className="p-4 bg-[#2F855A] text-white rounded-2xl cursor-pointer">{t('home.hero.cta_main')}</button>
                            <button  onClick={() => navigate('/signup')} className="p-4 bg-[#E6F4EA] text-[#2F855A] rounded-2xl cursor-pointer">{t('home.hero.cta_secondary')}</button>
                        </div>
                    </div>
                </div>

                {/* Why it Matters Section */}
                <div className="bg-[#E6F4EA] w-full flex flex-col my-10 rounded-lg shadow-lg">
                    <div className="p-4">
                        <h1 className="text-2xl md:text-3xl text-[#214E36] font-bold">{t('home.matters.title')}</h1>
                        <p className="text-gray-700">{t('home.matters.subtitle')}</p>
                    </div>
                    <section className="flex flex-col md:flex-row justify-center gap-6 md:gap-10 md:p-10">
                        <div className="bg-white w-full md:w-1/2 p-5 m-2 rounded-lg shadow-lg">
                            <img src={img} alt="Dummy Image" className="rounded-lg selection:bg-transparent w-full h-auto" />
                            <h1 className="font-semibold text-xl pt-4 font-sans">{t('home.matters.card1_title')}</h1>
                            <p className="text-semibold text-gray-700 font-sans">{t('home.matters.card1_desc')}</p>
                        </div>
                        <div className="bg-white w-full md:w-1/2 p-5 rounded-lg shadow-lg">
                            <img src={img3} alt="Dummy Image" className="rounded-lg selection:bg-transparent w-full h-auto" />
                            <h1 className="font-semibold text-xl pt-4 font-sans">{t('home.matters.card2_title')}</h1>
                            <p className="text-semibold text-gray-700 font-sans">{t('home.matters.card2_desc')}</p>
                        </div>
                    </section>
                </div>

                {/* What you can do? */}
                <div className="p-6 md:p-10">
                    <h2 className="text-xl md:text-2xl font-bold mb-4">{t('home.what_you_can_do.title')}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-start gap-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="flex-shrink-0 bg-emerald-100 p-3 rounded-full">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{feature.title}</h3>
                                    <p className="text-gray-600 mt-1">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Home;
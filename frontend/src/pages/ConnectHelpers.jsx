import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import supabase from '../helpers/supabaseClient';
import { User } from 'lucide-react';
import {
  Shield,
  Search,
  MapPin,
  MessageSquare,
  Phone,
  ArrowLeft,
  Send,
  CheckCircle,
} from 'lucide-react';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';

export default function App() {
  const { t } = useTranslation();

  const [view, setView] = useState('finder');
  const [selectedHelper, setSelectedHelper] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const handleStartChat = (helper) => {
    setSelectedHelper(helper);
    setChatMessages([
      {
        id: 1,
        text: t('helpers.systemMessages.connectedWith', { name: helper.name }),
        sender: 'system',
      },
      { id: 2, text: t('helpers.chat.helperHello'), sender: 'helper' },
    ]);
    setView('chat');
  };

  const handleSendMessage = (text) => {
    const newMessage = { id: Date.now(), text, sender: 'user' };
    setChatMessages((prev) => [...prev, newMessage]);

    setTimeout(() => {
      const reply = {
        id: Date.now() + 1,
        text: t('helpers.systemMessages.helperReply'),
        sender: 'helper',
      };
      setChatMessages((prev) => [...prev, reply]);
    }, 1500);
  };

  const handleEndChat = () => {
    setView('finder');
    setSelectedHelper(null);
  };

  if (view === 'chat') {
    return (
      <ChatView
        helper={selectedHelper}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        onBack={handleEndChat}
      />
    );
  }

  return <HelperFinderView onStartChat={handleStartChat} />;
}

const HelperFinderView = ({ onStartChat }) => {
  const { t } = useTranslation();

  const [filters, setFilters] = useState({
    'Diabetes Management': false,
    rating: false,
    Hindi: false,
    English: false,
    Kannada: false,
  });

  const toggleFilter = (filter) => {
    setFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const [radius, setRadius] = useState(5);
  const [userLocation, setUserLocation] = useState({ lat: null, lng: null });
  const [helpers, setHelpers] = useState([]);
  const [filteredHelpers, setFilteredHelpers] = useState([]);
  const [searching, setSearching] = useState(true);
  const [dotCount, setDotCount] = useState(1);
  const [locationAllowed, setLocationAllowed] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev >= 4 ? 1 : prev + 1));
    }, 500);
    return () => clearInterval(interval);
  }, [filteredHelpers]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationAllowed(true);
        },
        (err) => {
          console.error('Geolocation error:', err.message);
          setLocationAllowed(false);
        }
      );
    }

    const fetchHelpers = async () => {
      const { data, error } = await supabase
        .from('health_volunteers_raw')
        .select('*');

      if (error) {
        console.error('Error fetching helpers:', error.message);
        return;
      }

      const parsedHelpers = data.map((h) => {
        let lat = null;
        let lng = null;
        if (h.lat_long) {
          const [latStr, lngStr] = h.lat_long.split(',').map((v) => v.trim());
          lat = parseFloat(latStr);
          lng = parseFloat(lngStr);
        }
        return { ...h, lat, lng };
      });

      setHelpers(parsedHelpers);
    };

    fetchHelpers();
  }, []);

  useEffect(() => {
    if (!userLocation || helpers.length === 0) return;

    let active = true;

    const searchForHelpers = async () => {
      if (!active) return;
      const nearby = filterHelpersWithinRadius(
        userLocation.lat,
        userLocation.lng,
        helpers,
        radius
      );

      setFilteredHelpers(nearby);

      if (nearby.length >= 3) {
        setSearching(false);
      } else {
        setTimeout(() => {
          if (active) setRadius((prev) => prev + 5000);
        }, 2000);
      }
    };

    searchForHelpers();

    return () => {
      active = false;
    };
  }, [radius, userLocation, helpers]);

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function filterHelpersWithinRadius(userLat, userLng, helpers, radiusKm) {
    return helpers.filter((helper) => {
      const distance = haversineDistance(userLat, userLng, helper.lat, helper.lng);
      return distance <= radiusKm;
    });
  }

  const getFilteredHelpers = () => {
    return filteredHelpers.filter((helper) => {
      if (filters['Diabetes Management'] && !helper.specialization.includes('Diabetes')) {
        return false;
      }
      if (filters.rating && helper.rating < 4) {
        return false;
      }
      const langFilters = ['Hindi', 'English', 'Kannada'].filter((l) => filters[l]);
      if (langFilters.length > 0 && !langFilters.some((lang) => helper.languages.includes(lang))) {
        return false;
      }
      return true;
    });
  };

  const finalHelpers = getFilteredHelpers();

  return (
    <>
      <TopNavbar />
      <div className="min-h-screen bg-gray-100 font-sans my-20">
        <div className="w-full max-w-md mx-auto bg-white flex flex-col h-screen">
          <header className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-600" />
              <h1 className="text-lg font-bold text-gray-800">{t('helpers.title')}</h1>
            </div>
            {/* <button className="text-sm text-gray-600">{t('helpers.cancel')}</button> */}
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.keys(filters).map((filter) => (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    filters[filter]
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                  {t(`helpers.filters.${filter.replace(/ /g, '')}`)}
                </button>
              ))}
            </div>

            <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">{t('helpers.mapPlaceholder')}</p>
            </div>

            <div>
              <h2 className="text-md font-semibold text-gray-800 mb-3">
                {t('helpers.nearbyHelpers')}
              </h2>
              <div className="space-y-3">
                {locationAllowed === false && (
                  <div className="flex justify-center items-center h-20 text-center text-gray-600">
                    {t('helpers.locationDenied')}
                  </div>
                )}

                {locationAllowed === true && searching && (
                  <div className="flex justify-center items-center h-20">
                    <h2 className="text-2xl md:text-md font-extrabold text-emerald-600">
                      {t('helpers.searching', { radius })}
                      <span className="ml-2">{'.'.repeat(dotCount)}</span>
                    </h2>
                  </div>
                )}

                {finalHelpers.length === 0 ? (
                  <div className="text-center text-gray-500">{t('helpers.noHelpersFound')}</div>
                ) : (
                  finalHelpers.map((helper) => (
                    <HelperCard key={helper.id} helper={helper} onStartChat={onStartChat} />
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      <BottomNavbar />
    </>
  );
};

const HelperCard = ({ helper, onStartChat }) => {
  const { t } = useTranslation();
  const languageArray = helper.languages.split(',');
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <User />
      <div className="flex-1 flex flex-col gap-1">
        <p className="font-semibold text-gray-800">
          {helper.name} <span>⭐{helper.rating}</span>
        </p>
        <p className="text-xs text-gray-500">
          {helper.organization} • {helper.specialization || 'nne'}
        </p>
        <div className="flex flex-wrap gap-2">
          {languageArray.map((lang, index) => (
            <span
              key={index}
              className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs">
              {lang.trim()}
            </span>
          ))}
        </div>
      </div>
      <button className="p-2 bg-transparent border border-gray-200 rounded-[50%] text-white hover:bg-emerald-700 transition-colors">
        <Phone className="w-5 h-5 text-gray-950 text-xs" title={t('helpers.callButton')} />
      </button>
    </div>
  );
};

const ChatView = ({ helper, messages, onSendMessage, onBack }) => {
  const { t } = useTranslation();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="w-full max-w-md mx-auto bg-white flex flex-col h-screen">
        <header className="p-3 border-b border-gray-200 flex items-center gap-3">
          <button onClick={onBack} className="p-1">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <img src={helper.avatar} alt={helper.name} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h2 className="font-bold text-gray-800">{helper.name}</h2>
            <p className="text-xs text-emerald-600">{t('helpers.chat.online')}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}>
              {msg.sender === 'helper' && <img src={helper.avatar} className="w-6 h-6 rounded-full" />}
              <div
                className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : msg.sender === 'helper'
                    ? 'bg-gray-200 text-gray-800 rounded-bl-none'
                    : 'text-center w-full bg-transparent text-gray-500 text-xs'
                }`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-2 border-t border-gray-200 bg-white">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('helpers.chat.typeAMessage')}
              className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="text-white rounded-full p-3 hover:bg-emerald-700 transition-colors">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};


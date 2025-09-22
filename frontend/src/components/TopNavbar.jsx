import React, { useEffect, useRef, useState } from "react";
import { Heart, Bell, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import supabase from "../helpers/supabaseClient";
import logo2 from '../assets/logo2.png';

const formatIST = (ts) => {
  try {
    const d = new Date(ts);
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return ts || "";
  }
};

const TopNavbar = () => {
  const { t, i18n } = useTranslation(); // Get the 't' function
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState(null);

  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  const languages = [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'हिंदी' },
      { code: 'mr', name: 'मराठी' },
      { code: 'ta', name: 'தமிழ்' },
      { code: 'kn', name: 'ಕನ್ನಡ' },
      { code: 'bn', name: 'বাংলা' },
      { code: 'gu', name: 'ગુજરાતી' },
      { code: 'te', name: 'తెలుగు' },
  ];

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setPatientId(data?.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setPatientId(session?.user?.id ?? null);
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  const fetchReminders = async () => {
    if (!patientId) {
      setReminders([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("reminders")
      .select("id, patient_id, message, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error && Array.isArray(data)) setReminders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) fetchReminders();
  }, [patientId]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open || !btnRef.current || !menuRef.current) return;
      if (!btnRef.current.contains(e.target) && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`reminders-insert-${patientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reminders", filter: `patient_id=eq.${patientId}`},
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          setReminders((prev) => [row, ...prev].slice(0, 10));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return (
    <header className="bg-white/90 backdrop-blur-sm fixed top-0 left-0 right-0 z-40 max-w-sm mx-auto border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center space-x-2">
          <div className="rounded-lg">
            <img src={logo2} alt="Aarogya Sahayak Logo" className="h-16 p-2" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            onChange={(e) => changeLanguage(e.target.value)}
            value={i18n.language} // Use the current language state
            className="border rounded-md px-2 py-1 text-sm bg-white text-gray-700 focus:outline-none"
          >
            {/* Map over the languages array to create options */}
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>

          {/* Bell + Dropdown */}
          <div className="relative">
            <button
              ref={btnRef}
              onClick={async () => {
                if (!open && patientId) await fetchReminders();
                setOpen((v) => !v);
              }}
              className="p-2 rounded-full hover:bg-gray-100 relative"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Notifications"
            >
              <Bell className="h-6 w-6 text-gray-600" />
              {patientId && reminders.length > 0 && (
                <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>
              )}
            </button>

            {open && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-2 w-80 max-w-[80vw] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                role="menu"
              >
                <div className="max-h-80 overflow-y-auto">
                  {!patientId ? (
                    <div className="px-4 py-6 text-sm text-gray-500">{t('topNav.reminders.notSignedIn')}</div>
                  ) : loading ? (
                    <div className="px-4 py-6 text-sm text-gray-500">{t('topNav.reminders.loading')}</div>
                  ) : reminders.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">{t('topNav.reminders.noReminders')}</div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {reminders.map((r) => (
                        <li key={r.id} className="px-4 py-3">
                          <p className="text-sm text-gray-800">{r.message}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatIST(r.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
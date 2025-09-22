// src/pages/FeedPage.jsx
import React, { useEffect, useState } from "react";
import supabase from "../helpers/supabaseClient";
import {
  ChevronDown, ChevronUp, RefreshCw, Loader2,
  Tag, Dumbbell, ChefHat, Brain, Leaf, Bell, BookOpen,
} from "lucide-react";
import TopNavbar from "../components/TopNavbar";
import BottomNavbar from "../components/BottomNavbar";
import { useTranslation } from "react-i18next";

const API_BASE = "http://localhost:8003"; // FastAPI server

const iconForType = (t) => {
  switch ((t || "").toLowerCase()) {
    case "diet": return <Leaf className="w-5 h-5 text-emerald-600" />;
    case "education": return <BookOpen className="w-5 h-5 text-sky-600" />;
    case "habit": return <Brain className="w-5 h-5 text-purple-600" />;
    case "reminder": return <Bell className="w-5 h-5 text-amber-600" />;
    case "exercise": return <Dumbbell className="w-5 h-5 text-rose-600" />;
    case "recipe": return <ChefHat className="w-5 h-5 text-emerald-700" />;
    default: return <Tag className="w-5 h-5 text-gray-500" />;
  }
};

export default function FeedPage() {
  const [userId, setUserId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const { t , i18n } = useTranslation();

  // --- Get user ID from Supabase Auth ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        mounted && setUserId(data?.user?.id || null);
      } catch (e) {
        console.error(e);
      } finally {
        mounted && setAuthLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id || null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // --- Fetch newest six feed items ---
  const loadNewestSix = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("user_feed_items")
        .select(
          "id,item_type,title,body,lang,tags,risk_level,conditions,valid_for,day_index,source,created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6); // only newest six
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setError(e.message || "Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadNewestSix();
  }, [userId]);

  // --- Refresh: POST to backend then reload newest six ---
  const refreshFromBackend = async () => {
    if (!userId) return;
    const lang = i18n.language;
    try {
      setRefreshing(true);
      setError("");
      const res = await fetch(`${API_BASE}/feed/generate/${userId}/${lang}`, { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Refresh failed (${res.status}) ${txt}`);
      }
      await loadNewestSix();
    } catch (e) {
      setError(e.message || "Could not refresh feed");
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading user…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900">Please sign in</h1>
          <p className="text-sm text-gray-500 mt-1">Log in to view your feed.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <TopNavbar />
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-3 py-4 my-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">{t('feed.new_feed_count')}</h1>
          <button
            onClick={refreshFromBackend}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md p-2">{error}</div>
        )}

        {/* Items */}
        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
            Loading feed…
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-gray-500">No feed items yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <FeedItemCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </div>
    </div>
    <BottomNavbar />
    </>
  );
}

// --------- Collapsible item card ---------
function FeedItemCard({ item }) {
  const [open, setOpen] = useState(false);
  const created = new Date(item.created_at);
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const conds = Array.isArray(item.conditions) ? item.conditions : [];

  return (
    <article className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 flex items-start gap-3 focus:outline-none"
      >
        {iconForType(item.item_type)}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            <span className="uppercase">{item.item_type}</span>
            <span>•</span>
            <span>
              {created.toLocaleDateString()}{" "}
              {created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {item.source && (
              <>
                <span>•</span>
                <span>Source: {item.source}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-gray-900 line-clamp-2">{item.title}</h3>
          <div className="flex items-center text-xs text-gray-500 mt-1">
            {open ? (
              <>Collapse <ChevronUp className="w-4 h-4 ml-1" /></>
            ) : (
              <>Show details <ChevronDown className="w-4 h-4 ml-1" /></>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.body}</p>

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[10px] bg-gray-100 border border-gray-200 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-gray-500">
            {item.risk_level && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                Risk: {item.risk_level}
              </span>
            )}
            {conds.map((c) => (
              <span key={c} className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                {c}
              </span>
            ))}
          </div>

          <div className="mt-1 text-[10px] text-gray-400">
            Valid for {item.valid_for || 1} day(s) • Day index {item.day_index || 0}
          </div>
        </div>
      )}
    </article>
  );
}

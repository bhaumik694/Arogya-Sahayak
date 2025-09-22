from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os, json, datetime as dt
from typing import Dict, Any, List, Optional, Tuple
from supabase import create_client, Client
from groq import Groq
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List
import os, datetime as dt
from twilio.rest import Client as TwilioClient

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") 
SUPABASE_URL = os.getenv("SUPABASE_URL") 
SUPABASE_KEY = os.getenv("SUPABASE_KEY") 
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER") 

if not (GROQ_API_KEY and SUPABASE_URL and SUPABASE_KEY):
    raise RuntimeError("Missing GROQ_API_KEY / SUPABASE_URL / SUPABASE_KEY")

groq = Groq(api_key=GROQ_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
app = FastAPI(title="Personalized Feed (Groq)")
origins = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",  
    "http://localhost:3000", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         
    allow_credentials=True,
    allow_methods=["*"],           
    allow_headers=["*"],
)

SYSTEM_SAFETY = (
    "You are a health-support content helper. "
    "You MUST avoid diagnosis, medication changes, or emergency guidance. "
    "Provide only general wellness tips, light exercise suggestions, diet patterns, "
    "and motivational/educational content. Keep content practical and safe. "
    "Use brief safety caveats (e.g., stop if pain or dizziness). "
    "Avoid contraindications (e.g., no high impact for joint pain)."
)

FEED_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "items": {
            "type": "array",
            "minItems": 6,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "item_type": {
                        "type": "string",
                        "enum": ["exercise", "diet", "habit", "education", "reminder", "recipe"],
                    },
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "diet_alignment": {"type": "string"},
                    "ingredients": {"type": "array", "items": {"type": "string"}},
                    "instructions": {"type": "array", "items": {"type": "string"}},
                    "suitable_for": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["item_type", "title", "body"]
            },
        },
    },
    "required": ["items"],
}

PROMPT_TMPL = """Create a short *but substantial* personalized feed for today.

User profile snapshot (do not repeat PII):
- Age: {age}
- Gender: {gender}
- Language: {lang}
- Risk level: {risk}
- Conditions: {conditions}
- Meal preference: {meal_pref}
- State: {state}, District: {district}

Recent vitals snapshot (if any; keep only for tailoring, do not diagnose):
- BP: {bp}
- Glucose: {glucose}
- Weight: {weight}

Seed suggestions to respect (merge/improve, keep light & safe):
- Exercise seeds: {seed_exercise}
- Diet seeds: {seed_diet}

OUTPUT RULES (very important):
- Return STRICT JSON matching this schema (no extra keys, no prose): {schema}.
- Exactly 6 items total:
  1) one "diet"
  2) one "education"
  3) one "habit"
  4) one "reminder"
  5) one "exercise"
  6) one "recipe" that aligns with the "diet" item.
- Titles: more expressive, 6–12 words.
- Body length: ~400–500 characters each (aim 450±50), concise sentences, practical steps, Indian context when relevant (foods, walking), plus micro-safety guidance (e.g., stop if pain/dizzy).
- Language: {lang} for all text.
- Tags: add 2–5 informative tags for every item (e.g., 'low_sodium', 'high_fiber', 'senior_friendly', 'diabetic_friendly').
- For the recipe item: ALSO include these fields:
  - diet_alignment: short string describing how it fits today’s diet advice
  - ingredients: 5–10 strings (simple quantities, common Indian ingredients when possible)
  - instructions: 3–6 short imperative steps
  - suitable_for: array of conditions it fits (e.g., ['diabetes','hypertension']) — can be empty
  - tags MUST include:
      * allergen tag: either 'allergen_free' OR 'contains_nuts'/'contains_dairy'/'contains_gluten' etc.
      * cholesterol suitability tag: either 'low_cholesterol' OR 'not_low_cholesterol'
      * add 2–3 more helpful tags (e.g., 'high_fiber','vegetarian','budget_friendly').

SAFETY:
- No diagnosis, no medication changes, no emergencies.
- Avoid contraindications relative to conditions; keep intensities light to moderate unless clearly safe.
"""

def get_profile(user_id: str) -> Dict[str, Any]:
    r = supabase.table("profiles").select(
        "id, age, gender, language, risk_level, conditions, state, district , meal_preference"
    ).eq("id", user_id).single().execute()
    if not r.data:
        raise HTTPException(404, "Profile not found")
    prof = r.data
    prof["conditions"] = prof.get("conditions") or []
    return prof

def _format_vital(value, unit) -> Optional[str]:
    if value is None:
        return None
    return f"{value} {unit}".strip() if unit else str(value)

def get_latest_vitals(patient_id: Optional[str]) -> Dict[str, Optional[str]]:
    """
    Fetch latest per-type vitals from the 'vitals' table (EAV schema).
    Expected types: 'bp', 'glucose', 'weight'.
    """
    if not patient_id:
        return {"bp": None, "glucose": None, "weight": None}

    resp = (
        supabase.table("vitals")
        .select("type,value,unit,measured_at")
        .eq("patient_id", patient_id)
        .order("measured_at", desc=True)
        .limit(200) 
        .execute()
    )
    latest: Dict[str, Dict[str, Any]] = {}
    for row in resp.data or []:
        t = (row.get("type") or "").strip().lower()
        if t and t not in latest:
            latest[t] = row

    return {
        "bp": _format_vital(latest.get("bp", {}).get("value"), latest.get("bp", {}).get("unit")),
        "glucose": _format_vital(latest.get("glucose", {}).get("value"), latest.get("glucose", {}).get("unit")),
        "weight": _format_vital(latest.get("weight", {}).get("value"), latest.get("weight", {}).get("unit")),
    }

def seed_rules(profile: Dict[str, Any], vitals: Dict[str, Any], lang: str) -> Dict[str, Any]:
    conds = set(profile.get("conditions") or [])
    risk = (profile.get("risk_level") or "low").lower()
    age  = profile.get("age")
    lang = lang or "en"
    meal_pref = (profile.get("meal_preference") or "").lower()

    exercise, diet, tags = [], [], set()

    if "diabetes" in conds:
        exercise.append("10–20 min brisk walk + 5 min cool-down")
        diet.append("Carb-aware meals: whole grains, dal, veg; steady portions")
        tags.update({"diabetes","glycemic"})
    if "hypertension" in conds:
        exercise.append("4–6 cycles slow diaphragmatic breathing")
        diet.append("Lower added salt; use spices, herbs, lemon for flavour")
        tags.update({"hypertension","low_sodium"})

    if age and age >= 60:
        exercise.append("Joint-friendly mobility: ankle circles, shoulder rolls")
        tags.add("senior_friendly")
    if risk == "high":
        exercise.append("Keep intensity light; pause if dizzy or breathless")
        tags.add("high_risk")

    if vitals.get("bp"):      tags.add("bp_aware")
    if vitals.get("glucose"): tags.add("glucose_aware")
    if vitals.get("weight"):  tags.add("weight_aware")

    if meal_pref:
        tags.add(f"meal_{meal_pref}")
        if "veg" in meal_pref:
            diet.append("Vegetarian proteins: legumes, paneer/tofu, curd; focus on fiber")

    if not exercise:
        exercise.append("5–10 min light mobility + 10 min easy walk at talkable pace")
    if not diet:
        diet.append("Whole foods focus: lean protein, fibre, water; limit ultra-processed")

    return {
        "lang": lang,
        "seed_exercise": exercise[:2],
        "seed_diet": diet[:2],
        "tags": sorted(tags),
    }

def llm_generate_feed(profile: Dict[str, Any], vitals: Dict[str, Any], lang: str) -> Dict[str, Any]:
    rules = seed_rules(profile, vitals , lang)
    prompt = PROMPT_TMPL.format(
        age=profile.get("age"),
        gender=profile.get("gender"),
        lang=rules["lang"],
        risk=profile.get("risk_level"),
        conditions=", ".join(profile.get("conditions") or []),
        meal_pref=profile.get("meal_preference") or "unspecified",
        state=profile.get("state"),
        district=profile.get("district"),
        seed_exercise=rules["seed_exercise"],
        seed_diet=rules["seed_diet"],
        schema=json.dumps(FEED_JSON_SCHEMA, ensure_ascii=False),
        bp=vitals.get("bp") or "unknown",
        glucose=vitals.get("glucose") or "unknown",
        weight=vitals.get("weight") or "unknown",
    )

    completion = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_SAFETY},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    content = completion.choices[0].message.content
    data = json.loads(content)

    for it in data.get("items", []):
        it.setdefault("tags", [])
        it["tags"] = sorted(set((it["tags"] or []) + rules["tags"]))
    if "headline" not in data:
        data["headline"] = "Your plan for today"

    required = {"diet","education","habit","reminder","exercise","recipe"}
    got = {it.get("item_type") for it in data.get("items", [])}
    if got != required:
        pass

    return data

def store_feed(user_id: str, profile: Dict[str, Any], feed: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = feed["items"]
    lang = profile.get("language") or "en"
    conds = profile.get("conditions") or []
    risk  = profile.get("risk_level")

    rows = []
    for it in items:
        rows.append({
            "user_id": user_id,
            "item_type": it["item_type"],
            "title": it["title"],
            "body": it["body"],
            "lang": lang,
            "tags": it.get("tags", []),   # text[] in DB
            "risk_level": risk,
            "conditions": conds,          # text[] in DB
            "valid_for": 1,
            "day_index": 0,
            "source": "ai+rules",
        })

    if rows:
        supabase.table("user_feed_items").insert(rows).execute()

    supabase.table("user_feed_daily").upsert(
        {
            "user_id": user_id,
            "feed_date": dt.date.today().isoformat(),
            "lang": lang,
            "headline": feed.get("headline"),
        },
        on_conflict="user_id,feed_date",
    ).execute()

    return rows

def refresh_user_feed(user_id: str , lang: str) -> Tuple[int, Optional[str]]:
    try:
        profile = get_profile(user_id)
        vitals  = get_latest_vitals(profile.get("patient_id"))
        feed    = llm_generate_feed(profile, vitals, lang)
        rows    = store_feed(user_id, profile, feed)
        return (len(rows), None)
    except HTTPException as he:
        return (0, f"{user_id}: {he.status_code} {he.detail}")
    except Exception as e:
        return (0, f"{user_id}: {e}")

@app.post("/feed/generate/{user_id}/{lang}")
def generate_feed(user_id: str , lang: str):
    """Refresh feed for ONE user."""
    count, err = refresh_user_feed(user_id , lang)
    if err:
        raise HTTPException(500, err)
    return {"user_id": user_id, "count": count, "message": "refreshed"}

@app.post("/feed/refresh_all")
def refresh_all(limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0)):
    """
    Refresh feed for MANY users (paged with limit/offset).
    """
    r = supabase.table("profiles").select("id").range(offset, offset + limit - 1).execute()
    users = [row["id"] for row in (r.data or [])]

    if not users:
        return {"requested": 0, "refreshed": 0, "errors": [], "message": "No users in range"}

    refreshed, errors = 0, []
    for uid in users:
        count, err = refresh_user_feed(uid)
        if err:
            errors.append(err)
        else:
            refreshed += 1

    return {
        "requested": len(users),
        "refreshed": refreshed,
        "errors": errors[:50],
    }



@app.get("/chat/room/{patient_id}")
def get_chat_room(patient_id: str):
    """
    Returns the helper assigned to this patient
    and ensures both patient and helper can use the same "room".
    """

    patient = supabase.table("profiles").select("assigned_worker_id").eq("id", patient_id).single().execute()

    if not patient.data or not patient.data["assigned_worker_id"]:
        return {"error": "No helper assigned to this patient."}

    helper_id = patient.data["assigned_worker_id"]

    room_id = f"{patient_id}_{helper_id}"
    
    return {"room_id": room_id, "helper_id": helper_id}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def send_personal_message(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            to_remove = []
            for conn in self.active_connections[room_id]:
                try:
                    await conn.send_json(message)
                except RuntimeError:
                    to_remove.append(conn)
            for conn in to_remove:
                self.disconnect(room_id, conn)


manager = ConnectionManager()

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(room_id, websocket)
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                break  
            except Exception as e:
                print("Receive error:", e)
                continue

            try:
                await manager.send_personal_message(room_id, data)
            except Exception as e:
                print("Send error:", e)

            try:
                patient_id, helper_id = room_id.split("_")

                resp = supabase.table("messages").insert({
                    "room_id": room_id,
                    "patient_id": patient_id,
                    "helper_id": helper_id,  
                    "sender": data["sender"],
                    "message": data["text"],
                }).execute()

                if resp.error:
                    print("Supabase insert error:", resp.error)

            except Exception as e:
                print("DB insert exception:", e)

    finally:
        manager.disconnect(room_id, websocket)
        print(f"WebSocket {room_id} disconnected")


class SendReport(BaseModel):
    sent: int
    skipped: int
    failed: int
    details: List[Dict[str, Any]]

def _split_and_clean_numbers(phone_field: str) -> List[str]:
    """
    Accepts a text field that might contain one or many phone numbers
    separated by commas/spaces. Basic cleaning and dedupe.
    """
    if not phone_field:
        return []
    raw = [p.strip() for p in phone_field.replace(";", ",").replace("|", ",").split(",")]
    out = []
    seen = set()
    for p in raw:
        if not p:
            continue
        p2 = p.replace(" ", "")
        if not p2.startswith("+") and p2.isdigit():
            p2 = "+91" + p2
        if p2 not in seen:
            seen.add(p2)
            out.append(p2)
    return out

def _build_message(name: str | None) -> str:
    display = (name or "there").strip() or "there"
    return f"Hi {display}, don’t forget to add today’s vitals."

def _fetch_profiles() -> List[Dict[str, Any]]:
    """
    Fetch profiles with id, phone, and a name-like field.
    We try a few likely name columns to keep this resilient.
    """
    select_variants = [
        "id, phone, name",
        "id, phone, full_name",
        "id, phone, first_name",
        "id, phone", 
    ]
    last_err = None
    for cols in select_variants:
        try:
            resp = supabase.table("profiles").select(cols).execute()
            return resp.data or []
        except Exception as e:
            last_err = e
            continue
    raise HTTPException(status_code=500, detail=f"Failed to fetch profiles: {last_err}")

@app.get("/send-daily-vitals-reminders", response_model=SendReport)
def send_daily_vitals_reminders():
    """
    GET:
      - Reads all profiles (id, phone, name-like)
      - Sends Twilio SMS personalized with the patient's name
      - Inserts a record into reminders for each successful send
      - Returns a summary report
    """
    rows = _fetch_profiles()

    sent = 0
    skipped = 0
    failed = 0
    details: List[Dict[str, Any]] = []

    for row in rows:
        pid = row.get("id")
        phone_field = row.get("phone") or ""

        display_name = row.get("name") or row.get("full_name") or row.get("first_name") or None

        numbers = _split_and_clean_numbers(phone_field)
        if not numbers:
            skipped += 1
            details.append({"patient_id": pid, "status": "skipped", "reason": "no valid phone"})
            continue

        message_text = _build_message(display_name)

        for to_number in numbers:
            try:
                twilio_client.messages.create(
                    body=message_text,
                    from_=TWILIO_FROM_NUMBER,
                    to=to_number
                )
                supabase.table("reminders").insert({
                    "patient_id": pid,
                    "message": message_text
                }).execute()

                sent += 1
                details.append({"patient_id": pid, "to": to_number, "status": "sent", "name": display_name})
            except Exception as e:
                failed += 1
                details.append({"patient_id": pid, "to": to_number, "status": "failed", "error": str(e)})

    return SendReport(sent=sent, skipped=skipped, failed=failed, details=details)

class Report(BaseModel):
    sent: int
    skipped: int
    failed: int
    details: List[Dict[str, Any]]

def split_and_clean_numbers(phone_field: str | None) -> List[str]:
    """Accepts possibly multi-value phone field, returns E.164-ish numbers."""
    if not phone_field:
        return []
    raw = (
        phone_field.replace(";", ",")
        .replace("|", ",")
        .replace("\n", ",")
        .split(",")
    )
    out: List[str] = []
    seen = set()
    for p in (x.strip() for x in raw):
        if not p:
            continue
        n = p.replace(" ", "")
        if not n.startswith("+") and n.isdigit():
            n = "+91" + n
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out

def best_name(profile: Dict[str, Any]) -> str:
    return (profile.get("name") or profile.get("full_name") or profile.get("first_name") or "there").strip() or "there"

def fmt_ist(iso_or_dt: str | datetime) -> str:
    """Format UTC to IST for user-facing SMS."""
    if isinstance(iso_or_dt, str):
        dt = datetime.fromisoformat(iso_or_dt.replace("Z", "+00:00"))
    else:
        dt = iso_or_dt
    ist = dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
    return ist.strftime("%d %b, %I:%M %p IST")

def message_for(name: str, when_label: str, appt_id: str) -> str:
    return f"Hi {name}, reminder: your appointment is at {when_label}. (APPT:{appt_id})"

@app.get("/send-appointment-reminders-now", response_model=Report)
def send_appointment_reminders_now(window_minutes: int = Query(90, ge=1, le=180)):
    """
    On demand route:
      - Finds appointments with scheduled_time in [now, now + window_minutes)
      - Joins profiles to get name + phone
      - Sends Twilio SMS (personalized) and logs to 'reminders'
      - Returns summary
    Assumes appointments.scheduled_time is stored in UTC.
    """
    now_utc = datetime.now(timezone.utc)
    end = now_utc + timedelta(minutes=window_minutes)

    try:
        appt_resp = (
            supabase.table("appointments")
            .select("id, patient_id, scheduled_time")
            .gte("scheduled_time", now_utc.isoformat())
            .lt("scheduled_time", end.isoformat())
            .execute()
        )
        appts = appt_resp.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch appointments: {e}")

    if not appts:
        return Report(sent=0, skipped=0, failed=0, details=[])

    patient_ids = list({a["patient_id"] for a in appts if a.get("patient_id")})
    profiles_map: Dict[str, Dict[str, Any]] = {}
    if patient_ids:
        try:
            prof_resp = (
                supabase.table("profiles")
                .select("id, phone, name, full_name, first_name")
                .in_("id", patient_ids)
                .execute()
            )
            for row in (prof_resp.data or []):
                profiles_map[row["id"]] = row
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch profiles: {e}")

    sent = skipped = failed = 0
    details: List[Dict[str, Any]] = []

    for appt in appts:
        appt_id = appt.get("id")
        pid = appt.get("patient_id")
        sched = appt.get("scheduled_time")
        prof = profiles_map.get(pid)

        if not prof:
            skipped += 1
            details.append({"appt_id": appt_id, "patient_id": pid, "status": "skipped", "reason": "no profile"})
            continue

        numbers = split_and_clean_numbers(prof.get("phone"))
        if not numbers:
            skipped += 1
            details.append({"appt_id": appt_id, "patient_id": pid, "status": "skipped", "reason": "no valid phone"})
            continue

        name = best_name(prof)
        when_label = fmt_ist(sched)
        body = message_for(name, when_label, appt_id)

        for to in numbers:
            try:
                
                twilio_client.messages.create(body=body, from_=TWILIO_FROM_NUMBER, to=to)
            
                supabase.table("reminders").insert({"patient_id": pid, "message": body}).execute()

                sent += 1
                details.append({"appt_id": appt_id, "patient_id": pid, "to": to, "status": "sent"})
            except Exception as e:
                failed += 1
                details.append({"appt_id": appt_id, "patient_id": pid, "to": to, "status": "failed", "error": str(e)})

    return Report(sent=sent, skipped=skipped, failed=failed, details=details)
@app.get("/")
async def root():
    return {"message": "Hello World"}










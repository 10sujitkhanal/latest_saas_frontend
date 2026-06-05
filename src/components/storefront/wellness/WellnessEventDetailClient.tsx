"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Globe, Users, ArrowLeft,
  CheckCircle2, Share2, ExternalLink, Ticket, Play,
} from "lucide-react";
import type { PublicStorefront } from "@/lib/storefront/storefrontPublicApi";
import { WellnessPageLayout } from "./WellnessPageLayout";

interface StoredEvent {
  id: string; title: string; description: string;
  date: string; time: string; endTime: string; location: string;
  capacity: number; ticketPrice: number; isFree: boolean;
  imageUrl: string; videoUrl: string; onlineLink?: string;
  isOnlineEvent: boolean; visible: boolean; onMoreDealsX: boolean; tags?: string;
}

function EventQRClient({ url }: { url: string }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    import("qrcode").then(QRCode =>
      QRCode.toDataURL(url, { width: 160, margin: 1, color: { dark: "#1a3a2b", light: "#fff" } }).then(setQr)
    );
  }, [url]);
  if (!qr) return <div className="w-40 h-40 bg-stone-100 rounded-xl animate-pulse" />;
  return <img src={qr} alt="QR Code" className="w-40 h-40 rounded-xl border border-stone-200 shadow-sm" />;
}

export function WellnessEventDetailClient({ storefront, eventId }: { storefront: PublicStorefront; eventId: string }) {
  const [event, setEvent] = useState<StoredEvent | null>(null);
  const [loading, setLoading] = useState(true);

  // RSVP form
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`storefront_cache_${storefront.slug}`);
      if (raw) {
        const cache = JSON.parse(raw);
        const found = (cache.events ?? []).find((e: StoredEvent) => e.id === eventId);
        if (found) setEvent(found);
      }
    } catch {}
    setLoading(false);
  }, [storefront.slug, eventId]);

  const handleRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    setTicketRef(`TKT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
    setSubmitted(true);
    setSubmitting(false);
  };

  const eventUrl = typeof window !== "undefined" ? window.location.href : "";
  const isPast = event ? new Date(event.date + "T23:59:59") < new Date() : false;
  const d = event?.date ? new Date(event.date + "T00:00:00") : null;

  if (loading) {
    return (
      <WellnessPageLayout storefront={storefront}>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 rounded-full border-2 border-[#1a3a2b] border-t-transparent animate-spin" />
        </div>
      </WellnessPageLayout>
    );
  }

  if (!event) {
    return (
      <WellnessPageLayout storefront={storefront}>
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <Calendar className="mx-auto h-12 w-12 text-stone-200 mb-4" />
          <p className="text-stone-600 font-semibold text-lg mb-2">Event not found</p>
          <Link href={`/s/${storefront.slug}`} className="text-sm text-emerald-600 hover:underline">
            ← Back to {storefront.name}
          </Link>
        </div>
      </WellnessPageLayout>
    );
  }

  return (
    <WellnessPageLayout storefront={storefront}>
      {/* Banner */}
      {event.imageUrl ? (
        <div className="relative h-64 sm:h-80 overflow-hidden">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {event.videoUrl && (
            <a href={event.videoUrl} target="_blank" rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                <Play size={24} className="text-slate-800 ml-1" />
              </div>
            </a>
          )}
          {isPast && (
            <span className="absolute top-4 left-4 text-xs font-bold bg-black/60 text-white px-3 py-1 rounded-full">Past event</span>
          )}
        </div>
      ) : (
        <div className="h-4 bg-gradient-to-r from-[#1a3a2b] to-emerald-600" />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/s/${storefront.slug}`} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-[#1a3a2b] mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to {storefront.name}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title + meta */}
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${event.isFree ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {event.isFree ? "Free Entry" : `NPR ${event.ticketPrice.toLocaleString()}`}
                </span>
                {event.isOnlineEvent && <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">🌐 Online</span>}
                {isPast && <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">Past</span>}
              </div>
              <h1 className="text-3xl font-extrabold text-stone-900 leading-tight">{event.title}</h1>
              {event.tags && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {event.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                    <span key={tag} className="text-[11px] bg-stone-100 text-stone-600 rounded-full px-2.5 py-1">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {d && (
                <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                  <Calendar className="h-5 w-5 text-[#1a3a2b] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Date</p>
                    <p className="font-semibold text-stone-800 mt-0.5">
                      {d.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                <Clock className="h-5 w-5 text-[#1a3a2b] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Time</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{event.time}{event.endTime ? ` – ${event.endTime}` : ""}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                {event.isOnlineEvent ? <Globe className="h-5 w-5 text-[#1a3a2b] shrink-0 mt-0.5" /> : <MapPin className="h-5 w-5 text-[#1a3a2b] shrink-0 mt-0.5" />}
                <div>
                  <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">{event.isOnlineEvent ? "Platform" : "Location"}</p>
                  <p className="font-semibold text-stone-800 mt-0.5">{event.location || "To be confirmed"}</p>
                </div>
              </div>
              {event.capacity > 0 && (
                <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                  <Users className="h-5 w-5 text-[#1a3a2b] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Capacity</p>
                    <p className="font-semibold text-stone-800 mt-0.5">{event.capacity} seats</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
                <h2 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-3">About this event</h2>
                <p className="text-stone-700 leading-relaxed whitespace-pre-line">{event.description}</p>
              </div>
            )}

            {/* Share */}
            <button onClick={() => navigator.clipboard?.writeText(eventUrl)}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-[#1a3a2b] transition-colors">
              <Share2 className="h-4 w-4" /> Share this event
            </button>
          </div>

          {/* Right: RSVP or Ticket */}
          <div className="space-y-4">
            {submitted ? (
              <div className="bg-white rounded-3xl border border-stone-200 shadow-lg p-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                <h3 className="font-bold text-stone-900 text-lg mb-1">
                  {event.isFree ? "You're registered!" : "Ticket confirmed!"}
                </h3>
                <p className="text-sm text-stone-500 mb-1">Reference: <span className="font-mono font-bold text-stone-800">{ticketRef}</span></p>
                <p className="text-xs text-stone-400 mb-5">{storefront.name} will be in touch.</p>

                {/* QR Code ticket */}
                <div className="flex flex-col items-center">
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Your ticket QR</p>
                  <EventQRClient url={`${eventUrl}?ref=${ticketRef}`} />
                  <p className="text-[10px] text-stone-400 mt-2">Screenshot or show this at the event</p>
                </div>

                {event.isOnlineEvent && event.onlineLink && (
                  <a href={event.onlineLink} target="_blank" rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                    <ExternalLink className="h-4 w-4" /> Join online event
                  </a>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-stone-200 shadow-lg p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="h-5 w-5 text-[#1a3a2b]" />
                  <h3 className="font-bold text-stone-900">
                    {isPast ? "Event ended" : event.isFree ? "Reserve your spot" : "Get your ticket"}
                  </h3>
                </div>
                <p className="text-2xl font-extrabold text-[#1a3a2b] mb-4">
                  {event.isFree ? "Free" : `NPR ${event.ticketPrice.toLocaleString()}`}
                </p>

                {isPast ? (
                  <p className="text-sm text-stone-400 text-center py-4">This event has already taken place.</p>
                ) : (
                  <form onSubmit={handleRsvp} className="space-y-3">
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Full name *"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2b]/20" />
                    <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone number *"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2b]/20" />
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email (optional)"
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2b]/20" />
                    <button type="submit" disabled={submitting}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#1a3a2b] hover:bg-emerald-800 disabled:opacity-50 transition-colors shadow-md">
                      {submitting ? "Registering…" : event.isFree ? "Register for free" : `Pay & Register`}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Event QR preview */}
            {!submitted && !isPast && (
              <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">Scan to share</p>
                <div className="flex justify-center">
                  <EventQRClient url={eventUrl} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </WellnessPageLayout>
  );
}

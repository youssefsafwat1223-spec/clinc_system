import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  ChevronDown,
  Sparkles,
  Shield,
  Star,
  Smile,
  Gem,
  ScanLine,
  Syringe,
  HeartPulse,
  Baby,
  Layers,
  ArrowLeft,
  Menu,
  X,
  User,
  Stethoscope,
} from 'lucide-react';
import api from '../api/client';

/* ──────────────────────────────────────────────
   Fallback constants (used when API is unavailable)
   ────────────────────────────────────────────── */

const FALLBACK_CLINIC = {
  name: 'د. ابراهيم التخصصي',
  nameAr: 'د. ابراهيم التخصصي',
  phone: '07882332330',
  address: 'العراق - النجف الأشرف - شارع مكتب الرشيد',
  whatsappLink: 'https://wa.me/9647882332330',
  googleMapsLink: 'https://maps.app.goo.gl/F4gJhkgjVWuyLgn67?g_st=iw',
  workingHours: {
    sunday: { start: '09:00', end: '17:00' },
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '14:00' },
    friday: null,
    saturday: null,
  },
};

const CLINIC_SUBTITLE = 'لطب وتجميل الأسنان';
const CLINIC_DESCRIPTION =
  'عيادة مختصة بطب وتجميل الأسنان حيث نقدم خدمات متكاملة لكل ما تحتاجه في طب الأسنان التجميلي والعلاجي ونقدم تجربة متطورة وفريدة بأحدث التقنيات والخبرات';

const DAY_NAMES = {
  sunday: 'الأحد',
  monday: 'الأثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

/* Map service name keywords to icons */
const SERVICE_ICON_MAP = [
  { keywords: ['تبييض', 'whitening'], icon: Sparkles },
  { keywords: ['تقويم', 'braces', 'orthodon'], icon: Layers },
  { keywords: ['زراعة', 'implant'], icon: Syringe },
  { keywords: ['تنظيف', 'cleaning', 'scaling'], icon: Shield },
  { keywords: ['حشو', 'filling', 'ترميم'], icon: Gem },
  { keywords: ['خلع', 'extraction', 'جراح'], icon: HeartPulse },
  { keywords: ['أطفال', 'طفل', 'child', 'pediatric'], icon: Baby },
  { keywords: ['تجميل', 'cosmetic', 'veneer', 'فينير', 'ابتسامة', 'smile'], icon: Smile },
  { keywords: ['أشعة', 'scan', 'x-ray', 'xray'], icon: ScanLine },
];

function getServiceIcon(service) {
  const haystack = [service.name, service.nameAr, service.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const entry of SERVICE_ICON_MAP) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) return entry.icon;
  }
  return Star;
}

/* ──────────────────────────────────────────────
   Intersection Observer hook
   ────────────────────────────────────────────── */

function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      { threshold: 0.15, ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, isInView];
}

/* ──────────────────────────────────────────────
   Animated Counter hook
   ────────────────────────────────────────────── */

function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start || target === 0) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, start, duration]);

  return count;
}

/* ──────────────────────────────────────────────
   Tooth SVG Icon
   ────────────────────────────────────────────── */

function ToothIcon({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" className={className}>
      <path d="M32 4c-7.5 0-13 2.5-16.5 6.5C12 14.5 11 19.5 11 24c0 5 1.5 9.5 3 14 1.5 4.5 3 9 3.5 14 .5 4.5 1.5 8 4.5 8s4-3 5-8c.5-2.5 1-5 2.5-7s3.5-3 5-3 3.5 1 5 3 2 4.5 2.5 7c1 5 2 8 5 8s4-3.5 4.5-8c.5-5 2-9.5 3.5-14s3-9 3-14c0-4.5-1-9.5-4.5-13.5S39.5 4 32 4z" />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   Main Landing Page
   ────────────────────────────────────────────── */

export default function LandingPage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [clinic, setClinic] = useState(FALLBACK_CLINIC);
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({ patients: 0, appointments: 0, doctors: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Fetch public data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, settingsRes] = await Promise.all([
          api.get('/services/public').catch(() => null),
          api.get('/settings/public').catch(() => null),
        ]);

        if (servicesRes) setServices(servicesRes.data.services || []);
        if (settingsRes) {
          const d = settingsRes.data;
          setClinic({ ...FALLBACK_CLINIC, ...d.clinic });
          setDoctors(d.doctors || []);
          setStats(d.stats || { patients: 0, appointments: 0, doctors: 0 });
        }
      } catch {
        /* fallback to defaults */
      } finally {
        setServicesLoading(false);
      }
    };
    fetchData();
  }, []);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const whatsappLink = clinic.whatsappLink || `https://wa.me/9647882332330`;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans overflow-x-hidden" dir="rtl">
      {/* ── Top Info Bar ── */}
      <TopInfoBar clinic={clinic} />

      {/* ── Navbar ── */}
      <Navbar
        clinic={clinic}
        scrolled={scrolled}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        scrollToSection={scrollToSection}
      />

      {/* ── Hero ── */}
      <HeroSection clinic={clinic} whatsappLink={whatsappLink} scrollToSection={scrollToSection} />

      {/* ── Features ── */}
      <FeaturesSection />

      {/* ── Counter / Stats ── */}
      <CounterSection stats={stats} />

      {/* ── Services ── */}
      <ServicesSection services={services} loading={servicesLoading} whatsappLink={whatsappLink} />

      {/* ── Doctors ── */}
      {doctors.length > 0 && <DoctorsSection doctors={doctors} />}

      {/* ── About ── */}
      <AboutSection clinic={clinic} whatsappLink={whatsappLink} />

      {/* ── Contact ── */}
      <ContactSection clinic={clinic} whatsappLink={whatsappLink} />

      {/* ── Footer ── */}
      <Footer clinic={clinic} />

      {/* ── WhatsApp FAB ── */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30 transition-transform hover:scale-110 active:scale-95"
        aria-label="تواصل عبر واتساب"
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </a>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Section Components
   ══════════════════════════════════════════════ */

/* ── Top Info Bar ── */
function TopInfoBar({ clinic }) {
  return (
    <div className="bg-[#060a16] border-b border-white/5 py-2 px-6 text-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-sky-400" />
          <span>{clinic.address}</span>
        </div>
        <a
          href={`tel:${clinic.phone}`}
          className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
        >
          <Phone className="h-3.5 w-3.5 text-sky-400" />
          <span dir="ltr">{clinic.phone}</span>
        </a>
      </div>
    </div>
  );
}

/* ── Navbar ── */
function Navbar({ clinic, scrolled, mobileMenuOpen, setMobileMenuOpen, scrollToSection }) {
  const navLinks = [
    { label: 'الرئيسية', id: 'hero' },
    { label: 'خدماتنا', id: 'services' },
    { label: 'عن العيادة', id: 'about' },
    { label: 'تواصل ويانا', id: 'contact' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0a0f1e]/90 shadow-lg shadow-black/20 backdrop-blur-xl border-b border-white/5'
          : 'bg-[#060a16]/80 backdrop-blur-sm'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <button onClick={() => scrollToSection('hero')} className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-600 shadow-lg shadow-sky-500/25 transition-transform group-hover:scale-105">
            <ToothIcon className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-base font-bold tracking-tight text-white">{clinic.nameAr || clinic.name}</p>
            <p className="text-[10px] font-medium text-sky-400/80">{CLINIC_SUBTITLE}</p>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Mobile burger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 md:hidden"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-all duration-300 md:hidden ${
          mobileMenuOpen ? 'max-h-96 border-b border-white/5' : 'max-h-0'
        }`}
      >
        <div className="space-y-1 bg-[#0a0f1e]/95 px-6 pb-6 pt-2 backdrop-blur-xl">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="block w-full rounded-lg px-4 py-3 text-right text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ── Hero ── */
function HeroSection({ clinic, whatsappLink, scrollToSection }) {
  const [ref, inView] = useInView();

  return (
    <section
      id="hero"
      ref={ref}
      className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-6 pt-10"
    >
      {/* Background image */}
      <div className="pointer-events-none absolute inset-0">
        <img src="/images/hero-bg.png" alt="" className="h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1e] via-[#0a0f1e]/80 to-[#0a0f1e]" />
      </div>

      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 right-[-10%] h-[500px] w-[500px] rounded-full bg-sky-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-[-10%] h-[400px] w-[400px] rounded-full bg-cyan-600/8 blur-[100px]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div
        className={`relative z-10 mx-auto max-w-4xl text-center transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-5 py-2 text-sm font-medium text-sky-300">
          <Sparkles className="h-4 w-4" />
          <span>أحدث التقنيات في طب الأسنان</span>
        </div>

        {/* Heading */}
        <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="block text-white">{clinic.nameAr || clinic.name}</span>
          <span className="mt-2 block bg-gradient-to-l from-sky-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            {CLINIC_SUBTITLE}
          </span>
        </h1>

        {/* Description */}
        <p className="mx-auto mb-10 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
          {CLINIC_DESCRIPTION}
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-8 py-4 text-lg font-bold text-white shadow-2xl shadow-sky-500/25 transition-all hover:shadow-sky-500/40 hover:brightness-110"
          >
            <MessageCircle className="h-6 w-6" />
            <span>احجز موعدك هسه</span>
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </a>
          <button
            onClick={() => scrollToSection('services')}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <span>شوف خدماتنا</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex h-8 w-5 items-start justify-center rounded-full border-2 border-white/20 p-1">
          <div className="h-2 w-1 animate-bounce rounded-full bg-white/40" />
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */
function FeaturesSection() {
  const [ref, inView] = useInView();

  const features = [
    {
      icon: Shield,
      title: 'تعقيم وأمان',
      description: 'نلتزم بأعلى معايير التعقيم والسلامة لضمان صحتك وراحتك',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      icon: Sparkles,
      title: 'تقنيات حديثة',
      description: 'نستخدم أحدث الأجهزة والتقنيات المتطورة في عالم طب الأسنان',
      gradient: 'from-sky-500/20 to-blue-500/20',
      iconColor: 'text-sky-400',
    },
    {
      icon: Smile,
      title: 'ابتسامة مثالية',
      description: 'نصمم ابتسامتك المثالية بدقة واحترافية تناسب ملامح وجهك',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <section className="relative py-24 px-6">
      <div
        ref={ref}
        className={`mx-auto max-w-6xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`mb-5 inline-flex rounded-2xl border border-white/10 bg-white/5 p-4 ${feature.iconColor}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="text-sm leading-7 text-slate-400">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Counter / Stats ── */
function CounterSection({ stats }) {
  const [ref, inView] = useInView();

  const patients = useCountUp(stats.patients > 0 ? stats.patients : 1000, 2000, inView);
  const appointments = useCountUp(stats.appointments > 0 ? stats.appointments : 500, 2000, inView);
  const doctorsCount = useCountUp(stats.doctors > 0 ? stats.doctors : 5, 1500, inView);

  const counters = [
    { value: patients, suffix: '+', label: 'مراجع راضي', icon: Smile },
    { value: appointments, suffix: '+', label: 'موعد مكتمل', icon: Clock },
    { value: doctorsCount, suffix: '', label: 'طبيب متخصص', icon: Stethoscope },
    { value: 24, suffix: '/7', label: 'دعم متواصل', icon: MessageCircle },
  ];

  return (
    <section className="relative py-20 px-6">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-600/5 via-cyan-600/5 to-sky-600/5" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-5xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {counters.map((counter, i) => {
            const Icon = counter.icon;
            return (
              <div
                key={counter.label}
                className="text-center"
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="mx-auto mb-4 inline-flex rounded-2xl bg-sky-500/10 p-4 text-sky-400">
                  <Icon className="h-7 w-7" />
                </div>
                <p className="text-3xl font-black text-white sm:text-4xl">
                  {counter.value}{counter.suffix}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-400">{counter.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Services ── */
function ServicesSection({ services, loading, whatsappLink }) {
  const [ref, inView] = useInView();

  const ACCENT_CLASSES = [
    { border: 'hover:border-sky-500/30', iconBg: 'bg-sky-500/10', iconColor: 'text-sky-400', priceBg: 'bg-sky-500/10', priceColor: 'text-sky-300' },
    { border: 'hover:border-emerald-500/30', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', priceBg: 'bg-emerald-500/10', priceColor: 'text-emerald-300' },
    { border: 'hover:border-violet-500/30', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-400', priceBg: 'bg-violet-500/10', priceColor: 'text-violet-300' },
    { border: 'hover:border-amber-500/30', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400', priceBg: 'bg-amber-500/10', priceColor: 'text-amber-300' },
    { border: 'hover:border-rose-500/30', iconBg: 'bg-rose-500/10', iconColor: 'text-rose-400', priceBg: 'bg-rose-500/10', priceColor: 'text-rose-300' },
    { border: 'hover:border-teal-500/30', iconBg: 'bg-teal-500/10', iconColor: 'text-teal-400', priceBg: 'bg-teal-500/10', priceColor: 'text-teal-300' },
  ];

  return (
    <section id="services" className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-sky-600/5 blur-[150px]" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-6xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300">
            <Star className="h-3.5 w-3.5" />
            خدماتنا المتميزة
          </div>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            خدمات طب الأسنان الشاملة
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-7 text-slate-400">
            نقدم مجموعة شاملة من خدمات طب الأسنان التجميلي والعلاجي بأحدث التقنيات وأعلى جودة
          </p>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-sky-500" />
              <div
                className="absolute inset-2 animate-spin rounded-full border-r-2 border-sky-400 opacity-75"
                style={{ animationDuration: '1.4s' }}
              />
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
            <ToothIcon className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">راح تنضاف الخدمات قريباً</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => {
              const accent = ACCENT_CLASSES[i % ACCENT_CLASSES.length];
              const ServiceIcon = getServiceIcon(service);

              return (
                <div
                  key={service.id}
                  className={`group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-7 backdrop-blur-sm transition-all duration-500 ${accent.border} hover:bg-white/[0.04]`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className={`rounded-2xl p-3.5 ${accent.iconBg} ${accent.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                      <ServiceIcon className="h-7 w-7" />
                    </div>
                    {service.price != null && (
                      <div className={`rounded-xl ${accent.priceBg} px-3 py-1.5 text-sm font-bold ${accent.priceColor}`}>
                        {service.price.toLocaleString()} د.ع
                      </div>
                    )}
                  </div>

                  <h3 className="mb-2 text-lg font-bold text-white">{service.nameAr}</h3>
                  <p className="mb-5 text-sm leading-7 text-slate-400">
                    {service.description || 'خدمة متميزة نقدمها لكم بأعلى جودة وأحدث التقنيات'}
                  </p>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{service.duration} دقيقة</span>
                    </div>
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <span>احجز هسه</span>
                      <ArrowLeft className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Doctors ── */
function DoctorsSection({ doctors }) {
  const [ref, inView] = useInView();

  const COLORS = [
    { bg: 'from-sky-500/20 to-blue-500/20', icon: 'text-sky-400', ring: 'ring-sky-500/20' },
    { bg: 'from-emerald-500/20 to-teal-500/20', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
    { bg: 'from-violet-500/20 to-purple-500/20', icon: 'text-violet-400', ring: 'ring-violet-500/20' },
    { bg: 'from-amber-500/20 to-orange-500/20', icon: 'text-amber-400', ring: 'ring-amber-500/20' },
  ];

  return (
    <section id="doctors" className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/5 blur-[120px]" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-6xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300">
            <Stethoscope className="h-3.5 w-3.5" />
            فريقنا الطبي
          </div>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            أطباؤنا المتخصصين
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-7 text-slate-400">
            فريق طبي متمرس وذو خبرة عالية بخدمتكم
          </p>
        </div>

        <div className={`grid gap-8 ${doctors.length <= 3 ? `md:grid-cols-${doctors.length}` : 'md:grid-cols-3 lg:grid-cols-4'} justify-items-center max-w-4xl mx-auto`}>
          {doctors.map((doctor, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <div
                key={doctor.id}
                className="group w-full max-w-xs overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Doctor image or avatar */}
                <div className="mx-auto mb-6 relative">
                  {doctor.image ? (
                    <div className={`h-28 w-28 mx-auto overflow-hidden rounded-full ring-4 ${color.ring}`}>
                      <img
                        src={doctor.image}
                        alt={doctor.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`h-28 w-28 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br ${color.bg}`}>
                      <User className={`h-14 w-14 ${color.icon}`} />
                    </div>
                  )}
                </div>

                <h3 className="mb-1 text-lg font-bold text-white">{doctor.name}</h3>
                <p className="text-sm text-sky-400 font-medium">{doctor.specialization}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── About ── */
function AboutSection({ clinic, whatsappLink }) {
  const [ref, inView] = useInView();

  return (
    <section id="about" className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-indigo-600/5 blur-[120px]" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-6xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Visual side */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent p-1">
              <div className="rounded-[22px] bg-[#0d1225] overflow-hidden">
                {/* Doctor image */}
                <div className="relative h-64 sm:h-80 overflow-hidden">
                  <img
                    src="/images/doctor.png"
                    alt="د. ابراهيم - طبيب أسنان"
                    className="h-full w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1225] via-transparent to-transparent" />
                </div>

                <div className="space-y-6 p-8 sm:p-10">
                  {[
                    { label: 'طب أسنان تجميلي', progress: 95 },
                    { label: 'زراعة أسنان', progress: 90 },
                    { label: 'تقويم أسنان', progress: 88 },
                    { label: 'علاج عصب', progress: 92 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">{item.label}</span>
                        <span className="text-xs font-bold text-sky-400">{item.progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-sky-400 to-cyan-500 transition-all duration-1000"
                          style={{ width: inView ? `${item.progress}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Smile result floating card */}
            <div className="absolute -bottom-6 -left-6 z-10 hidden lg:block">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1225] shadow-2xl shadow-black/50">
                <img
                  src="/images/smile.png"
                  alt="نتيجة تجميل أسنان"
                  className="h-28 w-40 object-cover"
                />
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-white">ابتسامة مثالية</p>
                  <p className="text-[10px] text-sky-400">نتائج حقيقية</p>
                </div>
              </div>
            </div>
          </div>

          {/* Text side */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300">
              عن العيادة
            </div>
            <h2 className="mb-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
              خبرة وتميّز بعناية أسنانك
            </h2>
            <p className="mb-8 text-base leading-8 text-slate-400">
              {CLINIC_DESCRIPTION}
            </p>

            <div className="mb-10 grid grid-cols-2 gap-4">
              {[
                { label: 'أجهزة متطورة', icon: Sparkles },
                { label: 'فريق متخصص', icon: Shield },
                { label: 'راحة المريض', icon: Smile },
                { label: 'نتائج مضمونة', icon: Star },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
                  >
                    <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-300">{item.label}</span>
                  </div>
                );
              })}
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-8 py-4 font-bold text-white shadow-xl shadow-sky-500/20 transition-all hover:shadow-sky-500/40 hover:brightness-110"
            >
              <MessageCircle className="h-5 w-5" />
              <span>تواصل ويانا هسه</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Contact ── */
function ContactSection({ clinic, whatsappLink }) {
  const [ref, inView] = useInView();

  const contactCards = [
    {
      icon: Phone,
      title: 'خابرنا',
      info: clinic.phone,
      action: `tel:${clinic.phone}`,
      actionLabel: 'خابرنا هسه',
      gradient: 'from-sky-500/20 to-blue-500/20',
      iconColor: 'text-sky-400',
    },
    {
      icon: MessageCircle,
      title: 'واتساب',
      info: clinic.phone,
      action: whatsappLink,
      actionLabel: 'دز رسالة',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      icon: MapPin,
      title: 'العنوان',
      info: clinic.address,
      action: clinic.googleMapsLink,
      actionLabel: 'افتح الخريطة',
      gradient: 'from-violet-500/20 to-purple-500/20',
      iconColor: 'text-violet-400',
    },
  ];

  return (
    <section id="contact" className="relative py-28 px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/5 blur-[150px]" />
      </div>

      <div
        ref={ref}
        className={`relative mx-auto max-w-5xl transition-all duration-1000 ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
      >
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-bold text-sky-300">
            <Phone className="h-3.5 w-3.5" />
            تواصل ويانا
          </div>
          <h2 className="mb-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            إحنا هنا بخدمتك
          </h2>
          <p className="mx-auto max-w-lg text-sm leading-7 text-slate-400">
            لا تتردد تخابرنا بأي وقت. إحنا كلش سعيدين نجاوب على استفساراتك ونحجز موعدك
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {contactCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <a
                key={card.title}
                href={card.action}
                target={card.action.startsWith('http') ? '_blank' : undefined}
                rel={card.action.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-8 text-center backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className={`mx-auto mb-5 inline-flex rounded-2xl border border-white/10 bg-white/5 p-4 ${card.iconColor}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-white">{card.title}</h3>
                  <p className="mb-5 text-sm text-slate-400" dir={card.title === 'العنوان' ? 'rtl' : 'ltr'}>
                    {card.info}
                  </p>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition-all group-hover:bg-white/10 group-hover:text-white">
                    {card.actionLabel}
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer({ clinic }) {
  const workingHours = clinic.workingHours || {};
  const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  return (
    <footer className="border-t border-white/5 bg-[#060a16] px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Col 1: Logo + description */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-600">
                <ToothIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">{clinic.nameAr || clinic.name}</p>
                <p className="text-xs text-slate-500">{CLINIC_SUBTITLE}</p>
              </div>
            </div>
            <p className="text-sm leading-7 text-slate-500">
              {CLINIC_DESCRIPTION.slice(0, 100)}...
            </p>
          </div>

          {/* Col 2: Working Hours */}
          <div>
            <h4 className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
              <Clock className="h-4 w-4 text-sky-400" />
              أوقات العمل
            </h4>
            <div className="space-y-2.5">
              {dayOrder.map((day) => {
                const hours = workingHours[day];
                return (
                  <div key={day} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-400">{DAY_NAMES[day]}</span>
                    {hours ? (
                      <span className="font-mono text-slate-300" dir="ltr">
                        {hours.start} - {hours.end}
                      </span>
                    ) : (
                      <span className="text-rose-400/70">مغلق</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 3: Quick links + contact */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-white">روابط سريعة</h4>
            <div className="space-y-2.5 text-sm">
              <Link to="/privacy-policy" className="block text-slate-500 transition-colors hover:text-slate-300">
                سياسة الخصوصية
              </Link>
              <a href={clinic.googleMapsLink} target="_blank" rel="noopener noreferrer" className="block text-slate-500 transition-colors hover:text-slate-300">
                الموقع على الخريطة
              </a>
              <a href={`tel:${clinic.phone}`} className="block text-slate-500 transition-colors hover:text-slate-300" dir="ltr">
                {clinic.phone}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} {clinic.nameAr || clinic.name} {CLINIC_SUBTITLE}. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}

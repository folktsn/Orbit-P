"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight, Building2, BriefcaseBusiness, Check, CirclePlus, Compass, GraduationCap, Pause, Plane, Play, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useDisplayPreferences } from "@/components/DisplayPreferencesProvider";
import { useDashboardSummary, type SummaryResult } from "./components/useDashboardSummary";
import { SandTransitionImage } from "./components/SandTransitionImage";
import { ThailandStationMap } from "./components/ThailandStationMap";
import { DashboardDate } from "./components/DashboardDate";
import styles from "./dashboard.module.css";

const EASE = [0.16, 1, 0.3, 1] as const;
const chapters = [
  { key: "organization", name: "Organization", thai: "โครงสร้างองค์กร", description: "เชื่อมทีม หน่วยงาน และสายการบังคับบัญชาให้เห็นเป็นภาพเดียว", href: "/organization", icon: Building2, image: "/dashboard/organization.webp", alt: "ภาพประกอบหอควบคุมการบินและอาคารสนามบิน" },
  { key: "manpower", name: "Manpower", thai: "วางแผนกำลังคน", description: "ดูจำนวนกำลังคน อัตราที่ได้รับอนุมัติ และความต้องการของแต่ละหน่วยงาน", href: "/manpower", icon: Compass, image: "/dashboard/manpower.webp", alt: "ภาพประกอบเครื่องบินและการจัดวางรถบริการบนลานจอด" },
  { key: "employees", name: "Our people", thai: "ข้อมูลพนักงาน", description: "ดูแลข้อมูลและเส้นทางการทำงานของคนที่อยู่เบื้องหลังทุกเที่ยวบิน", href: "/employees", icon: Users, image: "/dashboard/employees.webp", alt: "ภาพประกอบทีมเจ้าหน้าที่ภาคพื้นเดินร่วมกันบนลานจอดเครื่องบิน" },
  { key: "recruitment", name: "Recruitment", thai: "การสรรหาบุคลากร", description: "ติดตามผู้สมัคร ตั้งแต่วันแรกที่รู้จัก จนถึงวันที่ได้เป็นส่วนหนึ่งของทีม", href: "/ats", icon: BriefcaseBusiness, image: "/dashboard/recruitment.webp", alt: "ภาพประกอบการพูดคุยระหว่างผู้สมัครกับเจ้าหน้าที่สรรหา" },
  { key: "probation", name: "Growth & beyond", thai: "ติดตามการทดลองงาน", description: "ติดตามผลการทำงานและพัฒนาการ เพื่อให้ทุกคนเริ่มต้นได้อย่างมั่นใจ", href: "/probation", icon: GraduationCap, image: "/dashboard/probation.webp", alt: "ภาพประกอบพี่เลี้ยงแนะนำงานให้เจ้าหน้าที่การบินใหม่" },
] as const;

const statusText = { loading: "กำลังโหลดข้อมูล", error: "โหลดไม่สำเร็จ · ลองรีเฟรชอีกครั้ง", restricted: "ยังไม่มีสิทธิ์ดูข้อมูลส่วนนี้", ready: "" };
const number = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString("en-US");

function DataState({ result }: { result: SummaryResult<unknown> }) {
  return <p className={styles.dataState} role={result.status === "error" ? "status" : undefined}>{statusText[result.status]}</p>;
}

export default function Dashboard() {
  const { canPage } = useAuth();
  const { preferences } = useDisplayPreferences();
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = preferences.reduceMotion || Boolean(systemReducedMotion);
  const summary = useDashboardSummary(canPage("manpower"), canPage("recruitment"), canPage("probation"));
  const [activeChapter, setActiveChapter] = useState(2);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [heroVisible, setHeroVisible] = useState(false);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const collectionRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const collectionVisible = useInView(collectionRef, { amount: 0.25 });
  const chapter = chapters[activeChapter];
  const cycling = autoPlay && !hovered && !focused && !reducedMotion && pageVisible && collectionVisible;
  const reveal = { initial: reducedMotion ? false as const : { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 }, transition: { duration: 0.8, ease: EASE } };

  useEffect(() => {
    const timeout = window.setTimeout(() => setHeroVisible(true), 2800);
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => { window.clearTimeout(timeout); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  useEffect(() => {
    if (!cycling) return;
    const interval = window.setInterval(() => setActiveChapter((current) => (current + 1) % chapters.length), 3500);
    return () => window.clearInterval(interval);
  }, [cycling]);

  const selectChapter = (index: number) => { setActiveChapter(index); setAutoPlay(false); };
  const handleChapterKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % chapters.length
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index + chapters.length - 1) % chapters.length
      : event.key === "Home" ? 0 : event.key === "End" ? chapters.length - 1 : null;
    if (target === null) return;
    event.preventDefault();
    selectChapter(target);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  };
  const scrollToOverview = () => document.getElementById("workforce-overview")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
  const workforce = summary.workforce.data;
  const recruitment = summary.recruitment.data;
  const firstLink = chapters.find((item) => canPage(item.key));
  const metrics = [
    { label: "กำลังคนปัจจุบัน", english: "CURRENT HEADCOUNT", value: workforce?.total, result: summary.workforce, note: "ตามขอบเขตหน้า Manpower", href: "/manpower" },
    { label: "ผู้สมัครในระบบ", english: "CANDIDATE PIPELINE", value: recruitment?.total, result: summary.recruitment, note: "รวมทุกสถานะการสรรหา", href: "/ats" },
    { label: "อยู่ระหว่างสัมภาษณ์", english: "IN INTERVIEW", value: recruitment?.stages.find((stage) => stage.label === "สัมภาษณ์")?.count, result: summary.recruitment, note: "ผู้สมัครสถานะสัมภาษณ์", href: "/ats" },
    { label: "อยู่ระหว่างทดลองงาน", english: "PEOPLE IN PROBATION", value: summary.probation.data, result: summary.probation, note: "พนักงานทดลองงานที่ยังปฏิบัติงาน", href: "/probation" },
  ];

  return (
    <div className={styles.page} data-reduced-motion={reducedMotion}>
      <section className={styles.hero} aria-labelledby="dashboard-heading">
        <h1 id="dashboard-heading" className={styles.wordmark} aria-label="OrbitHire — People workspace">
          {"ORBIT HIRE".split("").map((letter, index) => <span key={index} className={letter === " " ? styles.wordSpace : styles.letterClip} aria-hidden="true">
            <motion.span initial={reducedMotion ? false : { y: "115%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.2, delay: index * 0.06, ease: EASE }}>{letter === " " ? "\u00a0" : letter}</motion.span>
          </span>)}
        </h1>
        <div className={styles.heroMain}>
          <motion.div className={styles.heroCopy} {...reveal} transition={{ duration: 0.9, delay: reducedMotion ? 0 : 0.45, ease: EASE }}>
            <DashboardDate className={`${styles.sectionIndex} ${styles.currentDate}`} />
            <h2>People.<br />Possibility.<br /><span>In motion.</span></h2>
            <p>ทุกความเป็นไปได้ เริ่มต้นที่คน<br />เชื่อมการสรรหา กำลังคน และการเติบโต<br />ให้พร้อมสำหรับเที่ยวบินต่อไป</p>
            <button className={styles.primaryButton} onClick={scrollToOverview}><Plane size={18} /><span>ดูภาพรวมกำลังคน</span><ArrowUpRight size={18} /></button>
          </motion.div>
          <motion.div className={styles.heroMap} initial={false} animate={{ opacity: heroVisible || reducedMotion ? 1 : 0, y: heroVisible || reducedMotion ? 0 : 35 }} transition={{ duration: reducedMotion ? 0 : 1.4, ease: EASE }}>
            <ThailandStationMap paused={ambientPaused || reducedMotion || !pageVisible} />
          </motion.div>
          <motion.aside className={styles.heroAside} {...reveal} transition={{ duration: 0.8, delay: reducedMotion ? 0 : 0.9, ease: EASE }}>
            <Plane size={22} strokeWidth={1} /><span className={styles.mono}>ONE TEAM.<br />EVERY DEPARTURE.</span><p>From the ground<br />to greater heights.</p>
            <dl><div><dt>FOCUS</dt><dd>Our people</dd></div><div><dt>DESTINATION</dt><dd>What&apos;s next</dd></div></dl>
            {firstLink && <Link href={firstLink.href} className={styles.detailLink}><CirclePlus size={28} strokeWidth={1} /><span>เข้าสู่พื้นที่ทำงาน</span></Link>}
          </motion.aside>
        </div>
        <div className={styles.heroBottom}>
          <button onClick={scrollToOverview} className={styles.scrollButton}><span><ArrowDown size={17} strokeWidth={1.2} /></span><span>SCROLL TO EXPLORE</span></button>
          <span className={styles.heroSignature}>BUILT AROUND PEOPLE.</span>
          <button className={styles.motionButton} aria-label={ambientPaused ? "เล่นภาพเคลื่อนไหว" : "พักภาพเคลื่อนไหว"} aria-pressed={ambientPaused} onClick={() => setAmbientPaused((value) => !value)} disabled={reducedMotion}>{ambientPaused || reducedMotion ? <Play size={13} /> : <Pause size={13} />}<span>{ambientPaused || reducedMotion ? "STILL" : "MOTION"}</span></button>
        </div>
      </section>

      <section id="workforce-overview" className={styles.overview} aria-labelledby="overview-heading">
        <motion.div {...reveal} className={styles.overviewIntro}>
          <span className={styles.sectionIndex}>[ 02 ] &nbsp; WORKFORCE AT A GLANCE</span>
          <h2 id="overview-heading">Behind every flight,<br /><span>there is a great team.</span></h2>
          <p>มองเห็นภาพรวม เข้าใจทีม และก้าวต่อไปด้วยกัน</p>
          <div className={styles.pills}>{chapters.filter((item) => canPage(item.key)).map(({ key, icon: Icon, name, href }) => <Link href={href} key={key}><Icon size={14} strokeWidth={1.5} />{name}<ArrowUpRight size={12} /></Link>)}</div>
        </motion.div>
        <motion.div className={styles.summary} {...reveal}>
          <div className={styles.summaryToolbar}><span className={styles.mono}>PEOPLE OVERVIEW <span className={styles.toolbarDetail}>/ ภาพรวมบุคลากร</span></span><button onClick={summary.refresh} disabled={summary.refreshing} className={styles.refreshButton} aria-label="รีเฟรชข้อมูล Dashboard"><RefreshCw size={13} className={summary.refreshing ? styles.spinning : undefined} />{summary.refreshing ? "กำลังโหลด" : "รีเฟรช"}</button></div>
          <div className={styles.metrics}>{metrics.map((metric, index) => <div className={styles.metric} key={metric.english}>
            <div className={styles.metricTop}><span>{String(index + 1).padStart(2, "0")}</span>{metric.result.status !== "restricted" && <Link href={metric.href} aria-label={`ดู${metric.label}`}><ArrowUpRight size={18} strokeWidth={1} /></Link>}</div>
            <span className={styles.metricNumber}>{number(metric.value)}</span><h3>{metric.label}</h3><span className={styles.metricEnglish}>{metric.english}</span>
            {metric.result.status === "ready" ? <p className={styles.metricNote}>{metric.note}</p> : <DataState result={metric.result} />}
          </div>)}</div>
          <div className={styles.insights}>
            <div className={styles.departmentPanel}>
              <div className={styles.panelTitle}><h3>กำลังคนแยกตามหน่วยงาน</h3><span className={styles.mono}>TOP 04 / HEADCOUNT</span></div>
              {summary.workforce.status !== "ready" ? <DataState result={summary.workforce} /> : workforce?.departments.length ? <div className={styles.departments}>{workforce.departments.slice(0, 4).map((department) => <div key={department.departmentCode || department.department}>
                <div className={styles.departmentLabel}><span>{department.department || "ไม่ระบุหน่วยงาน"}</span><b>{number(department.current)}</b></div>
                <div className={styles.barTrack}><motion.div initial={false} animate={{ width: `${workforce.total ? department.current / workforce.total * 100 : 0}%` }} transition={{ duration: reducedMotion ? 0 : 0.9, ease: EASE }} /></div>
              </div>)}</div> : <p className={styles.dataState}>ยังไม่มีข้อมูลกำลังคน</p>}
            </div>
            <div className={styles.pipelinePanel}><div className={styles.panelTitle}><h3>เส้นทางการสรรหา</h3><span className={styles.mono}>RECRUITMENT FLOW</span></div>
              {summary.recruitment.status !== "ready" ? <DataState result={summary.recruitment} /> : <div className={styles.pipeline}>{recruitment?.stages.map((stage, index) => <div key={stage.label}><span>{index === 3 ? <Check size={14} /> : `0${index + 1}`}</span><b>{number(stage.count)}</b><p>{stage.label}</p></div>)}</div>}
            </div>
          </div>
          <p className={styles.updatedAt}>{summary.updatedAt ? `ตรวจสอบข้อมูลล่าสุด ${new Date(summary.updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น. · แสดงเฉพาะข้อมูลที่บัญชีนี้มีสิทธิ์เข้าถึง` : "กำลังเชื่อมต่อข้อมูลภาพรวม"}</p>
        </motion.div>
        <div className={styles.bridgeSpace} aria-hidden="true"><span>PEOPLE MAKE IT POSSIBLE.</span><span>PATTAYA AVIATION © {new Date().getFullYear()}</span></div>
      </section>

      <section ref={collectionRef} className={styles.collection} aria-labelledby="collection-heading">
        <motion.div className={styles.bridgeAircraft} initial={reducedMotion ? false : { y: 50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: "100px" }} transition={{ duration: 1.4, ease: EASE }} aria-hidden="true"><Image src="/dashboard/aircraft.webp" alt="" width={1600} height={800} sizes="(max-width: 760px) 110vw, 75vw" unoptimized /></motion.div>
        <motion.div className={styles.collectionHeading} {...reveal}>
          <div><span className={styles.sectionIndex}>[ 03 ] &nbsp; YOUR PEOPLE WORKSPACE</span><h2 id="collection-heading">Build the team.<br />Shape what&apos;s next. <span className={styles.headingIcons}><Users /><Plane /><Compass /></span></h2></div>
          <div className={styles.collectionTagline}><p>THE PEOPLE BEHIND THE JOURNEY.<br />THE POSSIBILITY AHEAD.</p><div><span>CONNECTED</span><span>HUMAN</span><span>FORWARD</span></div></div>
        </motion.div>
        <div className={styles.chapterLayout} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
          <div id="workspace-chapter-panel" role="tabpanel" aria-labelledby={`chapter-tab-${chapter.key}`} className={styles.chapterVisual}>
            <div className={styles.chapterPhoto}><AnimatePresence mode="wait" initial={false}><SandTransitionImage key={chapter.key} src={chapter.image} alt={chapter.alt} reducedMotion={reducedMotion} /></AnimatePresence><span className={styles.photoMark}>P / A &nbsp; — &nbsp; PEOPLE SERIES</span></div>
            <div className={styles.photoCaption}><div className={styles.chapterCounter}><AnimatePresence mode="wait" initial={false}><motion.span key={activeChapter} initial={reducedMotion ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.18 }}>{String(activeChapter + 1).padStart(2, "0")}</motion.span></AnimatePresence><span>/ 05</span></div><span>AVIATION, THROUGH PEOPLE.</span></div>
            <div className={styles.chapterDescription}><h3>{chapter.thai}</h3><p>{chapter.description}</p>{canPage(chapter.key) ? <Link href={chapter.href}>เปิด{chapter.thai}<ArrowUpRight size={16} /></Link> : <span className={styles.accessNote}>ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ใช้งาน</span>}</div>
          </div>
          <div className={styles.chapterNavigation}>
            <div className={styles.chapterToolbar}><span>FIND YOUR NEXT DESTINATION.</span><button aria-label={autoPlay && !reducedMotion ? "หยุดสลับภาพอัตโนมัติ" : "เล่นสลับภาพอัตโนมัติ"} aria-pressed={autoPlay && !reducedMotion} disabled={reducedMotion} onClick={() => setAutoPlay((value) => !value)}>{autoPlay && !reducedMotion ? <Pause size={12} /> : <Play size={12} />}<span>{autoPlay && !reducedMotion ? "AUTO" : "PAUSED"}</span></button></div>
            <div ref={tabsRef} role="tablist" aria-label="หมวดงานบุคลากร" aria-orientation="vertical" className={styles.chapterList}>{chapters.map((item, index) => <button key={item.key} id={`chapter-tab-${item.key}`} role="tab" aria-selected={activeChapter === index} aria-controls="workspace-chapter-panel" tabIndex={activeChapter === index ? 0 : -1} className={activeChapter === index ? styles.activeChapter : undefined} onClick={() => selectChapter(index)} onKeyDown={(event) => handleChapterKeys(event, index)}><span className={styles.chapterNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.chapterName}>{item.name}<small>{item.thai}</small></span><ArrowUpRight size={28} strokeWidth={1} className={styles.chapterArrow} /></button>)}</div>
            <div className={styles.chapterFooter}><span>05 CHAPTERS. ONE CONNECTED WORKSPACE.</span><span className={styles.chapterProgress} style={{ width: `${(activeChapter + 1) / chapters.length * 100}%` }} /></div>
          </div>
        </div>
        <footer className={styles.footer}><span>BETTER TOGETHER. FURTHER AHEAD.</span><a href="#dashboard-heading" onClick={(event) => { event.preventDefault(); document.getElementById("dashboard-heading")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" }); }}>BACK TO TOP <ArrowUpRight size={13} /></a><span>ORBITHIRE © {new Date().getFullYear()}</span></footer>
      </section>
    </div>
  );
}

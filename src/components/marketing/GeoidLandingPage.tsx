"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./GeoidLandingPage.module.css";

const stats = [
  { value: "1", suffix: " km", label: "buffer zone surveillance along riverbanks" },
  { value: "Weekly", label: "satellite revisit and anomaly alerts" },
  { value: "0.5", suffix: " m", label: "high-res verification for flagged sites" },
  { value: "cm-level", label: "LiDAR Z-accuracy for tamper-proof evidence" },
];

const solutionCards = [
  {
    title: "Continuous basin surveillance",
    body:
      "Weekly multispectral satellite sweeps flag anomalies across entire river stretches, not just lease boundaries, so unauthorized activity is detected at the source.",
  },
  {
    title: "Rapid verification and volumetrics",
    body:
      "0.5 m satellite imagery confirms flagged sites; drone photogrammetry computes extracted volume and compares it against permitted limits to quantify violations.",
  },
  {
    title: "Evidence-ready enforcement",
    body:
      "cm-level LiDAR audits provide tamper-proof, courtroom-grade depth proof. Every alert is traceable end-to-end: satellite -> drone -> LiDAR -> penalty.",
  },
];

const gaps = [
  "Unauthorized extraction outside lease boundary",
  "Unreported volumes and royalty leakage",
  "Rapid riverbank damage and habitat loss",
  "Weak linkage between permits and on-ground extraction",
];

const workflow = [
  {
    label: "Level 1 - Alert layer",
    title: "Regional surveillance (weekly)",
    body:
      'Satellite indices flag "green / minor variance / high-probability anomaly" zones and detect new access tracks and turbidity.',
  },
  {
    label: "Level 2 - Slider check",
    title: "High-resolution verification (0.5 m)",
    body:
      "Confirm suspected excavation and stockpiles with targeted high-res imagery before deploying field assets.",
  },
  {
    label: "Level 3 - Volumetrics",
    title: "Drone photogrammetry",
    body:
      "Compute extracted volume and compare with permitted limits to quantify violations.",
  },
  {
    label: "Level 4 - Forensic evidence",
    title: "LiDAR audit",
    body:
      'Centimeter-level "bare earth" models provide tamper-proof depth proof, even through vegetation, for legal enforcement.',
  },
];

const modules = [
  {
    title: "Integration with i4MS",
    body: 'A "digital handshake" between transport permitting and source monitoring.',
    bullets: [
      "Link ANPR / weighbridge / e-pass to lease bookings",
      "Instant alerts when extraction is detected outside a valid lease",
      "Single command view: gate events plus river events",
    ],
  },
  {
    title: "3D GIS command center",
    body: "Real-time dashboard for hotspots, variance, and action queues.",
    bullets: [
      "Basin-wide hotspot map and drilldown views",
      "Penalty review workflow with evidence context",
      "Shared operations view for district teams",
    ],
    showcase: true,
  },
  {
    title: "Scientific replenishment",
    body: "Pre-monsoon vs post-monsoon surveys plus replenishment modelling for sustainable extraction limits.",
    bullets: [
      "Seasonal DEM-of-difference replenishment assessment",
      "Sediment transport capacity models",
      'Evidence-based "safe extraction" thresholds',
    ],
  },
  {
    title: "Open data and self-certification",
    body: "Transparency that improves compliance and reduces disputes.",
    bullets: [
      "Public map of valid lease boundaries vs illegal zones",
      "License-holder dashboards for quota usage and compliance",
      "Community anomaly reporting for rapid verification",
    ],
  },
  {
    title: "Evidence pack and penalty automation",
    body: "Automate recovery with standardized, defensible proof.",
    bullets: [
      "Digital evidence pack from satellite, drone, and LiDAR sources",
      "Graded penalty matrix based on extraction and damage",
      "End-to-end traceable audit trail",
    ],
  },
  {
    title: "Off-lease detection",
    body: "Extend monitoring beyond the ghat to detect hidden activity.",
    bullets: [
      "Unleased access roads and stockpiles",
      "Bankline changes and new pits",
      'Automated "alert -> verify -> act" workflow',
    ],
  },
];

const phases = [
  {
    phase: "Phase 1",
    months: "Months 1-3",
    title: "Pilot and calibration",
    body:
      "Deploy a pilot in priority basin stretches, validate DSR, calibrate satellite alerts, and establish volumetric baselines.",
  },
  {
    phase: "Phase 2",
    months: "Months 4-9",
    title: "District rollout",
    body:
      "Scale drone teams, integrate collectorate workflows, and operationalize evidence-pack generation and penalties.",
  },
  {
    phase: "Phase 3",
    months: "Months 10+",
    title: "Statewide command center",
    body:
      "Full API link with i4MS, statewide dashboard, automated compliance reporting, and continuous replenishment monitoring.",
  },
];

const faqs = [
  {
    q: "Does this replace existing checkpost / i4MS systems?",
    a: "No. It complements them by adding source monitoring and linking extraction evidence to the permit and transport chain.",
  },
  {
    q: "How do you keep operational costs under control?",
    a: "The funnel approach uses basin-wide satellite screening first and escalates only high-probability targets to high-res imagery, drones, and LiDAR.",
  },
  {
    q: "What data do you need from us to start a pilot?",
    a: "Lease KML/KMZ files, a sample DSR/SoI sheet, district boundaries, and any historical drone or survey data you already have.",
  },
  {
    q: "Is the evidence admissible in court?",
    a: "Yes. The evidence pack includes a chain-of-custody trail, signed orthophotos, LiDAR depth models, and timestamped satellite reports.",
  },
];

type FormState = "idle" | "sent";

export default function GeoidLandingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [formState, setFormState] = useState<FormState>("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameId = 0;
    let width = 0;
    let height = 0;
    const particles = Array.from({ length: 22 }, (_, index) => {
      const warm = index / 22 >= 0.6;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 1 + Math.random() * 1.5,
        opacity: warm ? 0.06 + Math.random() * 0.12 : 0.08 + Math.random() * 0.28,
        vy: -(0.12 + Math.random() * 0.3),
        vx: (Math.random() - 0.5) * 0.18,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.006 + Math.random() * 0.01,
        warm,
      };
    });

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.pulse += particle.pulseSpeed;
        const flicker = 0.7 + 0.3 * Math.sin(particle.pulse);

        if (particle.y < -10) {
          particle.y = height + 10;
          particle.x = Math.random() * width;
        }
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = particle.warm
          ? `rgba(194, 112, 62, ${particle.opacity * flicker})`
          : `rgba(255, 255, 255, ${particle.opacity * flicker})`;
        ctx.fill();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const floaters = Array.from(hero.querySelectorAll<HTMLElement>("[data-depth]"));

    const handleMove = (event: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const cx = (event.clientX - rect.left) / rect.width - 0.5;
      const cy = (event.clientY - rect.top) / rect.height - 0.5;

      for (const floater of floaters) {
        const depth = Number(floater.dataset.depth ?? "1");
        floater.style.transform = `translate(${cx * depth * 12}px, ${cy * depth * 8}px)`;
      }
    };

    hero.addEventListener("mousemove", handleMove);
    return () => hero.removeEventListener("mousemove", handleMove);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onScroll = () => {
      nav.dataset.scrolled = window.scrollY > 60 ? "true" : "false";
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (revealEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay ?? "0");
          window.setTimeout(() => el.dataset.revealed = "true", delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    for (const el of revealEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const statEls = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    if (statEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const finalValue = el.dataset.count;
          if (!finalValue || !/^\d+(\.\d+)?$/.test(finalValue)) {
            observer.unobserve(el);
            continue;
          }
          const target = Number(finalValue);
          const isFloat = finalValue.includes(".");
          const prefix = el.dataset.prefix ?? "";
          const suffix = el.dataset.suffix ?? "";
          const start = performance.now();

          const tick = (now: number) => {
            const progress = Math.min((now - start) / 1200, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            el.textContent = `${prefix}${isFloat ? current.toFixed(1) : Math.round(current)}${suffix}`;
            if (progress < 1) {
              window.requestAnimationFrame(tick);
            }
          };

          window.requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );

    for (const el of statEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]"));
    if (links.length === 0 || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.getAttribute("id");
          for (const link of links) {
            link.dataset.active = link.getAttribute("href") === `#${id}` ? "true" : "false";
          }
        }
      },
      { threshold: 0.3, rootMargin: "-80px 0px -50% 0px" },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.grain} />
      <canvas ref={canvasRef} className={styles.particleCanvas} />

      <header ref={navRef} className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <div className={styles.brandLogo}>
              <Image
                src="/geoid-logo-cropped.png"
                alt="Geoid Resources logo"
                fill
                sizes="168px"
                className={`${styles.brandLogoImage}`}
                priority
              />
            </div>
          </div>
          <nav className={styles.navLinks}>
            <a href="#solution" data-nav-link data-active="true">Solution</a>
            <a href="#how" data-nav-link>How it works</a>
            <a href="#modules" data-nav-link>Modules</a>
            <a href="#roadmap" data-nav-link>Roadmap</a>
            <a href="#contact" className={styles.navCta}>Contact</a>
          </nav>
        </div>
      </header>

      <main>
        <section ref={heroRef} className={styles.hero}>
          <div className={`${styles.bloom} ${styles.bloomHero}`} />
          <div className={styles.heroVignetteTop} />
          <div className={styles.heroVignetteBottom} />
          <div className={styles.watermark} aria-hidden="true">GEOID</div>

          <FloaterDrone className={`${styles.floater} ${styles.floaterDrone}`} />
          <FloaterSatellite className={`${styles.floater} ${styles.floaterSatellite}`} />
          <FloaterRiver className={`${styles.floater} ${styles.floaterRiver}`} />
          <FloaterGrid className={`${styles.floater} ${styles.floaterGrid}`} />
          <FloaterHex className={`${styles.floater} ${styles.floaterHex}`} />
          <FloaterTri className={`${styles.floater} ${styles.floaterTri}`} />
          <FloaterCirc className={`${styles.floater} ${styles.floaterCirc}`} />
          <FloaterDia className={`${styles.floater} ${styles.floaterDia}`} />

          <span className={`${styles.pill} ${styles.heroStagger}`}>
            <span className={styles.dot} />
            Odisha River Sand Monitoring - GIS and AI Enforcement Framework
          </span>
          <h1 className={`${styles.heroTitle} ${styles.heroStagger}`}>
            Move from Gate Monitoring to Source Monitoring.
          </h1>
          <p className={`${styles.heroLede} ${styles.heroStagger}`}>
            Detect, verify, and prove illegal riverbed sand extraction at basin scale using a layered workflow:
            {" "}weekly satellite alerts {"->"} 0.5 m verification {"->"} drone volumetrics {"->"} LiDAR forensic audits.
          </p>
          <div className={`${styles.ctaRow} ${styles.heroStagger}`}>
            <a href="#contact" className={`${styles.button} ${styles.primaryButton}`}>Request a demo</a>
            <a
              href="/proposals/Odisha_Sand_Source_Digital_Enforcement.pdf"
              download
              className={`${styles.button} ${styles.ghostButton}`}
            >
              Download Proposal PDF
            </a>
            <a href="#roadmap" className={`${styles.button} ${styles.ghostButton}`}>Explore rollout plan</a>
          </div>
          <div className={`${styles.stats} ${styles.heroStagger}`}>
            {stats.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <div
                  className={styles.statNumber}
                  {...(stat.value.match(/^\d+(\.\d+)?$/) ? { "data-count": stat.value } : {})}
                  {...(stat.suffix ? { "data-suffix": stat.suffix } : {})}
                >
                  {stat.value.match(/^\d+(\.\d+)?$/) ? "0" : stat.value}
                </div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.scrollIndicator}>
            <span>Scroll to explore</span>
            <span className={styles.scrollArrow}>↓</span>
          </div>
        </section>

        <SectionDivider />

        <section id="solution" className={styles.section}>
          <div className={styles.container}>
            <h2 data-reveal>A basin watchdog for enforcement, revenue protection, and scientific replenishment</h2>
            <p className={styles.lede} data-reveal data-reveal-delay="100">
              Traditional approaches focus on transport gates and weighbridges. This framework adds basin-wide
              source monitoring to detect extraction at the river itself, then escalates only the highest-probability
              targets to expensive ground assets.
            </p>
            <div className={styles.cards3}>
              {solutionCards.map((card, index) => (
                <article key={card.title} className={styles.card} data-reveal data-reveal-delay={String(index * 120)}>
                  <div className={styles.cardIcon}><IconRadar /></div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.twoCol}>
              <div>
                <h2 data-reveal>The operational gap</h2>
                <p className={styles.lede} data-reveal data-reveal-delay="100">
                  Cameras see the road, not the river. Illegal excavation often happens outside lease areas, hidden by
                  bends, vegetation, or temporary access roads. Without source monitoring, enforcement becomes reactive
                  and disputable.
                </p>
                <ul className={styles.checks} data-reveal data-reveal-delay="200">
                  {gaps.map((gap) => (
                    <li key={gap}>
                      <span className={styles.checkIcon}><IconCheck /></span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
              <div data-reveal data-reveal-delay="200">
                <div className={styles.imageCard}>
                  <div className={`${styles.imageFrame} ${styles.lightMediaFrame}`}>
                    <Image
                      src="/assets/marketing/funnel-methodology.png"
                      alt="Funnel methodology showing the four-level escalation from satellite surveillance to LiDAR forensic enforcement."
                      fill
                      sizes="(max-width: 980px) 100vw, 520px"
                      className={styles.mediaImage}
                    />
                  </div>
                  <div className={styles.caption}>
                    The funnel methodology focuses expensive assets only after satellite confirmation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section id="how" className={styles.section}>
          <div className={styles.container}>
            <h2 data-reveal>How it works: a 4-level escalation workflow</h2>
            <p className={styles.lede} data-reveal data-reveal-delay="100">
              A cost-efficient method that moves from wide coverage to courtroom-grade proof.
            </p>
            <div className={styles.levelsWrapper}>
              <div className={styles.levelsLine} />
              <div className={styles.levels}>
                {workflow.map((item, index) => (
                  <article key={item.title} className={styles.level} data-reveal data-reveal-delay={String(index * 120)}>
                    <div className={styles.levelDot} />
                    <div className={styles.levelLabel}>{item.label}</div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section id="modules" className={styles.section}>
          <div className={styles.container}>
            <h2 data-reveal>Platform modules</h2>
            <p className={styles.lede} data-reveal data-reveal-delay="100">
              Deploy as a pilot cluster and scale statewide through phased rollouts.
            </p>
            <div className={styles.cards2}>
              {modules.map((module, index) => (
                <article key={module.title} className={styles.module} data-reveal data-reveal-delay={String((index % 2) * 120)}>
                  <h3>{module.title}</h3>
                  <p className={styles.moduleBody}>{module.body}</p>
                  <ul className={styles.moduleBullets}>
                    {module.bullets.map((bullet) => (
                      <li key={bullet}>
                        <span className={styles.checkIcon}><IconCheck /></span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  {module.showcase ? (
                    <div className={`${styles.dashboardFrame} ${styles.dashboardShowcase}`}>
                      <Image
                        src="/assets/marketing/command-center.png"
                        alt="Command center dashboard showing a 3D GIS ghat monitoring view with penalty review workflow."
                        fill
                        sizes="(max-width: 980px) 100vw, 560px"
                        className={styles.mediaImage}
                      />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section id="roadmap" className={styles.section}>
          <div className={styles.container}>
            <h2 data-reveal>Implementation roadmap</h2>
            <p className={styles.lede} data-reveal data-reveal-delay="100">
              Start with a pilot cluster, then expand district-wide and statewide.
            </p>
            <div className={styles.phases}>
              {phases.map((phase, index) => (
                <article key={phase.phase} className={styles.phase} data-reveal data-reveal-delay={String(index * 120)}>
                  <div className={styles.phaseTop}>
                    <span className={styles.phaseTag}>{phase.phase}</span>
                    <span className={styles.phaseMonths}>{phase.months}</span>
                  </div>
                  <h3>{phase.title}</h3>
                  <p>{phase.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section className={styles.section}>
          <div className={styles.container}>
            <h2 data-reveal>FAQ</h2>
            <div className={styles.faqList} data-reveal data-reveal-delay="100">
              {faqs.map((faq, index) => (
                <details key={faq.q} className={styles.faq} open={index === 0}>
                  <summary>
                    {faq.q}
                    <span className={styles.chevron}>⌄</span>
                  </summary>
                  <div className={styles.faqBody}>{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        <section id="contact" className={`${styles.section} ${styles.contactSection}`}>
          <div className={`${styles.bloom} ${styles.bloomFooter}`} />
          <div className={styles.container}>
            <div className={styles.contactGrid}>
              <div data-reveal>
                <h2 className={styles.contactHeading}>Talk to Geoid Resources</h2>
                <p className={styles.contactLede}>
                  Share your basin, current monitoring setup, and enforcement challenges. We&apos;ll respond with a
                  pilot plan, dataset requirements, and an implementation schedule.
                </p>
                <div className={styles.uploadNote}>
                  <p>Want a faster start?</p>
                  <span>Upload your lease KML/KMZ plus a sample DSR/SoI to accelerate pilot design.</span>
                </div>
              </div>
              <form
                className={styles.formCard}
                data-reveal
                data-reveal-delay="150"
                onSubmit={(event) => {
                  event.preventDefault();
                  setFormState("sent");
                }}
              >
                <label className={styles.field}>
                  <span>Name</span>
                  <input type="text" name="name" />
                </label>
                <label className={styles.field}>
                  <span>Email</span>
                  <input type="email" name="email" />
                </label>
                <label className={styles.field}>
                  <span>Organization</span>
                  <input type="text" name="org" />
                </label>
                <label className={styles.field}>
                  <span>Message</span>
                  <textarea
                    name="message"
                    placeholder="Tell us your river basin, districts, and monitoring goals..."
                  />
                </label>
                <button className={`${styles.button} ${styles.primaryButton}`} type="submit">
                  {formState === "sent" ? "Sent - we will be in touch." : "Send enquiry"}
                </button>
                <p className={styles.formTip}>
                  Tip: connect this form to your backend API or form handler once you are ready.
                </p>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <Image
                src="/geoid-logo-cropped.png"
                alt="Geoid Resources logo"
                fill
                sizes="220px"
                className={styles.footerLogoImage}
              />
            </div>
            <div className={styles.footerMeta}>
              <span>Geoid Resources</span>
              <span>CAD, GIS and General Mine Planning Solutions</span>
              <span>© 2026 Geoid Resources. All rights reserved.</span>
            </div>
          </div>
          <nav className={styles.footerLinks}>
            <a href="#solution">Solution</a>
            <a href="#how">How it works</a>
            <a href="#modules">Modules</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionDivider() {
  return (
    <div className={styles.diamondDivider}>
      <div className={styles.diamond} />
    </div>
  );
}

function IconRadar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 6 3 3 5-6" />
    </svg>
  );
}

function FloaterDrone({ className }: { className: string }) {
  return (
    <svg className={className} data-depth="2" viewBox="0 0 140 140" fill="none" stroke="currentColor" strokeWidth="0.7">
      <rect x="40" y="55" width="60" height="30" rx="4" />
      <line x1="35" y1="70" x2="15" y2="50" />
      <line x1="105" y1="70" x2="125" y2="50" />
      <circle cx="15" cy="48" r="8" />
      <circle cx="125" cy="48" r="8" />
      <line x1="35" y1="70" x2="15" y2="90" />
      <line x1="105" y1="70" x2="125" y2="90" />
      <circle cx="15" cy="92" r="8" />
      <circle cx="125" cy="92" r="8" />
      <circle cx="70" cy="75" r="4" />
    </svg>
  );
}

function FloaterSatellite({ className }: { className: string }) {
  return (
    <svg className={className} data-depth="3" viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="0.7">
      <rect x="55" y="50" width="50" height="60" rx="3" />
      <rect x="20" y="60" width="30" height="40" rx="1" />
      <rect x="110" y="60" width="30" height="40" rx="1" />
      <line x1="50" y1="70" x2="20" y2="70" />
      <line x1="110" y1="70" x2="140" y2="70" />
      <circle cx="80" cy="80" r="8" />
      <line x1="80" y1="110" x2="80" y2="130" />
      <circle cx="80" cy="133" r="3" />
    </svg>
  );
}

function FloaterRiver({ className }: { className: string }) {
  return (
    <svg className={className} data-depth="1.5" viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="0.7">
      <path d="M10 60Q40 30 70 55T130 45T190 60" />
      <path d="M10 75Q40 45 70 70T130 60T190 75" />
      <path d="M10 90Q40 60 70 85T130 75T190 90" />
    </svg>
  );
}

function FloaterGrid({ className }: { className: string }) {
  return (
    <svg className={className} data-depth="2.5" viewBox="0 0 130 130" fill="none" stroke="currentColor" strokeWidth="0.5">
      <rect x="10" y="10" width="110" height="110" />
      <line x1="10" y1="65" x2="120" y2="65" />
      <line x1="65" y1="10" x2="65" y2="120" />
      <line x1="10" y1="37" x2="120" y2="37" />
      <line x1="10" y1="93" x2="120" y2="93" />
      <line x1="37" y1="10" x2="37" y2="120" />
      <line x1="93" y1="10" x2="93" y2="120" />
      <circle cx="65" cy="65" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FloaterHex({ className }: { className: string }) {
  return <svg className={className} data-depth="1.8" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="0.6"><polygon points="30,5 55,17.5 55,42.5 30,55 5,42.5 5,17.5" /></svg>;
}

function FloaterTri({ className }: { className: string }) {
  return <svg className={className} data-depth="2.2" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="0.6"><polygon points="25,5 47,43 3,43" /></svg>;
}

function FloaterCirc({ className }: { className: string }) {
  return <svg className={className} data-depth="1.6" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="0.6"><circle cx="22" cy="22" r="18" /><circle cx="22" cy="22" r="6" /></svg>;
}

function FloaterDia({ className }: { className: string }) {
  return <svg className={className} data-depth="2.8" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="0.6"><polygon points="20,2 38,20 20,38 2,20" /></svg>;
}

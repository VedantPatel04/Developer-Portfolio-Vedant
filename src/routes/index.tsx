import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GrainField } from "@/components/GrainField";
import { RetroTerminal } from "@/components/RetroTerminal";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

function useClock() {
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

/** Progress (0-1) of the viewport through a scroll track element. */
function useTrackProgress(ref: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, el.offsetHeight - window.innerHeight);
      setProgress(clamp((window.scrollY - top) / distance));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref]);
  return progress;
}

function useInViewReveal() {
  useEffect(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>(".project-cell:has(.slide-ready)"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const tile = entry.target.querySelector(".slide-ready");
          tile?.classList.add("is-inview");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15 },
    );
    cells.forEach((cell) => io.observe(cell));
    return () => io.disconnect();
  }, []);
}

function smoothScrollTo(hash: string) {
  const el = document.querySelector(hash);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CursorFollower() {
  const followerRef = useRef<HTMLDivElement | null>(null);
  const target = useRef({ x: -100, y: -100 });
  const hidden = useRef(true);
  const raf = useRef(0);
  const points = useRef(Array.from({ length: 10 }, () => ({ x: -100, y: -100 })));
  const lastTime = useRef(0);

  useEffect(() => {
    const follower = followerRef.current;
    if (!follower) return;

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || prefersReducedMotion) {
      follower.setAttribute("data-hidden", "true");
      return;
    }

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      if (hidden.current) {
        hidden.current = false;
        follower.setAttribute("data-hidden", "false");
        points.current.forEach((point) => {
          point.x = e.clientX;
          point.y = e.clientY;
        });
      }
    };

    const onLeave = () => {
      hidden.current = true;
      follower.setAttribute("data-hidden", "true");
    };

    const onEnter = () => {
      hidden.current = false;
      follower.setAttribute("data-hidden", "false");
    };

    const onOver = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const isHoverable =
        targetEl?.closest("a, button, [role='button'], input, textarea, select") != null;
      follower.setAttribute("data-hover", String(isHoverable));
    };

    const tick = (timestamp: number) => {
      const delta = lastTime.current ? Math.min(timestamp - lastTime.current, 32) : 16.67;
      lastTime.current = timestamp;
      const nodes = follower.querySelectorAll<HTMLElement>(".cursor-node");
      const frameScale = delta / 16.67;
      const headEase = 1 - Math.pow(1 - 0.34, frameScale);
      const head = points.current[0];
      if (!head) return;
      head.x += (target.current.x - head.x) * headEase;
      head.y += (target.current.y - head.y) * headEase;

      for (let index = 1; index < points.current.length; index += 1) {
        const point = points.current[index];
        const leader = points.current[index - 1];
        if (!point || !leader) continue;
        const followEase = 1 - Math.pow(1 - (0.36 - index * 0.012), frameScale);
        point.x += (leader.x - point.x) * followEase;
        point.y += (leader.y - point.y) * followEase;
      }

      const hoverScale = follower.dataset["hover"] === "true" ? 1.18 : 1;
      nodes.forEach((node, index) => {
        const point = points.current[index];
        if (!point) return;
        node.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) scale(${index === 0 ? hoverScale : 1})`;
      });
      raf.current = requestAnimationFrame(tick);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseover", onOver, { passive: true });
    raf.current = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseover", onOver);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div ref={followerRef} className="cursor-follower" data-hidden="true" aria-hidden="true">
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={`cursor-node ${index === 0 ? "cursor-head" : "cursor-trail"}`}
          style={{ ["--trail-index" as string]: index }}
        />
      ))}
    </div>
  );
}

function Header() {
  const time = useClock();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background/85 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
        <a
          href="#top"
          className="label-mono font-medium tracking-[-0.03em]"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Vedant Patel
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
              onClick={
                item.external
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      smoothScrollTo(item.href);
                    }
              }
              className="label-mono font-medium text-foreground/75 transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="label-mono flex items-center gap-2 text-muted-foreground">
          <span className="hidden sm:inline">Los Angeles, CA</span>
          <span>{time}</span>
          <span className="status-dot" aria-hidden />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="label-mono font-medium md:hidden"
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div
        className="overflow-hidden border-border transition-[max-height] duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] md:hidden"
        style={{ maxHeight: open ? 320 : 0 }}
      >
        <nav className="flex flex-col gap-1 border-t border-border px-5 pb-5 pt-3">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
              onClick={(e) => {
                if (!item.external) {
                  e.preventDefault();
                  smoothScrollTo(item.href);
                }
                setOpen(false);
              }}
              className="py-2 text-2xl font-bold tracking-[-0.04em]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Index() {
  const heroTrack = useRef<HTMLDivElement>(null);
  const projectsTrack = useRef<HTMLDivElement>(null);
  const heroProgress = useTrackProgress(heroTrack);
  const projectsProgress = useTrackProgress(projectsTrack);
  useInViewReveal();

  // Hero image shrinks to 48%, About panel slides in during the last 40%.
  const imageWidth = 100 - 52 * clamp(heroProgress / 0.75);
  const panelProgress = clamp((heroProgress - 0.45) / 0.4);
  const projectsReveal = smoothstep(projectsProgress);
  const projectsTitleOpacity =
    projectsReveal < 0.2
      ? projectsReveal / 0.2
      : projectsReveal > 0.82
        ? (1 - projectsReveal) / 0.18
        : 1;

  return (
    <div id="top" className="relative min-h-screen bg-background text-foreground">
      <CursorFollower />
      <Header />
      <GrainField />

      <main className="relative z-10 pt-16">
        <h1 className="name-hero px-5 pb-[0.22em] text-center md:px-8">Vedant</h1>

        {/* Pinned hero → About reveal */}
        <div ref={heroTrack} className="relative h-[300vh]" id="about">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-start overflow-hidden px-5 pb-6 pt-6 md:px-8">
            <div className="flex h-full w-full items-stretch gap-6">
              <div
                className={`hero-reveal min-w-0 overflow-hidden ${panelProgress > 0.01 ? "is-beside-about" : ""}`}
                style={{
                  width: `${imageWidth}%`,
                  flex: `0 1 ${imageWidth}%`,
                  height: panelProgress > 0.01 ? "100%" : undefined,
                }}
              >
                <RetroTerminal />
              </div>

              <div
                className={`min-w-0 overflow-x-hidden overflow-y-auto ${panelProgress > 0.01 ? "self-stretch" : "self-center"}`}
                style={{
                  opacity: panelProgress,
                  transform: `translateX(${(1 - panelProgress) * 50}px)`,
                  visibility: panelProgress > 0.01 ? "visible" : "hidden",
                  flex: panelProgress > 0.01 ? "1 1 0%" : "0 0 0%",
                }}
              >
                <h2 className="text-3xl font-bold tracking-[-0.04em] md:text-5xl">About</h2>

                {BACKGROUND_SECTIONS.map((section) => (
                  <section key={section.title} className="mt-6 flex flex-col md:mt-7">
                    <h3 className="label-mono mb-3 font-bold text-muted-foreground">{section.title}</h3>
                    {section.entries.map((entry, index) => (
                      <div
                        key={entry.title}
                        className="grid grid-cols-[2.4ch_1fr] gap-4 border-t border-border py-3 md:py-3.5"
                      >
                        <span className="label-mono pt-1 font-bold text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <p className="text-lg font-bold uppercase tracking-[-0.03em] md:text-2xl">
                            {entry.title}
                          </p>
                          <p className="label-mono mt-1.5 flex flex-wrap justify-between gap-2 font-bold text-muted-foreground">
                            <span>{entry.org}</span>
                            <span>{entry.dates}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border" />
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Projects title */}
        <div ref={projectsTrack} className="relative h-[260vh]" id="projects">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center overflow-hidden">
            <div
              className="projects-title-reveal flex w-full items-center justify-center px-5 md:px-8"
              style={{
                clipPath: `inset(0 ${(1 - projectsReveal) * 100}% 0 0)`,
                opacity: projectsTitleOpacity,
              }}
            >
              <span className="text-center text-[clamp(3rem,18vw,15rem)] font-bold leading-none tracking-[-0.05em]">
                Projects
              </span>
            </div>
          </div>
        </div>

        {/* In-grid project field */}
        <section className="project-tile-track">
          <div className="project-tile-stage">
            {PROJECT_CELLS.map((cell) => {
              if (!cell.project) {
                return (
                  <div
                    key={`blank-${cell.column}-${cell.row}`}
                    className="project-cell project-cell-blank"
                    aria-hidden="true"
                  />
                );
              }

              const { project } = cell;
              return (
                <div
                  key={project.id}
                  className={`project-cell ${project.pin ? "is-pinned" : ""}`}
                  style={{
                    gridColumn: project.column,
                    gridRow: project.row,
                  }}
                >
                  <article
                    className={`project-motion-tile slide-ready flex h-full flex-col justify-between p-4 xl:p-6 ${
                      project.tone === "ivory" ? "project-card-ivory" : "project-card-navy"
                    }`}
                    data-slide-direction={project.slide}
                  >
                    <div className="project-card-corner" aria-hidden="true">
                      <span>{String(project.number).padStart(2, "0")}</span>
                      <span>◇</span>
                    </div>
                    <div className="project-card-content">
                      <h3 className="text-base font-extrabold uppercase xl:text-lg">
                        {project.title}
                      </h3>
                      <p className="label-mono mt-1.5 font-bold">{project.category}</p>
                      <p className="mt-2 text-xs font-normal opacity-80 xl:text-sm">
                        {project.description}
                      </p>
                      <p className="label-mono mt-2 text-[0.65rem] font-bold xl:text-xs">
                        {project.stack}
                      </p>
                      {project.href ? (
                        <a
                          href={project.href}
                          target="_blank"
                          rel="noreferrer"
                          className="label-mono mt-2 inline-flex text-[0.65rem] font-bold transition-opacity hover:opacity-70 xl:text-xs"
                        >
                          / GitHub
                        </a>
                      ) : null}
                    </div>
                    <div className="project-card-corner project-card-corner-end" aria-hidden="true">
                      <span>{String(project.number).padStart(2, "0")}</span>
                      <span>◇</span>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact */}
        <footer id="contact" className="closing-section border-t border-border px-5 pb-8 pt-10 md:px-8">
          <p className="closing-name">Patel</p>

          <div className="closing-details">
            <p className="closing-label">Software engineer</p>

            <div className="flex items-start gap-5">
              <span className="status-dot mt-1.5 shrink-0" aria-hidden />
              <div>
                <p className="closing-label">Los Angeles, CA</p>
                <p className="label-mono mt-1 text-muted-foreground">
                  34.0522° N / 118.2437° W
                </p>
              </div>
            </div>

            <nav className="flex flex-col items-start" aria-label="Contact links">
              <a className="closing-link" href="https://www.linkedin.com/in/vedantpatel26/" target="_blank" rel="noreferrer">LinkedIn</a>
              <a className="closing-link" href="mailto:vedanthp1@gmail.com">Email</a>
              <a className="closing-link" href="tel:+16616449143">Phone</a>
              <a className="closing-link" href="https://github.com/VedantPatel04" target="_blank" rel="noreferrer">GitHub</a>
            </nav>

            <p className="closing-label">
              Vedant Patel
              <br />
              © {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vedant Patel — Portfolio" },
      {
        name: "description",
        content:
          "Personal portfolio of Vedant Patel — background, projects, and contact details.",
      },
      { property: "og:title", content: "Vedant Patel — Portfolio" },
      {
        property: "og:description",
        content:
          "Personal portfolio of Vedant Patel — background, projects, and contact details.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const NAV = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "GitHub", href: "https://github.com/VedantPatel04", external: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/vedantpatel26/", external: true },
  { label: "Contact", href: "#contact" },
];

const BACKGROUND_SECTIONS = [
  {
    title: "Experiences",
    entries: [
      {
        title: "Software Engineer Intern",
        org: "SciQuel",
        dates: "July 2026 — Sept. 2026",
      },
      {
        title: "STEM Technical Instructor",
        org: "College of the Canyons",
        dates: "Aug. 2023 — Aug. 2024",
      },
    ],
  },
  {
    title: "Education",
    entries: [
      {
        title: "M.S. Computer Science",
        org: "CSU Northridge",
        dates: "Present — May 2028",
      },
      {
        title: "B.S. Computer Science",
        org: "UC San Diego",
        dates: "Sept. 2024 — June 2026",
      },
    ],
  },
] as const;

const PROJECT_TILES = [
  {
    id: "p1",
    number: 1,
    column: 1,
    row: 1,
    slide: "right",
    pin: true,
    tone: "ivory",
    title: "NewCardForMe",
    category: "Full-stack · Recommenders",
    description: "Personalized credit-card recommendations so you can save more!",
    stack: "Django · React · PostgreSQL · Redis · Docker",
    href: "https://github.com/VedantPatel04/Cards",
  },
  {
    id: "p2",
    number: 2,
    column: 3,
    row: 1,
    slide: "right",
    pin: false,
    tone: "navy",
    title: "iCalendar",
    category: "Open source · Python",
    description: "Developed attachment properties for iCalendar across 4 calendar components. ",
    stack: "Python · Pytest",
    href: "https://github.com/collective/icalendar/pull/1615",
  },
  {
    id: "p3",
    number: 3,
    column: 2,
    row: 2,
    slide: "left",
    pin: true,
    tone: "ivory",
    title: "Resume on the Cloud",
    category: "Cloud · Serverless",
    description: "Serverless resume on AWS with live visitor counts.",
    stack: "Python · Lambda · S3 · DynamoDB · CloudFront",
    href: "https://github.com/VedantPatel04/The-Resume-on-the-clouds",
  },
  {
    id: "p4",
    number: 4,
    column: 4,
    row: 2,
    slide: "left",
    pin: false,
    tone: "navy",
    title: "Webhook Regression",
    category: "Infra · Reliability",
    description: "A developer platform for testing webhook consumers in local and staging environments",
    stack: "Python · FastAPI · React · AWS · SQS · Supabase",
    href: undefined,
  },
] as const;

const PROJECT_GRID_COLS = 4;
const PROJECT_GRID_ROWS = 3;

const PROJECT_CELLS = Array.from({ length: PROJECT_GRID_COLS * PROJECT_GRID_ROWS }, (_, index) => {
  const column = (index % PROJECT_GRID_COLS) + 1;
  const row = Math.floor(index / PROJECT_GRID_COLS) + 1;
  const project = PROJECT_TILES.find((tile) => tile.column === column && tile.row === row) ?? null;
  return { column, row, project };
});

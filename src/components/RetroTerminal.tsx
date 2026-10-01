import { useEffect, useState } from "react";

const MESSAGE = "Welcome to my (developer) crib 😏😏";
const CHARS = Array.from(MESSAGE);

export function RetroTerminal() {
  const [shown, setShown] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      setShown(CHARS.length);
      setCursorOn(true);
      return;
    }

    let index = 0;
    let mode: "type" | "hold" | "delete" | "gap" = "type";
    let holdUntil = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let blink = 0;

    const step = (now: number) => {
      const dt = last ? now - last : 0;
      last = now;
      acc += dt;

      if (mode === "type" && acc >= 52) {
        acc = 0;
        index = Math.min(CHARS.length, index + 1);
        setShown(index);
        if (index === CHARS.length) {
          mode = "hold";
          holdUntil = now + 2200;
        }
      } else if (mode === "hold" && now >= holdUntil) {
        mode = "delete";
        acc = 0;
      } else if (mode === "delete" && acc >= 22) {
        acc = 0;
        index = Math.max(0, index - 1);
        setShown(index);
        if (index === 0) {
          mode = "gap";
          holdUntil = now + 480;
        }
      } else if (mode === "gap" && now >= holdUntil) {
        mode = "type";
        acc = 0;
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    blink = window.setInterval(() => {
      setCursorOn((on) => !on);
    }, 530);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(blink);
    };
  }, []);

  return (
    <div className="retro-terminal" role="img" aria-label={MESSAGE}>
      <p className="retro-terminal-line" aria-hidden="true">
        <span className="retro-terminal-prompt">$ </span>
        <span>{CHARS.slice(0, shown).join("")}</span>
        <span className={`retro-terminal-cursor ${cursorOn ? "is-on" : ""}`} />
      </p>
    </div>
  );
}

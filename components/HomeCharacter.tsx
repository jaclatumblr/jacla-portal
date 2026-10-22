"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function HomeCharacter() {
  const body = useRef<HTMLDivElement>(null);
  const bounce = useRef<Animation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => () => { bounce.current?.cancel(); }, []);

  const hop = () => {
    if (!body.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    bounce.current?.cancel();
    bounce.current = body.current.animate([
      { transform: "translateY(0) rotate(0)", offset: 0 },
      { transform: "translateY(-24px) rotate(-2deg)", offset: .23 },
      { transform: "translateY(0) rotate(1deg)", offset: .46 },
      { transform: "translateY(-12px) rotate(1.5deg)", offset: .68 },
      { transform: "translateY(0) rotate(0)", offset: 1 },
    ], { duration: 680, easing: "ease-in-out" });
  };

  return (
    <div className="home-background-art">
      <div ref={body} className="home-character-bounce">
        <Image
          src="/images/home-character.png"
          alt=""
          width={600}
          height={800}
          sizes="(min-width: 1280px) 760px, (min-width: 768px) 600px, 400px"
          className="home-character-image"
          onLoad={(event) => { event.currentTarget.dataset.revealed = "true"; setLoaded(true); }}
          priority
        />
      </div>
      <button
        type="button"
        className="home-character-trigger"
        aria-label="キャラクターをぴょこぴょこさせる"
        title="タップするとぴょこぴょこ！"
        disabled={!loaded}
        onClick={hop}
      />
    </div>
  );
}

import { useEffect, useRef } from "react";

/**
 * The original hero and footer, carried over as JSX with attribute renames only --
 * no coordinates touched. The scene, the cheer squad, the buggy and the corn row are
 * the same artwork the single-file app draws, referencing the sprite in index.html.
 */
export function Hero({ eventName }: { eventName?: string }) {
  const row = useRef<HTMLDivElement>(null);
  // The corn strip is sized to the viewport, same as the original did on load.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const fill = () => {
      const n = Math.max(8, Math.min(40, Math.ceil(window.innerWidth / 46)));
      el.innerHTML = Array.from({ length: n }, () =>
        '<svg viewBox="0 0 44 70"><use href="#s-corn" width="44" height="70"/></svg>').join("");
    };
    fill();
    window.addEventListener("resize", fill);
    return () => window.removeEventListener("resize", fill);
  }, []);

  return (
    <header className="hero">
      <div className="sun"></div>
      <svg className="clouds" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true">
        <g className="cloud c1"><ellipse cx="120" cy="42" rx="44" ry="19"/><ellipse cx="156" cy="34" rx="32" ry="22"/><ellipse cx="90" cy="36" rx="26" ry="16"/></g>
        <g className="cloud c2"><ellipse cx="520" cy="76" rx="54" ry="20"/><ellipse cx="562" cy="66" rx="36" ry="24"/><ellipse cx="484" cy="68" rx="30" ry="17"/></g>
        <g className="cloud c3"><ellipse cx="880" cy="30" rx="38" ry="15"/><ellipse cx="910" cy="24" rx="28" ry="18"/></g>
      </svg>
    
      <div className="hero-inner">
        <div className="kicker">{eventName || "Rural Maryland · Cecil County · Est. Whenever"}</div>
        <h1>The <span className="big">Pond Neck</span> Olympics</h1>
        <div className="tag">Five Games · Eight Souls · Two Teams · <em>One Cob of Glory</em></div>
      </div>
    
      {/* rolling farmland scene */}
      <svg className="scene" viewBox="0 74 1200 186" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        {/* distant hills */}
        <path d="M0 150 Q160 106 330 138 T680 122 T980 148 T1200 128 V260 H0Z" fill="#8fae63"/>
        <path d="M0 176 Q220 140 430 170 T820 156 T1200 178 V260 H0Z" fill="#6f9a4d"/>
        {/* fence line */}
        <g stroke="#c3ae86" stroke-width="3" opacity=".85">
          <path d="M0 186 H1200M0 196 H1200"/>
          <path d="M60 178v26M180 178v26M300 178v26M420 178v26M540 178v26M660 178v26M780 178v26M900 178v26M1020 178v26M1140 178v26"/>
        </g>
        {/* foreground field */}
        <path d="M0 206 Q300 190 600 206 T1200 202 V260 H0Z" fill="#4a7c3f"/>
        {/* plowed rows */}
        <g stroke="#3d6a34" stroke-width="2.4" opacity=".55">
          <path d="M0 220 Q600 208 1200 218M0 234 Q600 222 1200 232M0 248 Q600 238 1200 246"/>
        </g>
        {/* farmstead */}
        <use href="#s-silo" x="152" y="86" width="42" height="98"/>
        <use href="#s-barn" x="196" y="96" width="136" height="88"/>
        <use href="#s-hay" x="352" y="152" width="46" height="35"/>
        <use href="#s-hay" x="392" y="158" width="38" height="29"/>
        <use href="#s-rooster" x="440" y="140" width="40" height="47"/>
        {/* corn on the left */}
        <use href="#s-corn" x="20" y="120" width="46" height="72"/>
        <use href="#s-corn" x="62" y="132" width="40" height="62"/>
        <use href="#s-corn" x="104" y="126" width="42" height="66"/>
        {/* the crowd */}
        <g className="cheer" style={{"color": "#3f5f8e", "animationDelay": "-.10s"}}><use href="#s-cheer-a" x="600" y="112" width="58" height="78"/></g>
        <g className="cheer" style={{"color": "#6b3f6e", "animationDelay": "-.55s"}}><use href="#s-cheer-b" x="652" y="118" width="54" height="72"/></g>
        <g className="cheer" style={{"color": "#4a7c3f", "animationDelay": "-.30s"}}><use href="#s-cheer-c" x="704" y="114" width="56" height="76"/></g>
        <g style={{"color": "#8f2a1f"}}><use href="#s-man" x="760" y="120" width="52" height="70"/></g>
        <g className="cheer" style={{"color": "#2c4470", "animationDelay": "-.72s"}}><use href="#s-cheer-a" x="808" y="116" width="56" height="76"/></g>
        <g className="cheer" style={{"color": "#a3143c", "animationDelay": "-.20s"}}><use href="#s-cheer-b" x="862" y="118" width="54" height="72"/></g>
        <g className="cheer" style={{"color": "#c9622b", "animationDelay": "-.90s"}}><use href="#s-cheer-c" x="914" y="114" width="56" height="76"/></g>
        {/* corn on the right */}
        <use href="#s-corn" x="1040" y="124" width="44" height="68"/>
        <use href="#s-corn" x="1082" y="116" width="48" height="74"/>
        <use href="#s-corn" x="1128" y="128" width="42" height="64"/>
      </svg>
    
      <div className="buggy-lane"><svg className="buggy-run trot" viewBox="0 0 132 70"><use href="#s-buggy" width="132" height="70"/></svg></div>
      <div className="cornrow" ref={row} aria-hidden="true" />
    </header>
  );
}

export function Jingle() {
  return (
    <footer className="jingle">
      <div className="fig">
        <svg className="cheer" viewBox="0 0 60 80" style={{"color": "#8f2a1f"}}><use href="#s-cheer-a" width="60" height="80"/></svg>
        <svg viewBox="0 0 60 80" style={{"color": "#e8b93b"}}><use href="#s-man" width="60" height="80"/></svg>
        <svg className="cheer" viewBox="0 0 60 80" style={{"color": "#4a7c3f", "animationDelay": "-.6s"}}><use href="#s-cheer-c" width="60" height="80"/></svg>
      </div>
      <div className="sausage" id="jingle">
        <b>Sausage Leaver, Self-Retriever</b>
        You leave your sausage lying all around.<br />
        <b>Sausage Leaver, Self-Retriever</b>
        Can’t pull that shit in downtown Downingtown.<br />
        <b>Sausage Leaver, Self-Retriever</b>
        You dropped that tasty sausage on the ground.<br />
        <b>Sausage Leaver, Self-Retriever</b>
        Pick up that sausage from our lost and found!<br /><br />
        Looks like you need a cheer up —<br />
        just dip that sausage in syrup.<br />
        <b style={{"color": "#e8b93b"}}>Downy Sausage never let ya down.</b>
      </div>
      <div className="fine">Pond Neck Olympics · All scores kept in this browser · Export early, export often</div>
    </footer>
  );
}

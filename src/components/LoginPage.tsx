import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../services/authContext';
import { gasAuthService } from '../services/gasAuthService';
import {
  Eye,
  EyeOff,
  Search,
  ArrowRight,
  Sun,
  Moon,
  Languages,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, language, setLanguage } = useAuth();

  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean | null>(null);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
    return false;
  });

  // Toggle Theme
  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Ping backend on mount to check connection & version
  useEffect(() => {
    let isMounted = true;
    gasAuthService
      .ping()
      .then((res) => {
        if (!isMounted) return;
        if (res.success) {
          setIsServerConnected(true);
          setServerVersion(res.version ? `Server v${res.version} (Terhubung)` : 'Server: Terhubung');
        } else {
          setIsServerConnected(false);
          setServerVersion('Server tidak terhubung');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsServerConnected(false);
        setServerVersion('Server tidak terhubung');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Blueprint interactive zoom & animation references
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zbRef = useRef<HTMLButtonElement | null>(null);
  const stageRef = useRef<number>(0);
  const curRef = useRef<number[]>([-30, -22, 785, 500]);
  const rafRef = useRef<number | null>(null);
  const autoTourTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef<boolean>(false);

  const full = [-30, -22, 785, 500];
  const zoom = [100, 2, 596, 84];
  const rack = [0, 0, 250, 392];
  const stageViewBoxes = [full, zoom, rack];

  const buttonLabels = [
    language === 'id' ? 'Zoom ke Mechanic' : 'Zoom to Mechanic',
    language === 'id' ? 'Zoom ke Rak' : 'Zoom to Rack',
    language === 'id' ? 'Lihat Semua (Denah)' : 'View All (Plan)',
  ];

  // Animation transition function between SVG viewBoxes
  const go = (to: number[]) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = curRef.current.slice();
    const t0 = performance.now();
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = prefersReduced ? 1 : 900;

    function step(t: number) {
      const p = Math.min((t - t0) / dur, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      curRef.current = from.map((v, i) => v + (to[i] - v) * e);
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', curRef.current.join(' '));
        svgRef.current.style.aspectRatio = String(curRef.current[2] / curRef.current[3]);
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);
  };

  // Programmatic switch to a specific stage (0, 1, or 2)
  const setStageTo = (stageIndex: number) => {
    stageRef.current = stageIndex;
    setCurrentStage(stageIndex);

    const svg = svgRef.current;
    if (svg) {
      svg.classList.toggle('zoomed', stageIndex >= 1);
      svg.classList.toggle('deep', stageIndex === 2);
      svg.setAttribute('aria-pressed', String(stageIndex > 0));
    }
    go(stageViewBoxes[stageIndex]);
  };

  // Step indicator manual click
  const handleSelectStage = (idx: number) => {
    userInteractedRef.current = true;
    if (autoTourTimerRef.current) clearTimeout(autoTourTimerRef.current);
    setStageTo(idx);
  };

  // Main Zoom Toggle
  const toggleZoom = () => {
    userInteractedRef.current = true;
    if (autoTourTimerRef.current) clearTimeout(autoTourTimerRef.current);
    const nextStage = (stageRef.current + 1) % 3;
    setStageTo(nextStage);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim() || !password) {
      setErrorMessage(
        language === 'id' ? 'NIK dan Password wajib diisi.' : 'NIK and Password are required.'
      );
      triggerShake();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(nik.trim(), password);
      if (!res.success) {
        setErrorMessage(
          res.message ||
            (language === 'id'
              ? 'Login gagal, periksa kembali NIK dan password.'
              : 'Login failed, check your NIK and password.')
        );
        triggerShake();
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === 'id' ? 'Gagal terhubung ke backend.' : 'Failed to connect to backend.')
      );
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 450);
  };

  // Setup Blueprint SVG elements, geometry, and tour
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const dmg = svg.querySelector('#dm');
    const drg = svg.querySelector('#dr');
    const tk = svg.querySelector('#tk');
    const ev = svg.querySelector('#ev');

    // Path length setup for line draw animations
    svg.querySelectorAll('.d').forEach((e: any) => {
      if (e.querySelectorAll) {
        e.setAttribute('pathLength', 1);
        e.querySelectorAll('rect,path,line').forEach((c: any) => c.setAttribute('pathLength', 1));
      }
    });

    // Dimension helper
    function dim(x1: number, y1: number, x2: number, y2: number, txt: string) {
      if (!dmg) return;
      const v = x1 === x2;
      let h = '';
      h +=
        '<path class="dm" d="M' +
        x1 +
        ' ' +
        y1 +
        'L' +
        x2 +
        ' ' +
        y2 +
        (v
          ? 'M' + (x1 - 3) + ' ' + y1 + 'H' + (x1 + 3) + 'M' + (x1 - 3) + ' ' + y2 + 'H' + (x1 + 3)
          : 'M' + x1 + ' ' + (y1 - 3) + 'V' + (y1 + 3) + 'M' + x2 + ' ' + (y2 - 3) + 'V' + (y2 + 3)) +
        '"/>';
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      h += v
        ? '<text class="tf" text-anchor="middle" transform="translate(' +
          (x1 + (x1 < 0 ? -3 : x1 > 600 ? 3 : -3)) +
          ',' +
          my +
          ') rotate(-90)" dy="' +
          (x1 < 0 ? 0 : x1 > 600 ? 4 : 0) +
          '">' +
          txt +
          '</text>'
        : '<text class="tf" text-anchor="middle" x="' + mx + '" y="' + (y1 - 4) + '">' + txt + '</text>';
      dmg.insertAdjacentHTML('beforeend', h);
    }

    if (dmg && !dmg.hasChildNodes()) {
      dim(10, -8, 102, -8, '12.2 m');
      [
        [10, 168.7, '22.15'],
        [168.7, 196.3, '3.85'],
        [196.3, 253.7, '8'],
        [253.7, 281.3, '3.85'],
        [281.3, 440, '22.15'],
      ].forEach((a: any) => {
        dim(-8, a[0], -8, a[1], a[2] + ' m');
      });
      [
        [10, 103.9, '13.1'],
        [103.9, 277.3, '24.2'],
        [277.3, 364, '12.1'],
        [364, 440, '10.6'],
      ].forEach((a: any) => {
        dim(703, a[0], 703, a[1], a[2] + ' m');
      });
      dim(724, 10, 724, 440, '60 m');
      dim(10, 452, 116, 452, '14 m');
      dim(116, 452, 479, 452, '48 m');
      dim(390, 26, 390, 51, '3.4 m');
      dim(370, 79, 370, 103, '3.4 m');
      dim(662, 72, 690, 72, '3.6 m');
    }

    // Door helper
    function door(x: number, y: number, o: 'h' | 'v') {
      if (!drg) return;
      const r = o === 'h' ? [x - 5, y - 3.5, 10, 7] : [x - 3.5, y - 5, 7, 10];
      const l = o === 'h' ? [x - 5, y + 3.5, x + 5, y - 3.5] : [x - 3.5, y + 5, x + 3.5, y - 5];
      drg.insertAdjacentHTML(
        'beforeend',
        '<rect x="' +
          r[0] +
          '" y="' +
          r[1] +
          '" width="' +
          r[2] +
          '" height="' +
          r[3] +
          '"/><line x1="' +
          l[0] +
          '" y1="' +
          l[1] +
          '" x2="' +
          l[2] +
          '" y2="' +
          l[3] +
          '"/>'
      );
    }

    if (drg && !drg.hasChildNodes()) {
      [
        [388, 10, 'h'],
        [391, 103, 'h'],
        [10, 177, 'v'],
        [10, 261, 'v'],
        [55, 189, 'v'],
        [319, 440, 'h'],
        [426, 367, 'h'],
      ].forEach((d: any) => {
        door(d[0], d[1], d[2]);
      });
      door(16, 468, 'h');
      drg.insertAdjacentHTML('beforeend', '<text x="26" y="470">PINTU</text>');
    }

    // Axonometric R4 elevation view with sewing machine
    if (ev && !ev.hasChildNodes()) {
      const ox = 71.2;
      const k = 0.866;
      const L = 108;
      const D = 36;
      const T = 5;
      const H = 30;
      const OY = [10, 94, 178, 264];
      let h = '';

      function P(x: number, y: number, z: number, oy: number) {
        return (ox + (x - y) * k).toFixed(1) + ',' + (oy + (x + y) * 0.5 - z).toFixed(1);
      }
      function poly(p: string[], c: string) {
        return '<polygon class="' + c + '" points="' + p.join(' ') + '"/>';
      }
      function ln(a: string[], c: string) {
        const p1 = a[0].split(',');
        const p2 = a[1].split(',');
        return (
          '<line class="' +
          c +
          '" x1="' +
          p1[0] +
          '" y1="' +
          p1[1] +
          '" x2="' +
          p2[0] +
          '" y2="' +
          p2[1] +
          '"/>'
        );
      }
      function box(
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        z0: number,
        z1: number,
        oy: number,
        c: string
      ) {
        return (
          poly([P(x0, y0, z1, oy), P(x1, y0, z1, oy), P(x1, y1, z1, oy), P(x0, y1, z1, oy)], c) +
          poly([P(x1, y0, z1, oy), P(x1, y1, z1, oy), P(x1, y1, z0, oy), P(x1, y0, z0, oy)], c) +
          poly([P(x0, y1, z1, oy), P(x1, y1, z1, oy), P(x1, y1, z0, oy), P(x0, y1, z0, oy)], c)
        );
      }
      function dy(i: number) {
        return ((137 - OY[i]) * 0.75).toFixed(0) + 'px';
      }

      const C = [
        [0, 0],
        [L, 0],
        [L, D],
        [0, D],
      ];
      h += '<g class="st">';
      C.forEach((c) => {
        const t = P(c[0], c[1], 0, OY[0]).split(',');
        const b = P(c[0], c[1], 0, OY[3]).split(',');
        h += '<line class="gd" x1="' + t[0] + '" y1="' + t[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
      });

      // Increased label size 01-04 (9px)
      ['01', '02', '03', '04'].forEach((n, i) => {
        h +=
          '<text class="tn" x="196" y="' +
          (OY[i] + 42 + (i === 3 ? 10 : 0)) +
          '">' +
          n +
          '</text>';
      });

      // Title & Legend at bottom-left aligned with AKSONOMETRIK title at x="8"
      h +=
        '<text class="ttl" x="8" y="345">AKSONOMETRIK</text>' +
        '<text class="tti" x="8" y="354">Axonometric · Rak R4 · potongan 3 dari 26 kolom</text>';

      const lg = [
        ['01', 'Tingkat C', 'Level C'],
        ['02', 'Tingkat B · mesin jahit', 'Level B'],
        ['03', 'Tingkat A', 'Level A'],
        ['04', 'Rangka baja', 'Steel frame'],
      ];
      lg.forEach((r, i) => {
        h +=
          '<text class="lg" x="8" y="' +
          (363 + i * 7.5) +
          '">' +
          r[0] +
          ' · ' +
          r[1] +
          ' / <tspan class="i" style="fill:var(--ln2);font-style:italic">' +
          r[2] +
          '</tspan></text>';
      });
      h += '</g>';

      // Frame 04
      h += '<g class="lv" style="--dy:' + dy(3) + '">';
      const oy3 = OY[3];
      const xs = [0, 36, 72, L];
      [0, H].forEach((z) => {
        [
          [0, 0, L, 0],
          [L, 0, L, D],
          [L, D, 0, D],
          [0, D, 0, 0],
        ].forEach((e) => {
          h += ln([P(e[0], e[1], z, oy3), P(e[2], e[3], z, oy3)], 'e');
        });
      });
      xs.forEach((x) => {
        [0, D].forEach((y) => {
          h += ln([P(x, y, 0, oy3), P(x, y, H, oy3)], 'e');
        });
      });
      [36, 72].forEach((x) => {
        [0, H].forEach((z) => {
          h += ln([P(x, 0, z, oy3), P(x, D, z, oy3)], 'sd');
        });
      });
      h += '</g>';

      // Tiers A(2), B(1), C(0)
      [2, 1, 0].forEach((i) => {
        const oyi = OY[i];
        h += '<g class="lv" style="--dy:' + dy(i) + '">';
        h +=
          poly([P(L, 0, 0, oyi), P(L, D, 0, oyi), P(L, D, -T, oyi), P(L, 0, -T, oyi)], 'fs') +
          poly([P(0, D, 0, oyi), P(L, D, 0, oyi), P(L, D, -T, oyi), P(0, D, -T, oyi)], 'fs');
        h += poly([P(0, 0, 0, oyi), P(L, 0, 0, oyi), P(L, D, 0, oyi), P(0, D, 0, oyi)], 'ft');
        for (let n = 1; n < 9; n++) {
          h += ln([P(n * 12, 0, 0, oyi), P(n * 12, D, 0, oyi)], n % 3 === 0 ? 'e' : 'sd');
        }
        if (i === 1) {
          const m = [
            [50, 58, 6, 12, 5, 14],
            [50, 58, 8, 30, 10, 14],
            [50, 58, 22, 30, 2, 14],
            [53, 55, 16, 18, 14, 17],
            [52, 56, 30, 33, 9, 13],
          ];
          h += box(50, 58, 6, 30, 0, 2, oyi, 'mc');
          m.forEach((q) => {
            h += box(q[0], q[1], q[2], q[3], q[4], q[5], oyi, 'mc');
          });
          h += ln([P(54, 8, 5, oyi), P(54, 8, 2, oyi)], 'mc');
          h +=
            '<polygon class="hl" points="' +
            [P(48, 0, 0, oyi), P(60, 0, 0, oyi), P(60, D, 0, oyi), P(48, D, 0, oyi)].join(' ') +
            '"/>';
        }
        h += '</g>';
      });

      // Callout for machine
      h +=
        '<g class="cal"><line class="e" style="stroke:var(--acc)" x1="108" y1="112" x2="148" y2="102"/><text class="te ta" x="150" y="101">MESIN JAHIT</text><text class="te" x="150" y="107">Kolom 2 · Slot 2</text></g>';
      ev.innerHTML = h;
      ev.querySelectorAll('.mc').forEach((el: any) => el.setAttribute('pathLength', 1));
    }

    // Tick marks on racks
    if (tk && !tk.hasChildNodes()) {
      const cols = [32, 26, 15, 15, 28, 28];
      svg.querySelectorAll('rect.r').forEach((r: any, i: number) => {
        const x = +r.getAttribute('x');
        const y = +r.getAttribute('y');
        const w = +r.getAttribute('width');
        const h = +r.getAttribute('height');
        const n = cols[i];
        let d = '';
        for (let k = 1; k < n; k++) {
          const px = (x + (w * k) / n).toFixed(2);
          d +=
            '<line x1="' + px + '" y1="' + (y + h - 4.5) + '" x2="' + px + '" y2="' + (y + h) + '"/>';
        }
        tk.insertAdjacentHTML('beforeend', d);
      });
    }

    // Keyboard support for blueprint SVG
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleZoom();
      }
    };
    svg.addEventListener('keydown', handleKeyDown);

    // Initial view & Mobile / Reduced-Motion detection
    const isMobile = window.innerWidth < 820;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isMobile) {
      // Mobile: Start immediately at Mechanic stage
      stageRef.current = 1;
      setCurrentStage(1);
      curRef.current = zoom.slice();
      svg.setAttribute('viewBox', zoom.join(' '));
      svg.style.aspectRatio = String(zoom[2] / zoom[3]);
      svg.classList.add('zoomed');
    } else if (!prefersReduced) {
      // Desktop Auto-Tour: Denah (0-3s) -> Mechanic (3-6s) -> Rak (6-9s) -> Denah (9s+)
      autoTourTimerRef.current = setTimeout(() => {
        if (userInteractedRef.current) return;
        setStageTo(1);

        autoTourTimerRef.current = setTimeout(() => {
          if (userInteractedRef.current) return;
          setStageTo(2);

          autoTourTimerRef.current = setTimeout(() => {
            if (userInteractedRef.current) return;
            setStageTo(0);
          }, 3000);
        }, 3000);
      }, 3000);
    }

    return () => {
      svg.removeEventListener('keydown', handleKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (autoTourTimerRef.current) clearTimeout(autoTourTimerRef.current);
    };
  }, []);

  return (
    <div className={`login-blueprint-wrapper min-h-screen w-full select-none ${isDark ? 'dark' : ''}`}>
      <style>{`
        .login-blueprint-wrapper {
          --bp: #0c2e57;
          --bp2: #08213e;
          --ln: #cfe6ff;
          --ln2: #7fb2e8;
          --acc: #ffd23f;

          /* Warm paper off-white background with subtle fine texture */
          --side-bg: #f7f5ef;
          --card-bg: #ffffff;
          --tx: #0f1d32;
          --mut: #334155;
          --bd: #d5dde8;
          --in: #fdfdfd;
          --btn: #0c2e57;
          --btx: #ffffff;
          box-sizing: border-box;
          font-family: "IBM Plex Mono", ui-monospace, monospace;
        }

        .dark .login-blueprint-wrapper,
        [data-theme="dark"] .login-blueprint-wrapper {
          --side-bg: #091322;
          --card-bg: #0f1c2e;
          --tx: #f1f5f9;
          --mut: #94a3b8;
          --bd: #1e314b;
          --in: #070e18;
          --btn: #ffd23f;
          --btx: #0c2e57;
        }

        .lb-wrap {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr);
          min-height: 100vh;
          background-color: var(--side-bg);
          position: relative;
        }

        /* PANEL BLUEPRINT (KIRI) */
        .lb-bp {
          position: relative;
          background-color: var(--bp);
          /* Large grid 80px preserved, fine 16px grid opacity reduced */
          background-image:
            linear-gradient(rgba(207, 230, 255, 0.16) 1px, transparent 1px),
            linear-gradient(90deg, rgba(207, 230, 255, 0.16) 1px, transparent 1px),
            linear-gradient(rgba(207, 230, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(207, 230, 255, 0.04) 1px, transparent 1px);
          background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          overflow: hidden;
        }

        /* Soft dark vignette at edges */
        .lb-bp-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 35%, rgba(4, 15, 30, 0.78) 100%);
          pointer-events: none;
          z-index: 1;
        }

        /* Sheet Drafting Border with Corner Marks */
        .lb-bp-frame {
          position: absolute;
          inset: 16px;
          border: 1px solid rgba(127, 178, 232, 0.22);
          pointer-events: none;
          z-index: 2;
        }
        .lb-bp-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          border-color: var(--ln2);
          opacity: 0.8;
        }
        .lb-bp-corner.tl { top: -1px; left: -1px; border-top: 2px solid var(--ln2); border-left: 2px solid var(--ln2); }
        .lb-bp-corner.tr { top: -1px; right: -1px; border-top: 2px solid var(--ln2); border-right: 2px solid var(--ln2); }
        .lb-bp-corner.bl { bottom: -1px; left: -1px; border-bottom: 2px solid var(--ln2); border-left: 2px solid var(--ln2); }
        .lb-bp-corner.br { bottom: -1px; right: -1px; border-bottom: 2px solid var(--ln2); border-right: 2px solid var(--ln2); }

        /* Blueprint SVG occupying ~85% height of panel */
        .lb-bp svg#bp {
          position: relative;
          z-index: 3;
          width: 100%;
          max-width: 1060px;
          height: auto;
          max-height: 82vh;
          cursor: zoom-in;
          aspect-ratio: 785 / 500;
          transition: filter .3s;
        }

        .lb-bp svg.deep {
          cursor: zoom-out;
        }

        .lb-bp svg:focus-visible {
          outline: 2px solid var(--acc);
          outline-offset: 4px;
        }

        /* Zoom button at bottom-left corner */
        .lb-zb {
          position: absolute;
          left: 32px;
          bottom: 24px;
          z-index: 10;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          padding: 8px 16px;
          background: rgba(12, 46, 87, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--ln2);
          color: var(--ln);
          font-size: 12.5px;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          font-family: "IBM Plex Mono", monospace;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .lb-zb:hover {
          background: rgba(20, 68, 126, 0.95);
          border-color: var(--acc);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .lb-zb:focus-visible {
          outline: 2px solid var(--acc);
          outline-offset: 2px;
        }

        /* 3-Step Indicator Bar */
        .lb-steps-bar {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(6, 22, 43, 0.88);
          backdrop-filter: blur(10px);
          padding: 4px 10px;
          border-radius: 9999px;
          border: 1px solid rgba(127, 178, 232, 0.35);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }

        .lb-step-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 44px;
          padding: 6px 14px;
          border-radius: 9999px;
          background: transparent;
          border: 0;
          cursor: pointer;
          color: #94b8e3;
          font-size: 12px;
          font-family: "IBM Plex Mono", monospace;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .lb-step-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }

        .lb-step-btn.active {
          color: #0c2e57;
          background: var(--acc);
          font-weight: 700;
        }

        .lb-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #5b87ba;
          transition: all 0.2s ease;
        }

        .lb-step-btn.active .lb-step-dot {
          background: #0c2e57;
        }

        /* PANEL FORM (KANAN) */
        .lb-side {
          position: relative;
          background-color: var(--side-bg);
          /* Subtle warm paper micro texture */
          background-image: radial-gradient(rgba(15, 29, 50, 0.04) 1px, transparent 1px);
          background-size: 12px 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          color: var(--tx);
          z-index: 5;
        }

        .dark .lb-side {
          background-image: radial-gradient(rgba(207, 230, 255, 0.03) 1px, transparent 1px);
        }

        @media (min-width: 821px) {
          .lb-side {
            /* Miring tipis (angled clip-path) dan kartu menimpa blueprint */
            clip-path: polygon(22px 0, 100% 0, 100% 100%, 0 100%);
            margin-left: -22px;
          }
        }

        /* Form Card: radius 16px, soft shadow, max-width 380px, generous padding */
        .lb-card {
          width: 100%;
          max-width: 380px;
          background: var(--card-bg);
          border-radius: 16px;
          padding: 34px 32px;
          box-shadow:
            0 12px 36px -6px rgba(12, 46, 87, 0.12),
            0 4px 16px -2px rgba(12, 46, 87, 0.06),
            0 0 0 1px var(--bd);
          position: relative;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .dark .lb-card {
          box-shadow:
            0 16px 42px -8px rgba(0, 0, 0, 0.65),
            0 4px 16px -2px rgba(0, 0, 0, 0.4),
            0 0 0 1px var(--bd);
        }

        /* Shake animation when login fails */
        .shake-card {
          animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(4px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
          40%, 60% { transform: translate3d(6px, 0, 0); }
        }

        /* Input styling with thin yellow focus ring */
        .lb-input-field {
          width: 100%;
          padding: 11px 14px;
          border: 1px solid var(--bd);
          border-radius: 8px;
          background: var(--in);
          color: var(--tx);
          font-family: inherit;
          font-size: 13.5px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .lb-input-field:focus {
          outline: none;
          border-color: #ffd23f;
          box-shadow: 0 0 0 2.5px rgba(255, 210, 63, 0.35);
        }

        /* Submit Button: Hover translateY(-1px), active translateY(0) */
        .lb-submit-btn {
          width: 100%;
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          padding: 12px 18px;
          border: 0;
          border-radius: 8px;
          background: var(--btn);
          color: var(--btx);
          font: 600 14px "IBM Plex Mono", monospace;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
          box-shadow: 0 3px 10px rgba(12, 46, 87, 0.2);
        }

        .lb-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.08);
          box-shadow: 0 6px 16px rgba(12, 46, 87, 0.28);
        }

        .lb-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .lb-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .lb-submit-btn:focus-visible {
          outline: 2px solid var(--acc);
          outline-offset: 3px;
        }

        /* SVG Line drawing and plan elevation */
        .tk { opacity: 0; transition: opacity .6s .3s; }
        .zoomed .tk { opacity: 1; }
        .dr rect { fill: rgba(255,138,92,.25); stroke: #ff8a5c; stroke-width: .9; }
        .dr line { stroke: #ff8a5c; stroke-width: .8; }
        .dr text { font: 500 6px "IBM Plex Mono", monospace; fill: #ff8a5c; stroke: none; }
        .tk line { stroke: var(--acc); stroke-width: .5; }

        .plan { transition: opacity .6s .5s; }
        .deep .plan { opacity: 0; transition: opacity .6s; }
        .ev { opacity: 0; pointer-events: none; transition: opacity .4s; }
        .deep .ev { opacity: 1; transition: opacity .7s .7s; }
        .ev .e { fill: none; stroke: var(--ln); stroke-width: .6; }
        .ev .sd { stroke: var(--ln2); stroke-width: .4; stroke-dasharray: 1.5 1.5; opacity: .8; }
        .ev .band { fill: var(--ln); opacity: .05; stroke: none; }
        .ev .bb { fill: var(--acc); opacity: .11; }
        .ev .te { font: 500 4.5px "IBM Plex Mono", monospace; fill: var(--ln2); }
        .ev .te.c { text-anchor: middle; fill: var(--ln); }
        .ev .ta { fill: var(--acc); }
        .ev .tt { font: 500 6px "IBM Plex Mono", monospace; fill: var(--ln); letter-spacing: .06em; }
        .ev .hl { fill: none; stroke: var(--acc); stroke-width: .5; stroke-dasharray: 2 1.2; }
        .ev .mc { fill: var(--bp); stroke: var(--acc); stroke-width: .5; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
        .lv { opacity: 0; transform: translateY(var(--dy, -7px)); transition: opacity .5s, transform 1.2s cubic-bezier(.25, .9, .3, 1); }
        .deep .lv { opacity: 1; transform: none; transition-delay: 1s; }
        .ev .ft { fill: rgba(207, 230, 255, .07); stroke: var(--ln); stroke-width: .6; }
        .ev .fs { fill: url(#hw); stroke: var(--ln); stroke-width: .6; }
        .ev .gd { stroke: var(--ln2); stroke-width: .4; stroke-dasharray: .8 2.2; fill: none; }
        .ev .tn { font: 600 9px "Barlow Semi Condensed", sans-serif; fill: var(--ln); letter-spacing: .08em; }
        .ev .lg { font: 500 5.2px "IBM Plex Mono", monospace; fill: var(--ln); }
        .ev .lg i { fill: var(--ln2); font-style: italic; }
        .ev .ttl { font: 700 11px "Barlow Semi Condensed", sans-serif; fill: var(--ln); letter-spacing: .06em; }
        .ev .tti { font: italic 500 7px "Barlow Semi Condensed", sans-serif; fill: var(--ln2); }
        .st, .hl, .cal { opacity: 0; transition: opacity .6s; }
        .deep .st { opacity: 1; transition-delay: 2.1s; }
        .deep .hl, .deep .cal { opacity: 1; transition-delay: 3.2s; }
        .deep .mc { animation: draw 1.6s 2.5s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .deep .mc { animation: none; stroke-dashoffset: 0; }
          .lv, .plan, .ev, .st, .hl, .cal { transition: none !important; }
        }

        .l { fill: none; stroke: var(--ln); stroke-width: 1.1; }
        .f { fill: none; stroke: var(--ln2); stroke-width: .7; opacity: .75; }
        .r { fill: url(#h); stroke: var(--acc); stroke-width: 1.3; }
        .t { font: 500 7px "IBM Plex Mono", monospace; fill: var(--ln); letter-spacing: .06em; }
        .tf { font: 500 6px "IBM Plex Mono", monospace; fill: var(--ln2); }
        .tr { font: 600 9px "Barlow Semi Condensed", sans-serif; fill: var(--acc); text-anchor: middle; }
        .dm { stroke: var(--ln2); stroke-width: .6; fill: none; }
        .d { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 2.2s cubic-bezier(.4, 0, .2, 1) forwards; }
        .d2 { animation-delay: .9s; }
        .tx { opacity: 0; animation: show .8s 2s forwards; }

        @keyframes draw { to { stroke-dashoffset: 0; } }
        @keyframes show { to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .d { animation: none; stroke-dashoffset: 0; }
          .tx { animation: none; opacity: 1; }
        }

        /* MOBILE LAYOUT */
        @media (max-width: 820px) {
          .lb-wrap {
            grid-template-columns: 1fr;
          }
          .lb-bp {
            height: 35vh;
            min-height: 230px;
            max-height: 320px;
            padding: 12px 10px;
          }
          .lb-bp svg#bp {
            max-height: calc(35vh - 30px);
          }
          .lb-steps-bar {
            display: none;
          }
          .lb-zb {
            left: 12px;
            bottom: 12px;
            padding: 6px 12px;
            font-size: 11px;
            min-height: 40px;
          }
          .lb-side {
            padding: 24px 16px 44px;
            clip-path: none;
            margin-left: 0;
          }
          .lb-card {
            max-width: 100%;
            padding: 24px 20px;
          }
        }
      `}</style>

      <div className="lb-wrap">
        {/* PANEL KIRI: Ilustrasi Blueprint Warehouse 2 Interaktif */}
        <div className="lb-bp">
          {/* Subtle dark vignette on blueprint edges */}
          <div className="lb-bp-vignette" />

          {/* Architectural Drafting Frame with Corner Ticks */}
          <div className="lb-bp-frame">
            <div className="lb-bp-corner tl" />
            <div className="lb-bp-corner tr" />
            <div className="lb-bp-corner bl" />
            <div className="lb-bp-corner br" />

            {/* Scale Bar (Batang Skala Kecil) */}
            <div className="absolute top-3 left-4 hidden sm:flex items-center gap-2 select-none opacity-85">
              <svg className="w-24 h-5 text-[#7fb2e8]" viewBox="0 0 100 20">
                <line x1="10" y1="12" x2="90" y2="12" stroke="currentColor" strokeWidth="1.2" />
                <line x1="10" y1="7" x2="10" y2="17" stroke="currentColor" strokeWidth="1.2" />
                <line x1="50" y1="7" x2="50" y2="17" stroke="currentColor" strokeWidth="1.2" />
                <line x1="90" y1="7" x2="90" y2="17" stroke="currentColor" strokeWidth="1.2" />
                <text x="10" y="5" fontSize="5" fill="currentColor" textAnchor="middle" fontFamily="monospace">0m</text>
                <text x="50" y="5" fontSize="5" fill="currentColor" textAnchor="middle" fontFamily="monospace">10m</text>
                <text x="90" y="5" fontSize="5" fill="currentColor" textAnchor="middle" fontFamily="monospace">20m</text>
              </svg>
              <span className="text-[9px] font-mono text-[#cfe6ff] tracking-wider">SCALE 1:200</span>
            </div>

            {/* North Arrow (Panah Utara Kecil) */}
            <div className="absolute top-3 right-4 hidden sm:flex flex-col items-center select-none opacity-85">
              <svg className="w-4 h-6 text-[#7fb2e8]" viewBox="0 0 20 28" fill="none">
                <path d="M10 2L17 24L10 19L3 24L10 2Z" stroke="currentColor" strokeWidth="1.2" fill="#ffd23f" fillOpacity="0.25" />
                <path d="M10 2L10 19L17 24L10 2Z" fill="currentColor" fillOpacity="0.5" />
              </svg>
              <span className="text-[8px] font-mono font-bold text-[#cfe6ff] -mt-0.5">N</span>
            </div>

            {/* Technical Sheet Tag */}
            <div className="absolute bottom-3 right-4 hidden sm:block text-[9px] font-mono text-[#7fb2e8]/70 text-right select-none">
              DWG: WH2-RACK-01 • ME DEPT
            </div>
          </div>

          <svg
            id="bp"
            ref={svgRef}
            viewBox="-30 -22 785 500"
            role="button"
            tabIndex={0}
            aria-pressed={currentStage > 0}
            aria-label="Denah Warehouse 2. Klik untuk melihat area Mechanic atau Rak"
            onClick={toggleZoom}
          >
            <defs>
              <pattern id="hw" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="2" stroke="#cfe6ff" strokeWidth=".35" opacity=".55" />
              </pattern>
              <pattern id="h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" stroke="#ffd23f" strokeWidth=".8" opacity=".7" />
              </pattern>
            </defs>

            {/* Container Plan (Dinamis disembunyikan saat zoom ke Rak) */}
            <g className="plan">
              {/* Dimensions */}
              <path className="dm tx" d="M10 4H690M10 1V7M690 1V7" />
              <text className="tf tx" x="350" y="-1" textAnchor="middle" transform="translate(0,1)">
                90 m
              </text>

              {/* Building */}
              <rect className="l d" x="10" y="10" width="680" height="430" />
              <path className="f d" d="M10 60H100V10" />
              <text className="tf tx" x="16" y="38">
                ACRYLIC
              </text>
              <rect className="f d d2" x="55" y="103" width="635" height="264" />

              {/* Fabric zones */}
              <g className="d d2 ctx">
                <rect className="f" x="83" y="125" width="582" height="18" />
                <rect className="f" x="83" y="164" width="582" height="22" />
                <rect className="f" x="83" y="209" width="582" height="24" />
                <rect className="f" x="83" y="263" width="582" height="23" />
                <rect className="f" x="83" y="307" width="582" height="18" />
                <rect className="f" x="83" y="346" width="330" height="12" />
                <rect className="f" x="442" y="346" width="247" height="12" />
                <rect className="f" x="119" y="358" width="294" height="12" />
                <rect className="f" x="119" y="388" width="294" height="20" />
              </g>
              <g className="tx">
                <text className="t" x="330" y="155">
                  FABRIC SWH
                </text>
                <text className="t" x="330" y="252">
                  FABRIC SWH
                </text>
                <text className="t" x="330" y="298">
                  FABRIC STOCK
                </text>
                <text className="t" x="215" y="383">
                  FABRIC FACTORY 3B
                </text>
              </g>

              {/* WH2 Racks R1-R6 */}
              <g className="d d2">
                <rect className="r" x="397" y="12" width="291" height="14" />
                <rect className="r" x="136" y="12" width="238" height="14" />
                <rect className="r" x="235" y="51" width="139" height="14" />
                <rect className="r" x="235" y="65" width="139" height="14" />
                <rect className="r" x="405" y="51" width="257" height="14" />
                <rect className="r" x="405" y="65" width="257" height="14" />
              </g>
              <g className="tx">
                <text className="tr" x="542" y="23">
                  R1
                </text>
                <text className="tr" x="255" y="23">
                  R4
                </text>
                <text className="tr" x="304" y="61">
                  R5
                </text>
                <text className="tr" x="304" y="75">
                  R6
                </text>
                <text className="tr" x="533" y="61">
                  R2
                </text>
                <text className="tr" x="533" y="75">
                  R3
                </text>
                <text className="t" x="110" y="68" style={{ fontSize: '9px' }}>
                  MECHANIC
                </text>
              </g>
              <g id="tk" className="tk"></g>
              <g id="dm" className="tx"></g>
              <g id="dr" className="dr tx"></g>

              {/* Title Block */}
              <g className="tx">
                <rect className="l" x="480" y="418" width="210" height="22" />
                <line className="l" x1="590" y1="418" x2="590" y2="440" />
                <text className="t" x="486" y="431">
                  WAREHOUSE 2 LAYOUT
                </text>
                <text className="tf" x="596" y="428">
                  SCALE 1:200
                </text>
                <text className="tf" x="595" y="436" style={{ fontSize: '5.3px' }}>
                  PT. WINNERS INTERNATIONAL
                </text>
              </g>
            </g>

            {/* Axonometric 4-Layer R4 Section */}
            <g id="ev" className="ev"></g>
          </svg>

          {/* Tombol Zoom di pojok dengan ikon kaca pembesar */}
          <button
            className="lb-zb"
            id="zb"
            ref={zbRef}
            type="button"
            onClick={toggleZoom}
          >
            <Search className="w-4 h-4 text-[#ffd23f]" />
            <span>{buttonLabels[currentStage]}</span>
          </button>

          {/* Indikator 3 Langkah di Bawah Gambar */}
          <div className="lb-steps-bar" role="tablist" aria-label="Tahap Zoom Blueprint">
            <button
              type="button"
              role="tab"
              aria-selected={currentStage === 0}
              onClick={() => handleSelectStage(0)}
              className={`lb-step-btn ${currentStage === 0 ? 'active' : ''}`}
            >
              <span className="lb-step-dot" />
              <span>1 Denah</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currentStage === 1}
              onClick={() => handleSelectStage(1)}
              className={`lb-step-btn ${currentStage === 1 ? 'active' : ''}`}
            >
              <span className="lb-step-dot" />
              <span>2 Mechanic</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currentStage === 2}
              onClick={() => handleSelectStage(2)}
              className={`lb-step-btn ${currentStage === 2 ? 'active' : ''}`}
            >
              <span className="lb-step-dot" />
              <span>3 Rak</span>
            </button>
          </div>
        </div>

        {/* PANEL KANAN: Form Login di dalam Kartu */}
        <div className="lb-side">
          {/* Controls Pojok Kanan Atas: Bahasa & Tema (Target tap >= 44px) */}
          <div className="absolute top-5 right-5 sm:top-7 sm:right-7 flex items-center gap-2 z-20">
            <button
              type="button"
              onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
              className="min-w-[44px] min-h-[44px] p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:border-[#ffd23f] hover:text-[#0c2e57] dark:hover:text-[#ffd23f] transition-all flex items-center justify-center gap-1.5 text-xs font-bold font-mono shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ffd23f]"
              title={language === 'id' ? 'Ganti Bahasa (English)' : 'Change Language (Indonesia)'}
              aria-label="Ganti Bahasa"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="uppercase">{language}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="min-w-[44px] min-h-[44px] p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:border-[#ffd23f] hover:text-[#0c2e57] dark:hover:text-[#ffd23f] transition-all flex items-center justify-center shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#ffd23f]"
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              aria-label="Ganti Tema"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#ffd23f]" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>

          {/* Kartu Form: Max Width 380px, Radius 16px, Soft Shadow */}
          <div className={`lb-card ${isShaking ? 'shake-card' : ''}`}>
            {/* Status Server Dot di Pojok Kanan Kartu dengan Tooltip */}
            <div
              className="absolute top-4 right-4 z-10 cursor-help"
              title={serverVersion || (isServerConnected ? 'Server: Terhubung' : 'Server: Memeriksa...')}
            >
              <div className="flex items-center gap-1.5 p-1">
                {isServerConnected === true ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                ) : isServerConnected === false ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                ) : (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                  </span>
                )}
              </div>
            </div>

            {/* Brand Logo & Perusahaan PT. WINNERS INTERNATIONAL */}
            <div className="flex items-center gap-2.5 mb-2.5">
              {/* Emblem Logo PT. WINNERS */}
              <div className="w-8 h-8 rounded-lg bg-[#0c2e57] border border-[#ffd23f]/50 flex items-center justify-center shadow-xs shrink-0">
                <svg className="w-5 h-5 text-[#ffd23f]" viewBox="0 0 24 24" fill="none">
                  {/* Geometric Interconnected Monogram 'W' with precision industrial wings */}
                  <path
                    d="M3 6L7 18L10 10L14 18L17 10L19 14M21 6L17 18"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="5" r="1.5" fill="#ffd23f" />
                </svg>
              </div>
              <div className="text-[12.5px] font-bold tracking-wider uppercase font-mono text-[#0c2e57] dark:text-[#ffd23f]">
                PT. WINNERS INTERNATIONAL
              </div>
            </div>

            {/* Judul Diperbesar (~32px) */}
            <h1 className="text-[28px] sm:text-[32px] font-extrabold leading-[1.08] tracking-tight text-[#0f1d32] dark:text-white font-sans">
              MACHINE ASSET MANAGEMENT
            </h1>

            {/* Garis Aksen Kuning 40x3px */}
            <div className="w-[40px] h-[3px] bg-[#ffd23f] rounded-full my-3" />

            {/* Subtitle / Teks Kecil 12-13px dan Warna Gelap Kontras >= 4.5:1 */}
            <p className="text-[12.5px] leading-relaxed text-[#334155] dark:text-[#94a3b8] mb-6 font-sans">
              {language === 'id'
                ? 'Masuk untuk melihat dan mengatur posisi mesin di rak.'
                : 'Sign in to monitor and manage sewing machine inventory and rack positions.'}
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Kolom NIK: Kosongkan nilai bawaan, placeholder 'Contoh: 20100151' */}
              <div>
                <label className="block text-[12.5px] font-semibold text-[#1e293b] dark:text-[#e2e8f0] mb-1.5" htmlFor="nik-input">
                  {language === 'id' ? 'NIK / Username' : 'Employee ID (NIK) / Username'}
                </label>
                <input
                  id="nik-input"
                  className="lb-input-field"
                  type="text"
                  autoComplete="username"
                  value={nik}
                  disabled={isLoading}
                  onChange={(e) => setNik(e.target.value)}
                  placeholder="Contoh: 20100151"
                  required
                />
              </div>

              {/* Kolom Password dengan ikon mata dan indikator Caps Lock */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12.5px] font-semibold text-[#1e293b] dark:text-[#e2e8f0]" htmlFor="password-input">
                    Password
                  </label>
                  {capsLockOn && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 animate-pulse">
                      <AlertCircle className="w-3 h-3" />
                      Caps Lock aktif
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password-input"
                    className="lb-input-field pr-11"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    disabled={isLoading}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Pesan Error Singkat di Bawah Form */}
              {errorMessage && (
                <div className="p-3 rounded-lg border border-rose-300 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[12.5px] flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMessage}</span>
                </div>
              )}

              {/* Tombol Masuk: Panah kecil di kanan, hover naik 1px, spinner saat loading */}
              <button
                className="lb-submit-btn group"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-current" />
                    <span>{language === 'id' ? 'Memverifikasi...' : 'Verifying...'}</span>
                  </>
                ) : (
                  <>
                    <span>{language === 'id' ? 'Masuk' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[12px] text-[#475569] dark:text-[#94a3b8] font-mono">
              <span>Warehouse 2 Rack Map</span>
              <span className="text-[11px] opacity-75">ID • EN</span>
            </div>
          </div>

          <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] tracking-wider text-[#475569] dark:text-[#94a3b8] font-mono select-none pointer-events-none">
            POWERED BY ME TEAM &amp; PROD. SUPPORT
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../services/authContext';
import { gasAuthService } from '../services/gasAuthService';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();

  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean | null>(null);

  // Ping backend on mount to check connection & status
  useEffect(() => {
    let isMounted = true;
    gasAuthService.ping().then((res) => {
      if (!isMounted) return;
      setIsServerConnected(Boolean(res.success));
    }).catch(() => {
      if (!isMounted) return;
      setIsServerConnected(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  // Blueprint interactive zoom & animation references
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zbRef = useRef<HTMLButtonElement | null>(null);
  const stageRef = useRef<number>(0);
  const curRef = useRef<number[]>([-30, -22, 785, 500]);
  const rafRef = useRef<number | null>(null);

  const full = [-30, -22, 785, 500];
  const zoom = [100, 2, 596, 84];
  const rack = [0, 0, 250, 392];
  const buttonLabels = ['Zoom ke Mechanic', 'Zoom ke Rak', 'Lihat semua'];

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim() || !password) {
      setErrorMessage('NIK dan Password wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(nik.trim(), password);
      if (!res.success) {
        setErrorMessage(res.message || 'Login gagal, periksa kembali NIK dan password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup Blueprint SVG elements and zoom transitions
  useEffect(() => {
    const svg = svgRef.current;
    const zb = zbRef.current;
    if (!svg || !zb) return;

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
        return '<line class="' + c + '" x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '"/>';
      }
      function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, oy: number, c: string) {
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
      ['01', '02', '03', '04'].forEach((n, i) => {
        h += '<text class="tn" x="196" y="' + (OY[i] + 42 + (i === 3 ? 10 : 0)) + '">' + n + '</text>';
      });
      const lg = [
        ['01', 'Tingkat C', 'Level C'],
        ['02', 'Tingkat B · mesin jahit', 'Level B'],
        ['03', 'Tingkat A', 'Level A'],
        ['04', 'Rangka baja', 'Steel frame'],
      ];
      lg.forEach((r, i) => {
        h +=
          '<text class="lg" x="112" y="' +
          (350 + i * 8) +
          '">' +
          r[0] +
          ' · ' +
          r[1] +
          ' / <tspan class="i" style="fill:var(--ln2);font-style:italic">' +
          r[2] +
          '</tspan></text>';
      });
      h +=
        '<text class="ttl" x="8" y="372">AKSONOMETRIK</text><text class="tti" x="8" y="381">Axonometric · Rak R4 · potongan 3 dari 26 kolom</text></g>';

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
          d += '<line x1="' + px + '" y1="' + (y + h - 4.5) + '" x2="' + px + '" y2="' + (y + h) + '"/>';
        }
        tk.insertAdjacentHTML('beforeend', d);
      });
    }

    // Animation transition function
    function go(to: number[]) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const from = curRef.current.slice();
      const t0 = performance.now();
      const prefersReduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
      const dur = prefersReduced ? 1 : 1000;

      function step(t: number) {
        const p = Math.min((t - t0) / dur, 1);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        curRef.current = from.map((v, i) => v + (to[i] - v) * e);
        if (svg) {
          svg.setAttribute('viewBox', curRef.current.join(' '));
          svg.style.aspectRatio = String(curRef.current[2] / curRef.current[3]);
        }
        if (p < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }

    function toggle() {
      stageRef.current = (stageRef.current + 1) % 3;
      const stage = stageRef.current;
      const V = [full, zoom, rack];

      svg?.classList.toggle('zoomed', stage >= 1);
      svg?.classList.toggle('deep', stage === 2);
      svg?.setAttribute('aria-pressed', String(stage > 0));
      if (zb) zb.textContent = buttonLabels[stage];
      go(V[stage]);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    };

    svg.addEventListener('click', toggle);
    svg.addEventListener('keydown', handleKeyDown);
    zb.addEventListener('click', toggle);

    return () => {
      svg.removeEventListener('click', toggle);
      svg.removeEventListener('keydown', handleKeyDown);
      zb.removeEventListener('click', toggle);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="login-blueprint-wrapper min-h-screen w-full">
      <style>{`
        .login-blueprint-wrapper {
          --bp: #0c2e57;
          --bp2: #0a2647;
          --ln: #cfe6ff;
          --ln2: #7fb2e8;
          --acc: #ffd23f;
          --card: #ffffff;
          --tx: #12233d;
          --mut: #5d6f88;
          --bd: #cfd8e6;
          --in: #f4f7fb;
          --btn: #0c2e57;
          --btx: #ffffff;
          box-sizing: border-box;
          font-family: "IBM Plex Mono", ui-monospace, monospace;
        }

        @media (prefers-color-scheme: dark) {
          .login-blueprint-wrapper:not([data-theme="light"]) {
            --card: #0f1b2d;
            --tx: #e6eef9;
            --mut: #8ea3c0;
            --bd: #26364f;
            --in: #0a1424;
            --btn: #ffd23f;
            --btx: #0c2e57;
          }
        }

        .dark .login-blueprint-wrapper,
        [data-theme="dark"] .login-blueprint-wrapper {
          --card: #0f1b2d;
          --tx: #e6eef9;
          --mut: #8ea3c0;
          --bd: #26364f;
          --in: #0a1424;
          --btn: #ffd23f;
          --btx: #0c2e57;
        }

        .lb-wrap {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
          min-height: 100vh;
        }

        .lb-bp {
          position: relative;
          background:
            linear-gradient(var(--ln) 1px, transparent 1px) 0 0/80px 80px,
            linear-gradient(90deg, var(--ln) 1px, transparent 1px) 0 0/80px 80px,
            linear-gradient(var(--ln) 1px, transparent 1px) 0 0/16px 16px,
            linear-gradient(90deg, var(--ln) 1px, transparent 1px) 0 0/16px 16px,
            var(--bp);
          background-blend-mode: normal;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
          overflow: hidden;
        }

        .lb-bp::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--bp);
          opacity: .84;
        }

        .lb-bp svg {
          position: relative;
          width: 100%;
          max-width: 980px;
          height: auto;
          max-height: calc(100vh - 56px);
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

        .lb-side {
          position: relative;
          background: var(--card);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          color: var(--tx);
        }

        .lb-box {
          width: 100%;
          max-width: 340px;
        }

        .lb-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font: 600 13px "Barlow Semi Condensed", sans-serif;
          letter-spacing: .04em;
          color: var(--mut);
          margin-bottom: 18px;
        }

        .lb-box h1 {
          font: 600 28px/1.1 "Barlow Semi Condensed", sans-serif;
          margin: 0 0 6px;
          color: var(--tx);
        }

        .lb-sub {
          color: var(--mut);
          margin: 0 0 24px;
          font-size: 13px;
        }

        .lb-label {
          display: block;
          font-size: 12px;
          color: var(--mut);
          margin: 14px 0 5px;
        }

        .lb-input {
          width: 100%;
          padding: 11px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--in);
          color: var(--tx);
          font-family: inherit;
          font-size: 14px;
        }

        .lb-input:focus-visible,
        .lb-btn:focus-visible {
          outline: 2px solid var(--acc);
          outline-offset: 2px;
        }

        .lb-btn {
          width: 100%;
          margin-top: 22px;
          padding: 12px;
          border: 0;
          border-radius: 6px;
          background: var(--btn);
          color: var(--btx);
          font: 500 14px "IBM Plex Mono", monospace;
          cursor: pointer;
          transition: filter 0.15s, opacity 0.15s;
        }

        .lb-btn:hover:not(:disabled) {
          filter: brightness(1.12);
        }

        .lb-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lb-pw {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          letter-spacing: .08em;
          color: var(--mut);
        }

        .lb-foot {
          margin-top: 26px;
          font-size: 11px;
          color: var(--mut);
        }

        .lb-zb {
          position: absolute;
          left: 16px;
          bottom: 16px;
          width: auto;
          margin: 0;
          padding: 7px 12px;
          background: transparent;
          border: 1px solid var(--ln2);
          color: var(--ln);
          font-size: 12px;
          border-radius: 4px;
          cursor: pointer;
          font-family: "IBM Plex Mono", monospace;
          transition: background 0.15s;
        }

        .lb-zb:hover {
          background: rgba(255, 255, 255, .08);
          filter: none;
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
        .ev .tn { font: 500 7px "Barlow Semi Condensed", sans-serif; fill: var(--ln); letter-spacing: .08em; }
        .ev .lg { font: 500 4.2px "IBM Plex Mono", monospace; fill: var(--ln); }
        .ev .lg i { fill: var(--ln2); font-style: italic; }
        .ev .ttl { font: 600 9px "Barlow Semi Condensed", sans-serif; fill: var(--ln); letter-spacing: .05em; }
        .ev .tti { font: italic 500 6.5px "Barlow Semi Condensed", sans-serif; fill: var(--ln2); }
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

        @media (max-width: 820px) {
          .lb-wrap { grid-template-columns: 1fr; }
          .lb-bp { padding: 16px 10px; }
          .lb-side { padding: 28px 20px 48px; }
        }
      `}</style>

      <div className="lb-wrap">
        {/* Panel Kiri: Ilustrasi Blueprint Warehouse 2 interaktif 3 tahap */}
        <div className="lb-bp">
          <svg
            id="bp"
            ref={svgRef}
            viewBox="-30 -22 785 500"
            role="button"
            tabIndex={0}
            aria-pressed="false"
            aria-label="Denah Warehouse 2. Aktifkan untuk zoom ke area Mechanic"
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

          <button className="lb-zb" id="zb" ref={zbRef} type="button">
            Zoom ke Mechanic
          </button>
        </div>

        {/* Panel Kanan: Form Login */}
        <div className="lb-side">
          <div className="lb-box">
            <div className="lb-brand">
              <img
                src="/logo-perusahaan.png"
                alt="PT. WINNERS INTERNATIONAL"
                className="w-6 h-6 object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span>PT. WINNERS INTERNATIONAL</span>
            </div>
            <h1>MACHINE ASSET MANAGEMENT</h1>
            <p className="lb-sub">Login</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="flex items-center justify-between mt-3 mb-1">
                <label className="lb-label !my-0" htmlFor="u">
                  NIK / Username
                </label>
                {capsLockOn && (
                  <span className="text-[10px] font-bold text-amber-500 font-mono tracking-wider animate-pulse">
                    Caps Lock aktif
                  </span>
                )}
              </div>
              <input
                id="u"
                className="lb-input"
                type="text"
                autoComplete="username"
                value={nik}
                disabled={isLoading}
                onChange={(e) => {
                  setErrorMessage(null);
                  setNik(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyDown}
                placeholder="20xxxxxx"
                required
              />

              <div className="flex items-center justify-between mt-3 mb-1">
                <label className="lb-label !my-0" htmlFor="p">
                  Password
                </label>
                {capsLockOn && (
                  <span className="text-[10px] font-bold text-amber-500 font-mono tracking-wider animate-pulse">
                    Caps Lock aktif
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="p"
                  className="lb-input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  disabled={isLoading}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setPassword(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer p-0.5"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMessage && (
                <div className="mt-3 p-2.5 rounded border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                  {errorMessage}
                </div>
              )}

              <button className="lb-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Memverifikasi...' : 'Masuk'}
              </button>
            </form>
          </div>

          <div className="lb-pw">
            <span>POWERED BY ME TEAM &amp; PROD. SUPPORT</span>
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 transition-colors ${
                isServerConnected === true
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : isServerConnected === false
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-amber-400 animate-pulse'
              }`}
              title={
                isServerConnected === true
                  ? 'Server Terhubung'
                  : isServerConnected === false
                  ? 'Server Tidak Terhubung'
                  : 'Memeriksa...'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

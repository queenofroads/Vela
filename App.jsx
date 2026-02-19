import { useState, useEffect, useRef } from "react";

const FONTS = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap";
const C = {
  bg:'#07070f', surface:'#0e0e1c', surface2:'#14142a',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.13)',
  lime:'#d4f73c', coral:'#ff6b4a', sky:'#38bdf8',
  accent:'#5b4cfa', text:'#f0efff', muted:'#7878a0'
};

const CSS = `
  @import url('${FONTS}');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:${C.bg};color:${C.text};overflow:hidden}
  @keyframes slideUp{from{transform:translateY(110%);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes stampIn{from{transform:scale(2.4) rotate(-3deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
  textarea:focus,input:focus,select:focus{outline:none;border-color:${C.accent}!important}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:${C.border2};border-radius:2px}
`;

function cleanLine(raw) {
  return raw.replace(/^\s*[\*\-•\d\.]+\s*/,'').replace(/[""]/g,'"').trim();
}

function chunkQuote(quote, accent) {
  const words = quote.toUpperCase().split(' ').filter(Boolean);
  if (words.length <= 3) {
    return words.map((w,i)=>({ text:w, color:i===0?accent:'#ffffff', size:'large', delay:0.08+i*0.16 }));
  }
  if (words.length <= 6) {
    const m = Math.ceil(words.length/2);
    return [
      { text:words.slice(0,m).join(' '), color:accent, size:'large', delay:0.08 },
      { text:words.slice(m).join(' '), color:'#ffffff', size:'large', delay:0.26 }
    ];
  }
  const c = Math.ceil(words.length/3);
  return [
    { text:words.slice(0,c).join(' '), color:accent, size:'medium', delay:0.08 },
    { text:words.slice(c,c*2).join(' '), color:'#ffffff', size:'medium', delay:0.22 },
    { text:words.slice(c*2).join(' '), color:C.muted, size:'small', delay:0.36 }
  ];
}

async function aiReel(quote, accent, preset) {
  const sys = 'Return ONLY a JSON object. No text before or after. No markdown fences. Example output: {"bg":"#050505","layout":"kinetic","lines":[{"text":"START NOW","color":"#d4f73c","size":"large","delay":0.08},{"text":"YOUR TIME","color":"#ffffff","size":"large","delay":0.24}]}. Rules: bg=dark hex color. layout=kinetic or stamp. lines=array of 2-3 objects with text(ALL CAPS short phrase), color(hex), size(large|medium|small), delay(number 0.08 to 0.5).';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({
      model:'claude-haiku-4-5-20251001', max_tokens:200, system:sys,
      messages:[{role:'user',content:`Reel for: "${quote}". Accent color: ${accent}. Style: ${preset}`}]
    })
  });
  if (!res.ok) throw new Error('API '+res.status);
  const d = await res.json();
  const raw = d.content?.[0]?.text?.trim()||'';
  const m = raw.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const fixed = m[0].replace(/,\s*([}\]])/g,'$1');
    const p = JSON.parse(fixed);
    return { bg:p.bg||'#000', layout:p.layout||'kinetic', lines:Array.isArray(p.lines)?p.lines:[], shapes:[], stat:null };
  } catch(e) { return null; }
}

function ReelPreview({ reel, font, style }) {
  const sz = { large:'clamp(1.6rem,5vw,4rem)', medium:'clamp(1.1rem,3.5vw,2.5rem)', small:'clamp(0.8rem,2vw,1.4rem)' };
  if (!reel) return <div style={{ ...style, background:'#000', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ color:C.muted, fontSize:'0.7rem' }}>Select a reel</div></div>;
  return (
    <div style={{ ...style, background:reel.bg||'#000', overflow:'hidden', position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:`'${font}',sans-serif`, textAlign:reel.layout==='stamp'?'left':'center', padding:'14px 18px', zIndex:2, position:'relative', width:'100%', lineHeight:0.88 }}>
        {(reel.lines||[]).map((l,i)=>(
          reel.layout==='stamp'
            ? <div key={i} style={{ fontSize:sz[l.size]||sz.large, color:l.color||'#fff', animation:`stampIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) ${l.delay||0.1}s both`, lineHeight:0.9, marginBottom:4 }}>{l.text}</div>
            : <div key={i} style={{ overflow:'hidden', marginBottom:2 }}>
                <span style={{ display:'inline-block', fontSize:sz[l.size]||sz.large, color:l.color||'#fff', animation:`slideUp 0.6s cubic-bezier(0.22,1,0.36,1) ${l.delay||0.1}s both`, lineHeight:0.92 }}>{l.text}</span>
              </div>
        ))}
      </div>
    </div>
  );
}

export default function Vela() {
  const [screen, setScreen] = useState('input');
  const [rawText, setRawText] = useState('A year from today, you\'ll regret not starting now.\n365 days from now, you\'ll thank yourself for beginning today.\nThis time next year, you\'ll either have results or excuses.\nFuture you is begging you to start today.\nThe clock is moving anyway. Where do you want to be next year?');
  const [reels, setReels] = useState([]);
  const [selected, setSelected] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genPct, setGenPct] = useState(0);
  const [genMsg, setGenMsg] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [font, setFont] = useState('Bebas Neue');
  const [accent, setAccent] = useState(C.lime);
  const [preset, setPreset] = useState('Kinetic Type');
  const [ratio, setRatio] = useState('9:16');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const tlRef = useRef(null);
  const startRef = useRef(null);
  const canvasRef = useRef(null);

  async function loadHtml2Canvas() {
    if (window.html2canvas) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function downloadReel() {
    if (!cur || !canvasRef.current) return;
    setDownloading(true);
    try {
      await loadHtml2Canvas();
      const canvas = await window.html2canvas(canvasRef.current, {
        backgroundColor: cur.bg || '#000', scale: 2, useCORS: true, logging: false
      });
      const link = document.createElement('a');
      const name = (cur._q || 'reel').slice(0,30).replace(/[^a-zA-Z0-9]/g,'-').toLowerCase();
      link.download = `vela-${selected+1}-${name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch(e) { alert('Download failed: ' + e.message); }
    setDownloading(false);
  }

  async function downloadAll() {
    if (!reels.length) return;
    setDownloading(true);
    try {
      await loadHtml2Canvas();
      for (let i = 0; i < reels.length; i++) {
        setSelected(i);
        await new Promise(r => setTimeout(r, 700));
        if (!canvasRef.current) continue;
        const canvas = await window.html2canvas(canvasRef.current, {
          backgroundColor: reels[i].bg || '#000', scale: 2, useCORS: true, logging: false
        });
        const link = document.createElement('a');
        const name = (reels[i]._q||'reel').slice(0,30).replace(/[^a-zA-Z0-9]/g,'-').toLowerCase();
        link.download = `vela-${i+1}-${name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        await new Promise(r => setTimeout(r, 500));
      }
    } catch(e) { alert('Download failed: ' + e.message); }
    setDownloading(false);
  }

  const quotes = rawText.split('\n').map(cleanLine).filter(q=>q.length>3);

  useEffect(()=>{
    if (playing && reels.length > 0) {
      startRef.current = Date.now();
      tlRef.current = setInterval(()=>{
        const pct = ((Date.now()-startRef.current)/5000)*100;
        if (pct >= 100) {
          startRef.current = Date.now();
          setProgress(0);
          setSelected(i=>(i+1)%reels.length);
        } else setProgress(pct);
      }, 40);
    } else clearInterval(tlRef.current);
    return ()=>clearInterval(tlRef.current);
  }, [playing, reels.length]);

  useEffect(()=>setProgress(0), [selected]);

  async function generate() {
    if (!quotes.length) return;
    setReels([]); setGenerating(true); setGenPct(0); setSelected(0);
    setScreen('app');
    const results = [];
    for (let i=0; i<quotes.length; i++) {
      setGenMsg(`Reel ${i+1} of ${quotes.length}`);
      let reel = null;
      if (useAI) { try { reel = await aiReel(quotes[i], accent, preset); } catch(e){} }
      if (!reel) reel = { bg:'#000', layout:'kinetic', lines:chunkQuote(quotes[i], accent), shapes:[], stat:null };
      reel._q = quotes[i];
      results.push(reel);
      setReels([...results]);
      setGenPct(Math.round(((i+1)/quotes.length)*100));
    }
    setGenerating(false); setGenMsg(''); setPlaying(true);
  }

  const dims = ratio==='9:16' ? {width:230,aspectRatio:'9/16'} : ratio==='16:9' ? {width:'100%',maxWidth:500,aspectRatio:'16/9'} : {width:300,aspectRatio:'1/1'};
  const cur = reels[selected]||null;

  // ── INPUT SCREEN ───────────────────────────────────────
  if (screen==='input') return (
    <>
      <style>{CSS}</style>
      <div style={{ height:'100vh', background:C.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:C.surface, flexShrink:0 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.5rem', color:C.lime, letterSpacing:'0.06em' }}>VELA</div>
          <div style={{ fontSize:'0.75rem', color:C.muted }}>{quotes.length} reels queued</div>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:16, maxWidth:600, margin:'0 auto', width:'100%' }}>
          <div>
            <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.8rem', letterSpacing:'0.04em', marginBottom:4 }}>Paste your quotes</h2>
            <p style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.6 }}>One quote per line. Bullets and numbers cleaned automatically. Each line = one reel.</p>
          </div>

          <textarea
            value={rawText}
            onChange={e=>setRawText(e.target.value)}
            style={{ width:'100%', minHeight:180, background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:10, color:C.text, padding:'12px 14px', fontFamily:'DM Sans,sans-serif', fontSize:'0.82rem', lineHeight:1.7, resize:'vertical' }}
          />

          {/* Settings row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:'0.64rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Style</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {['Kinetic Type','Stamp','Minimal'].map(p=>(
                  <button key={p} onClick={()=>setPreset(p)} style={{ padding:'5px 10px', background:preset===p?'rgba(212,247,60,0.1)':C.surface2, border:`1px solid ${preset===p?C.lime:C.border}`, borderRadius:6, color:preset===p?C.lime:C.muted, fontSize:'0.72rem', fontFamily:'DM Sans,sans-serif', cursor:'pointer' }}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'0.64rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Ratio</div>
              <div style={{ display:'flex', gap:5 }}>
                {['9:16','16:9','1:1'].map(r=>(
                  <button key={r} onClick={()=>setRatio(r)} style={{ padding:'5px 10px', background:ratio===r?'rgba(212,247,60,0.1)':C.surface2, border:`1px solid ${ratio===r?C.lime:C.border}`, borderRadius:6, color:ratio===r?C.lime:C.muted, fontSize:'0.72rem', fontFamily:'DM Sans,sans-serif', cursor:'pointer' }}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'0.64rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Accent Color</div>
              <div style={{ display:'flex', gap:7 }}>
                {[C.lime,C.coral,C.sky,'#a78bfa','#ffffff'].map(c=>(
                  <div key={c} onClick={()=>setAccent(c)} style={{ width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',border:accent===c?'2px solid #fff':'2px solid transparent',transform:accent===c?'scale(1.2)':'scale(1)',transition:'all 0.15s' }}/>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:'0.64rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Font</div>
              <select value={font} onChange={e=>setFont(e.target.value)} style={{ background:C.surface2, border:`1px solid ${C.border}`, color:C.text, borderRadius:6, padding:'6px 8px', fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', width:'100%' }}>
                <option>Bebas Neue</option><option>Impact</option><option>Georgia</option>
              </select>
            </div>
          </div>

          {/* AI toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:C.surface2, borderRadius:9, border:`1px solid ${C.border}` }}>
            <div onClick={()=>setUseAI(v=>!v)} style={{ width:38,height:20,borderRadius:10,background:useAI?C.lime:C.border2,position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0 }}>
              <div style={{ position:'absolute',width:16,height:16,borderRadius:'50%',background:useAI?'#000':C.muted,top:2,left:useAI?20:2,transition:'left 0.2s' }}/>
            </div>
            <div>
              <div style={{ fontSize:'0.8rem', fontWeight:500 }}>AI Enhancement — {useAI?'On':'Off'}</div>
              <div style={{ fontSize:'0.68rem', color:C.muted }}>On = unique AI-designed reels per quote. Off = instant.</div>
            </div>
          </div>

          <button onClick={generate} disabled={!quotes.length} style={{ width:'100%', padding:'13px', background:`linear-gradient(135deg,${C.accent},#7c6bff)`, color:'#fff', border:'none', borderRadius:10, fontFamily:'DM Sans,sans-serif', fontSize:'0.92rem', fontWeight:600, cursor:'pointer', position:'relative', overflow:'hidden', opacity:quotes.length?1:0.5 }}>
            <div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)',animation:'shimmer 2s infinite' }}/>
            ✦ Generate {quotes.length} Reel{quotes.length!==1?'s':''}
          </button>
        </div>
      </div>
    </>
  );

  // ── APP SCREEN ─────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:C.bg, overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:46, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 14px', gap:10, background:C.surface, flexShrink:0 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'1.3rem', color:C.lime }}>VELA</div>
          <span style={{ color:C.border2, fontSize:'0.9rem' }}>/</span>
          <span style={{ fontSize:'0.75rem', color:C.muted }}>
            {generating ? genMsg : `${reels.length} reels ready`}
          </span>
          {generating && (
            <div style={{ width:80, height:2, background:C.border2, borderRadius:2, overflow:'hidden', marginLeft:4 }}>
              <div style={{ height:'100%', background:C.lime, width:`${genPct}%`, transition:'width 0.3s ease' }}/>
            </div>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:7 }}>
            <button onClick={()=>setScreen('input')} style={{ background:'none', border:`1px solid ${C.border2}`, color:C.muted, padding:'5px 12px', borderRadius:6, fontFamily:'DM Sans,sans-serif', fontSize:'0.72rem', cursor:'pointer' }}>← Edit</button>
          </div>
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* Reel list */}
          <div style={{ width:180, borderRight:`1px solid ${C.border}`, background:C.surface, overflowY:'auto', flexShrink:0 }}>
            <div style={{ padding:'8px 10px', fontSize:'0.6rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, background:C.surface, zIndex:1 }}>
              {reels.length} Reels
            </div>
            {reels.map((r,i)=>(
              <div key={i} onClick={()=>{ setSelected(i); setPlaying(false); setProgress(0); }} style={{ padding:'8px 10px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', background:selected===i?C.surface2:'none', borderLeft:`2px solid ${selected===i?C.lime:'transparent'}`, transition:'all 0.15s' }}>
                <div style={{ width:'100%', aspectRatio:'9/16', background:r.bg||'#000', borderRadius:5, overflow:'hidden', marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.border}`, flexShrink:0 }}>
                  <div style={{ fontFamily:`'${font}',sans-serif`, fontSize:'0.48rem', color:r.lines?.[0]?.color||C.lime, textAlign:'center', padding:3, lineHeight:1, wordBreak:'break-word' }}>
                    {r.lines?.slice(0,2).map(l=>l.text).join(' ')}
                  </div>
                </div>
                <div style={{ fontSize:'0.6rem', color:selected===i?C.text:C.muted, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {r._q}
                </div>
              </div>
            ))}
            {generating && (
              <div style={{ padding:'10px', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:12,height:12,border:`2px solid ${C.border2}`,borderTopColor:C.lime,borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0 }}/>
                <div style={{ fontSize:'0.62rem', color:C.muted }}>Generating…</div>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#050508', position:'relative', padding:'16px 16px 70px', overflow:'hidden' }}>
            <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px)`, backgroundSize:'40px 40px', pointerEvents:'none' }}/>

            <div ref={canvasRef} style={{ ...dims, borderRadius:9, overflow:'hidden', border:`1px solid ${C.border2}`, boxShadow:`0 0 50px rgba(91,76,250,0.1),0 24px 60px rgba(0,0,0,0.7)`, position:'relative', zIndex:1, transition:'all 0.35s ease', flexShrink:0 }}>
              <ReelPreview reel={cur} font={font} style={{ width:'100%', height:'100%' }}/>
            </div>

            {cur?._q && (
              <div style={{ marginTop:12, maxWidth:380, textAlign:'center', fontSize:'0.7rem', color:C.muted, lineHeight:1.55, fontStyle:'italic', position:'relative', zIndex:1 }}>
                "{cur._q}"
              </div>
            )}

            {/* Timeline bar */}
            <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:10, background:'rgba(14,14,28,0.96)', border:`1px solid ${C.border}`, borderRadius:9, padding:'0 12px', height:40, width:'min(400px,88%)', zIndex:2 }}>
              <button onClick={()=>setPlaying(p=>!p)} style={{ width:26,height:26,borderRadius:'50%',background:C.lime,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',flexShrink:0 }}>
                {playing?'⏸':'▶'}
              </button>
              <div style={{ flex:1, height:3, background:C.border2, borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', background:C.lime, width:`${progress}%`, transition:'width 0.04s linear' }}/>
              </div>
              <button onClick={()=>{setSelected(i=>(i-1+reels.length)%reels.length);setProgress(0);}} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'1rem',padding:'0 2px',lineHeight:1 }}>‹</button>
              <span style={{ fontSize:'0.66rem',color:C.muted,fontWeight:600,minWidth:32,textAlign:'center' }}>{selected+1}/{reels.length}</span>
              <button onClick={()=>{setSelected(i=>(i+1)%reels.length);setProgress(0);}} style={{ background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:'1rem',padding:'0 2px',lineHeight:1 }}>›</button>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width:200, borderLeft:`1px solid ${C.border}`, background:C.surface, display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.border}`, fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted }}>Controls</div>
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>
              <div>
                <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Ratio</div>
                <div style={{ display:'flex', gap:4 }}>
                  {['9:16','16:9','1:1'].map(r=>(
                    <button key={r} onClick={()=>setRatio(r)} style={{ flex:1, padding:'5px 2px', background:ratio===r?'rgba(212,247,60,0.1)':C.bg, border:`1px solid ${ratio===r?C.lime:C.border}`, borderRadius:5, color:ratio===r?C.lime:C.muted, fontSize:'0.62rem', fontFamily:'DM Sans,sans-serif', cursor:'pointer' }}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Accent</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[C.lime,C.coral,C.sky,'#a78bfa','#fff'].map(c=>(
                    <div key={c} onClick={()=>setAccent(c)} style={{ width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',border:accent===c?'2px solid #fff':'2px solid transparent',transform:accent===c?'scale(1.2)':'scale(1)',transition:'all 0.15s' }}/>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:'0.62rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginBottom:7 }}>Font</div>
                <select value={font} onChange={e=>setFont(e.target.value)} style={{ background:C.bg, border:`1px solid ${C.border}`, color:C.text, borderRadius:5, padding:'6px 8px', fontFamily:'DM Sans,sans-serif', fontSize:'0.75rem', width:'100%' }}>
                  <option>Bebas Neue</option><option>Impact</option><option>Georgia</option>
                </select>
              </div>
              <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:7 }}>
                <button onClick={downloadReel} disabled={downloading||!cur} style={{ width:'100%', padding:'9px', background:downloading?'rgba(212,247,60,0.4)':C.lime, color:'#000', border:'none', borderRadius:7, fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', opacity:!cur?0.5:1 }}>
                  {downloading ? '⏳ Saving…' : '↓ Download This'}
                </button>
                <button onClick={downloadAll} disabled={downloading||!reels.length} style={{ width:'100%', padding:'9px', background:'none', color:C.lime, border:`1px solid ${C.lime}`, borderRadius:7, fontFamily:'DM Sans,sans-serif', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', opacity:!reels.length?0.5:1 }}>
                  ↓ Download All ({reels.length})
                </button>
                <button onClick={()=>setScreen('input')} style={{ width:'100%', padding:'8px', background:'none', color:C.muted, border:`1px solid ${C.border}`, borderRadius:7, fontFamily:'DM Sans,sans-serif', fontSize:'0.75rem', cursor:'pointer' }}>
                  + New batch
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

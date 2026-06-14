const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

.dg-root{
  --ink:#14110E; --panel:#211C17; --felt:#2C1622; --felt2:#3A1C2C;
  --gold:#D8A24A; --gold-hi:#F2CB72; --cream:#F2EBDD; --muted:#9C8E78;
  --win:#74C690; --lose:#DC7C68; --line:#3A322A;
  font-family:'DM Sans',system-ui,sans-serif;
  min-height:100vh; width:100%;
  background:
    radial-gradient(120% 90% at 50% -10%, #2a231b 0%, var(--ink) 55%);
  color:var(--cream);
  display:flex; justify-content:center; align-items:center;
  padding:32px 24px 48px;
  box-sizing:border-box;
}
.dg-root *{box-sizing:border-box;}

.table{ width:100%; max-width:560px; }

/* HEADER */
.hd{ display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }
.hd__brand{ display:flex; align-items:center; gap:10px; }
.hd__pip{
  width:14px;height:14px;border-radius:3px;background:var(--cream);
  box-shadow:0 0 0 2px #0006 inset, 0 2px 6px #0008;
  position:relative;
}
.hd__pip::after{content:"";position:absolute;inset:0;margin:auto;width:4px;height:4px;border-radius:50%;background:var(--felt);}
.hd__title{
  font-family:'Fraunces',serif; font-weight:600; font-size:24px; letter-spacing:.3px;
  margin:0; color:var(--cream);
}
.wallet{
  display:flex; align-items:baseline; gap:6px;
  background:linear-gradient(180deg,#2a241d,#1b1712);
  border:1px solid var(--line); border-radius:14px;
  padding:9px 14px; cursor:pointer; color:var(--cream);
  transition:transform .15s ease, border-color .15s ease;
}
.wallet:hover:not(:disabled){ border-color:var(--gold); transform:translateY(-1px); }
.wallet__label{ font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }
.wallet__amt{ font-family:'Space Mono',monospace; font-weight:700; font-size:18px; color:var(--gold-hi); }
.wallet__coin{ font-size:11px; color:var(--muted); }

/* TRAY */
.tray{
  background:radial-gradient(120% 120% at 50% 0%, var(--felt2), var(--felt));
  border:1px solid #4a2536; border-radius:22px;
  padding:28px 20px 22px;
  box-shadow:0 18px 40px -20px #000, inset 0 1px 0 #ffffff14;
  margin-bottom:20px;
}
.tray__felt{ display:flex; gap:22px; justify-content:center; align-items:center; }

.die{
  width:74px;height:74px;border-radius:16px;
  background:linear-gradient(145deg,#FBF7EE,#E7DEC9);
  box-shadow:0 8px 16px -6px #000a, inset 0 2px 3px #fff, inset 0 -6px 10px #00000018;
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s ease;
}
.die__grid{
  width:54px;height:54px;
  display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
  gap:2px;
}
.pip{ width:100%;height:100%;display:flex;align-items:center;justify-content:center; }
.pip--on::after{
  content:"";width:11px;height:11px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%, #5a2a1c, #2a0f0a);
  box-shadow:inset 0 1px 1px #00000050;
}
.die--rolling{ animation:tumble .28s linear infinite; }
@keyframes tumble{
  0%{transform:translateY(0) rotate(-6deg);}
  25%{transform:translateY(-8px) rotate(5deg);}
  50%{transform:translateY(0) rotate(-3deg);}
  75%{transform:translateY(-5px) rotate(7deg);}
  100%{transform:translateY(0) rotate(-6deg);}
}

.verdict{ min-height:64px; display:flex; align-items:center; justify-content:center; margin-top:18px; }
.verdict__idle{ color:#e9dcc7aa; font-size:14px; }
.verdict__rolling{ color:var(--gold-hi); font-family:'Space Mono',monospace; font-size:15px; letter-spacing:1px; }
.verdict__box{ display:flex; align-items:center; gap:14px; }
.verdict__sum{
  font-family:'Fraunces',serif; font-weight:700; font-size:40px; line-height:1;
  width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:#0003; border:1px solid #ffffff22;
}
.verdict__parity{ font-family:'Space Mono',monospace; font-weight:700; letter-spacing:2px; font-size:16px; }
.verdict__msg{ font-size:13px; color:#fff; opacity:.9; }
.verdict__box--win .verdict__sum{ color:var(--win); border-color:var(--win); box-shadow:0 0 22px -6px var(--win); }
.verdict__box--lose .verdict__sum{ color:var(--lose); border-color:var(--lose); }
.verdict__box--win .verdict__parity{ color:var(--win); }
.verdict__box--lose .verdict__parity{ color:var(--lose); }

/* BLOCKS */
.block{ margin-bottom:18px; }
.block__label{
  font-size:11px; text-transform:uppercase; letter-spacing:1.4px;
  color:var(--muted); margin-bottom:9px; padding-left:2px;
}
.choices{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.choice{
  display:flex;flex-direction:column;gap:3px;align-items:flex-start;
  background:var(--panel); border:1px solid var(--line); border-radius:14px;
  padding:13px 15px; cursor:pointer; color:var(--cream);
  font-family:'Fraunces',serif; font-weight:600; font-size:19px;
  transition:all .15s ease;
}
.choice small{ font-family:'Space Mono',monospace; font-weight:400; font-size:10.5px; color:var(--muted); }
.choice:hover:not(:disabled){ border-color:#6a5b48; }
.choice--on{ border-color:var(--gold); background:linear-gradient(180deg,#34291b,#241c12); box-shadow:0 0 0 1px var(--gold) inset; }
.choice--on small{ color:var(--gold-hi); }

.bets{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.bet{
  background:var(--panel); border:1px solid var(--line); border-radius:12px;
  padding:13px 4px; cursor:pointer; color:var(--cream);
  font-family:'Space Mono',monospace; font-weight:700; font-size:14px;
  transition:all .15s ease;
}
.bet:hover:not(:disabled){ border-color:#6a5b48; }
.bet--on{ border-color:var(--gold); color:var(--ink); background:linear-gradient(180deg,var(--gold-hi),var(--gold)); }
.bet:disabled{ opacity:.32; cursor:not-allowed; }

/* ROLL */
.roll{
  width:100%; margin-top:6px; padding:17px;
  border:none; border-radius:16px; cursor:pointer;
  font-family:'Fraunces',serif; font-weight:600; font-size:18px; letter-spacing:.3px;
  color:var(--ink);
  background:linear-gradient(180deg,var(--gold-hi),var(--gold));
  box-shadow:0 10px 24px -10px var(--gold), inset 0 1px 0 #ffffff70;
  transition:transform .12s ease, filter .15s ease;
}
.roll:hover:not(:disabled){ transform:translateY(-1px); filter:brightness(1.05); }
.roll:active:not(:disabled){ transform:translateY(1px); }
.roll:disabled{
  background:#2a241d; color:var(--muted); box-shadow:none; cursor:not-allowed;
}
.broke{ text-align:center; color:var(--lose); font-size:13px; margin-top:14px; }

/* TOAST */
.toast{
  position:fixed; left:50%; top:28px; transform:translateX(-50%);
  padding:12px 20px; border-radius:999px; font-weight:600; font-size:14px;
  font-family:'Space Mono',monospace;
  box-shadow:0 12px 30px -10px #000; z-index:30;
  animation:rise .25s ease;
}
@keyframes rise{ from{ opacity:0; transform:translate(-50%,-10px);} to{ opacity:1; transform:translate(-50%,0);} }
.toast--win{ background:var(--win); color:#0c2415; }
.toast--lose{ background:var(--lose); color:#2a0c08; }
.toast--warn{ background:#E8C26A; color:#2a1f08; }

/* MODAL */
.modal{
  position:fixed; inset:0; background:#000000b0; backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; z-index:40; padding:20px;
  animation:fade .2s ease;
}
@keyframes fade{ from{opacity:0;} to{opacity:1;} }
.modal__card{
  width:100%; max-width:360px; background:var(--panel);
  border:1px solid var(--line); border-radius:20px; padding:24px;
  box-shadow:0 30px 60px -20px #000;
}
.modal__title{ font-family:'Fraunces',serif; font-weight:600; margin:0 0 4px; font-size:22px; }
.modal__sub{ color:var(--muted); font-size:13px; margin:0 0 16px; }
.modal__input{
  width:100%; padding:13px 14px; border-radius:12px;
  background:var(--ink); border:1px solid var(--line); color:var(--cream);
  font-family:'Space Mono',monospace; font-size:15px; letter-spacing:1px;
  outline:none; transition:border-color .15s ease;
}
.modal__input:focus{ border-color:var(--gold); }
.modal__actions{ display:flex; gap:10px; margin-top:14px; }
.btn{ flex:1; padding:12px; border-radius:12px; cursor:pointer; font-weight:600; font-size:14px; border:1px solid var(--line); }
.btn--ghost{ background:transparent; color:var(--muted); }
.btn--ghost:hover{ color:var(--cream); border-color:#6a5b48; }
.btn--gold{ background:linear-gradient(180deg,var(--gold-hi),var(--gold)); color:var(--ink); border:none; }
.btn--gold:hover{ filter:brightness(1.05); }
.modal__hint{ text-align:center; color:var(--muted); font-size:12px; margin:14px 0 0; }
.modal__hint code{ font-family:'Space Mono',monospace; color:var(--gold-hi); }

@media (prefers-reduced-motion: reduce){
  .die--rolling{ animation:none; }
  .toast{ animation:none; }
}
@media (max-width: 480px){
  .dg-root{ padding:8px 8px 40px; align-items:flex-start; }
  .bets{ grid-template-columns:repeat(2,1fr); }
}
`;

export default css;

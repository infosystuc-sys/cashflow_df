// App.jsx — shell, navegación, ajustes y tweaks
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2f6df0",
  "galicia": "#e87613",
  "nacion": "#1f7fc4",
  "density": "regular",
  "uiScale": 100
}/*EDITMODE-END*/;

function Ajustes({ state, dispatch }) {
  const setSaldo = (bank, v) => dispatch((s) => ({ ...s, settings: { ...s.settings, saldoInicial: { ...s.settings.saldoInicial, [bank]: v } } }));
  const setRange = (k, v) => dispatch((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  // generar opciones de meses 2024-01 .. 2028-12
  const monthOpts = [];
  let k = "2024-01";
  for (let i = 0; i < 60; i++) { monthOpts.push(k); k = CF.addMonth(k, 1); }

  const doReset = () => {
    if (confirm("Esto restaura los datos de ejemplo y borra tus cambios guardados. ¿Continuar?")) {
      dispatch(() => CF.resetState(), true);
    }
  };

  return (
    <div className="view">
      <div className="view-head"><div><h1>Ajustes</h1><p className="view-sub">Saldos iniciales, rango del cashflow y datos.</p></div></div>

      <div className="settings-card">
        <h3>Saldo inicial por banco</h3>
        <div className="settings-grid">
          {CF.BANKS.map((b) => (
            <Field key={b.id} label={b.name}>
              <MoneyInput value={state.settings.saldoInicial[b.id]} onChange={(v) => setSaldo(b.id, v)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Rango de meses del cashflow</h3>
        <div className="settings-grid">
          <Field label="Mes inicial">
            <select className="inp" value={state.settings.rangeStart} onChange={(e) => setRange("rangeStart", e.target.value)}>
              {monthOpts.map((m) => <option key={m} value={m}>{CF.monthLabel(m)}</option>)}
            </select>
          </Field>
          <Field label="Mes final">
            <select className="inp" value={state.settings.rangeEnd} onChange={(e) => setRange("rangeEnd", e.target.value)}>
              {monthOpts.map((m) => <option key={m} value={m}>{CF.monthLabel(m)}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="settings-card">
        <h3>Datos</h3>
        <p className="settings-note">Todo se guarda automáticamente en este navegador.</p>
        <button className="btn btn--danger" onClick={doReset}>Restaurar datos de ejemplo</button>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useStateA(CF.loadState);
  const [view, setView] = useStateA("mov");
  const [collapsed, setCollapsed] = useStateA(() => {
    try { return localStorage.getItem("cf_sidebar_collapsed") === "1"; } catch (e) { return false; }
  });
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const toggleCollapsed = () => setCollapsed((c) => {
    const nv = !c;
    try { localStorage.setItem("cf_sidebar_collapsed", nv ? "1" : "0"); } catch (e) {}
    return nv;
  });

  const dispatch = (updater, skipPersist) => {
    setState((prev) => {
      const next = updater(prev);
      if (!skipPersist) CF.saveState(next);
      else CF.saveState(next);
      return next;
    });
  };

  // aplica tweaks a las variables CSS
  useEffectA(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", t.accent);
    r.setProperty("--galicia", t.galicia);
    r.setProperty("--nacion", t.nacion);
    r.setProperty("--ui-scale", (t.uiScale / 100).toString());
    document.body.dataset.density = t.density;
  }, [t]);

  const nav = [
    { id: "mov", label: "Movimientos", icon: "↹" },
    { id: "proy", label: "Proyección", icon: "◳" },
    { id: "cf", label: "Cashflow", icon: "▦" },
    { id: "set", label: "Ajustes", icon: "⚙" },
  ];

  const cierre = useMemoA(() => {
    const cf = CF.buildCashflow(state);
    const last = cf.rows[cf.rows.length - 1];
    return last ? last.cierreTotal : 0;
  }, [state]);

  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">$</div>
          <div className="brand-txt"><strong>CASHFLOW</strong><span>Galicia · Nación</span></div>
          <button className="collapse-btn" onClick={toggleCollapsed} title={collapsed ? "Expandir menú" : "Replegar menú"} aria-label="Replegar menú">
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <button key={n.id} className={"nav-item" + (view === n.id ? " active" : "")} onClick={() => setView(n.id)} title={n.label}>
              <span className="nav-ico">{n.icon}</span><span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="foot-k">Cierre Banco + FCI</span>
          <span className="foot-v">{CF.money(cierre, false)}</span>
        </div>
      </aside>

      <main className="main">
        {view === "mov" && <Movimientos state={state} dispatch={dispatch} />}
        {view === "proy" && <Proyeccion state={state} dispatch={dispatch} />}
        {view === "cf" && <Resumen state={state} />}
        {view === "set" && <Ajustes state={state} dispatch={dispatch} />}
      </main>

      <TweaksPanel>
        <TweakSection label="Color de acento" />
        <TweakColor label="Acento" value={t.accent} options={["#2f6df0", "#1f8a5b", "#7a4ddb", "#0f766e", "#b8860b"]} onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Colores de banco" />
        <TweakColor label="Galicia" value={t.galicia} options={["#e87613", "#ea580c", "#d9480f", "#b45309"]} onChange={(v) => setTweak("galicia", v)} />
        <TweakColor label="Nación" value={t.nacion} options={["#1f7fc4", "#1d4ed8", "#0369a1", "#0e7490"]} onChange={(v) => setTweak("nacion", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Densidad" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Escala UI" value={t.uiScale} min={85} max={115} step={5} unit="%" onChange={(v) => setTweak("uiScale", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

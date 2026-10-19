import { useState } from "react";
import { COLOR_SWATCHES, SHAPE_OPTIONS, type CompanionAppearance } from "../../lib/character";
import type { PactCompanion } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";
export function NewPact({ initial, onCreate, onCancel }: { initial?: CompanionAppearance; onCreate: (companion: PactCompanion) => void; onCancel: () => void }) {
 const [name, setName] = useState("Pact");
 const [appearance, setAppearance] = useState<CompanionAppearance>(initial ?? { shape: 0, color: "#F59E0B", v: 2 });
 return <form className="new-pact" onSubmit={(e) => { e.preventDefault(); onCreate({ name: name.trim() || "Pact", appearance }); }}>
  <PactBlob size={40} state="still" appearance={appearance} />
  <label>Companion name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
  <label>Shape<select value={appearance.shape} onChange={(e) => setAppearance({ ...appearance, shape: Number(e.target.value), v: 2 })}>{SHAPE_OPTIONS.map((s) => <option key={s.shape} value={s.shape}>{s.name}</option>)}</select></label>
  <div className="swatches" aria-label="Companion color">{COLOR_SWATCHES.map((s) => <button className="swatch" key={s.color} type="button" title={s.name} aria-label={s.name} aria-pressed={appearance.color === s.color} style={{ background: s.color }} onClick={() => setAppearance({ ...appearance, color: s.color })} />)}</div>
  <p className="new-pact-note">This companion belongs to this Pact. Its name, shape and color are final once you create it.</p>
  <div className="new-pact-actions"><button type="submit">Create Pact</button><button type="button" onClick={onCancel}>Cancel</button></div>
 </form>;
}

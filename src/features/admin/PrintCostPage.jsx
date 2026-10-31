import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Calculator, CircleDollarSign, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const blankFilament = { name: '', material: 'PLA', color: '', spool_weight_g: '1000', spool_price: '', active: true };
const money = value => formatCurrency(Number.isFinite(value) ? value : 0);
const number = value => Math.max(0, Number(value) || 0);

export default function PrintCostPage() {
  const [session, setSession] = useState(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [filaments, setFilaments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(blankFilament);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quote, setQuote] = useState({ grams: '35', hours: '2', minutes: '30', waste: '10', power: '120', kwhPrice: '0.90', machineHour: '2.00', laborMinutes: '10', laborHour: '20', overhead: '10', margin: '30' });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) { setChecking(false); return; }
      const { data: admin } = await supabase.from('catalog_admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
      if (!alive) return;
      setAuthorized(Boolean(admin));
      if (admin) await loadFilaments();
      if (alive) setChecking(false);
    }).catch(() => { if (alive) { setSession(null); setChecking(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadFilaments() {
    const { data, error: loadError } = await supabase.from('filament_types').select('*').order('name');
    if (loadError) setError('Não foi possível carregar os filamentos. Confira se executou a migration do banco.');
    else {
      setFilaments(data || []);
      setSelectedId(current => (data || []).some(item => item.id === current && item.active) ? current : ((data || []).find(item => item.active)?.id || ''));
    }
  }

  const selected = filaments.find(item => item.id === selectedId && item.active);
  const totals = useMemo(() => {
    const grams = number(quote.grams);
    const waste = number(quote.waste) / 100;
    const effectiveGrams = grams * (1 + waste);
    const filament = selected ? effectiveGrams / number(selected.spool_weight_g) * number(selected.spool_price) : 0;
    const printHours = number(quote.hours) + number(quote.minutes) / 60;
    const electricity = printHours * (number(quote.power) / 1000) * number(quote.kwhPrice);
    const machine = printHours * number(quote.machineHour);
    const labor = number(quote.laborMinutes) / 60 * number(quote.laborHour);
    const subtotal = filament + electricity + machine + labor;
    const overhead = subtotal * number(quote.overhead) / 100;
    const cost = subtotal + overhead;
    const margin = Math.min(99, number(quote.margin)) / 100;
    const suggested = cost / (1 - margin);
    return { grams, effectiveGrams, filament, printHours, electricity, machine, labor, subtotal, overhead, cost, suggested, profit: suggested - cost };
  }, [quote, selected]);

  function updateQuote(key, value) { setQuote(current => ({ ...current, [key]: value })); }
  function resetFilamentForm() { setForm(blankFilament); setEditingId(null); }
  function editFilament(item) {
    setEditingId(item.id);
    setForm({ name: item.name, material: item.material, color: item.color || '', spool_weight_g: String(item.spool_weight_g), spool_price: String(item.spool_price), active: item.active });
    setError(''); setNotice('');
  }
  async function saveFilament(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const payload = { name: form.name.trim(), material: form.material, color: form.color.trim(), spool_weight_g: number(form.spool_weight_g), spool_price: number(form.spool_price), active: form.active };
    if (!payload.name || payload.spool_weight_g <= 0 || payload.spool_price < 0) { setError('Preencha o nome, o peso válido do rolo e o preço.'); setBusy(false); return; }
    const result = editingId
      ? await supabase.from('filament_types').update(payload).eq('id', editingId).select().single()
      : await supabase.from('filament_types').insert(payload).select().single();
    if (result.error) setError('Não foi possível salvar. Verifique a migration e as permissões do banco.');
    else {
      await loadFilaments();
      if (result.data?.id) setSelectedId(result.data.id);
      setNotice(editingId ? 'Filamento atualizado.' : 'Filamento cadastrado.');
      resetFilamentForm();
    }
    setBusy(false);
  }
  async function toggleActive(item) {
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('filament_types').update({ active: !item.active }).eq('id', item.id);
    if (updateError) setError('Não foi possível atualizar o filamento.');
    else { await loadFilaments(); setNotice(item.active ? 'Filamento desativado.' : 'Filamento reativado.'); }
    setBusy(false);
  }
  async function deleteFilament(item) {
    if (!window.confirm('Excluir o filamento "' + item.name + '"?')) return;
    setBusy(true); setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('filament_types').delete().eq('id', item.id);
    if (deleteError) setError('Não foi possível excluir o filamento.');
    else { await loadFilaments(); setNotice('Filamento excluído.'); if (editingId === item.id) resetFilamentForm(); }
    setBusy(false);
  }

  if (!isSupabaseConfigured) return <Navigate to="/adm" replace />;
  if (checking || session === undefined) return <div className="empty-state">Verificando sessão e permissões...</div>;
  if (!session || !authorized) return <Navigate to="/adm" replace />;

  return <><Header admin/><main className="admin-main print-cost-main">
    <Link className="back-link" to="/adm/painel"><ArrowLeft size={15}/> Voltar ao painel</Link>
    <div className="admin-title-row"><div><span className="eyebrow"><Calculator size={14}/> FERRAMENTA INTERNA</span><h1>Calculadora de<br/><em>custo 3D.</em></h1><p>Estime o custo de uma peça antes de definir o preço de venda.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
    <section className="admin-editor">
      <div className="admin-section-heading"><div><h2>Orçamento da peça</h2><p>Preencha os dados do fatiador e os custos que deseja considerar.</p></div></div>
      {!filaments.some(item => item.active) && <div className="setup-notice"><strong>Cadastre um filamento para começar.</strong><span>Adicione o tipo de material, o peso do rolo e o preço pago nele.</span></div>}
      <div className="print-calculator-grid">
        <div className="print-fields">
          <label>Filamento<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Selecione um filamento</option>{filaments.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.material}{item.color ? ' · ' + item.color : ''}</option>)}</select></label>
          <div className="admin-form-grid">
            <label>Material usado (g)<input type="number" min="0" step="0.1" value={quote.grams} onChange={e => updateQuote('grams', e.target.value)}/></label>
            <label>Tempo de impressão — horas<input type="number" min="0" step="1" value={quote.hours} onChange={e => updateQuote('hours', e.target.value)}/></label>
            <label>Minutos adicionais<input type="number" min="0" max="59" step="1" value={quote.minutes} onChange={e => updateQuote('minutes', e.target.value)}/></label>
            <label>Margem para perdas (%)<input type="number" min="0" max="200" step="1" value={quote.waste} onChange={e => updateQuote('waste', e.target.value)}/></label>
            <label>Potência média da impressora (W)<input type="number" min="0" step="1" value={quote.power} onChange={e => updateQuote('power', e.target.value)}/></label>
            <label>Custo de energia (R$/kWh)<input type="number" min="0" step="0.01" value={quote.kwhPrice} onChange={e => updateQuote('kwhPrice', e.target.value)}/></label>
            <label>Uso/depreciação da máquina (R$/h)<input type="number" min="0" step="0.01" value={quote.machineHour} onChange={e => updateQuote('machineHour', e.target.value)}/></label>
            <label>Tempo de mão de obra (min)<input type="number" min="0" step="1" value={quote.laborMinutes} onChange={e => updateQuote('laborMinutes', e.target.value)}/></label>
            <label>Custo da mão de obra (R$/h)<input type="number" min="0" step="0.01" value={quote.laborHour} onChange={e => updateQuote('laborHour', e.target.value)}/></label>
            <label>Custos indiretos (%)<input type="number" min="0" step="1" value={quote.overhead} onChange={e => updateQuote('overhead', e.target.value)}/></label>
            <label>Margem de lucro desejada (%)<input type="number" min="0" max="99" step="1" value={quote.margin} onChange={e => updateQuote('margin', e.target.value)}/></label>
          </div>
        </div>
        <aside className="print-result">
          <span className="eyebrow"><CircleDollarSign size={14}/> RESULTADO ESTIMADO</span>
          <span className="print-result-label">Preço sugerido</span>
          <strong className="print-suggested">{money(totals.suggested)}</strong>
          <p>Estimativa para orientar o orçamento. Ajuste a margem conforme o mercado e o nível de personalização.</p>
          <div className="print-cost-lines">
            <div><span>Filamento ({totals.effectiveGrams.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g com perdas)</span><strong>{money(totals.filament)}</strong></div>
            <div><span>Energia elétrica</span><strong>{money(totals.electricity)}</strong></div>
            <div><span>Uso/depreciação da máquina</span><strong>{money(totals.machine)}</strong></div>
            <div><span>Mão de obra</span><strong>{money(totals.labor)}</strong></div>
            <div><span>Custos indiretos</span><strong>{money(totals.overhead)}</strong></div>
            <div className="print-cost-total"><span>Custo estimado</span><strong>{money(totals.cost)}</strong></div>
            <div><span>Lucro estimado</span><strong>{money(totals.profit)}</strong></div>
          </div>
          <small className="print-note">O cálculo é uma estimativa. Considere embalagem, taxas, retrabalho e impostos se forem relevantes para sua operação.</small>
        </aside>
      </div>
    </section>
    <section className="admin-editor filament-editor">
      <div className="admin-section-heading"><div><h2>Tipos de filamento</h2><p>Cadastre o preço e o peso de cada rolo. O custo por grama é calculado automaticamente.</p></div></div>
      <form className="product-form" onSubmit={saveFilament}>
        <div className="admin-form-grid">
          <label>Nome / marca<input required maxLength="100" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Ex.: PLA Basic Bambu"/></label>
          <label>Material<select value={form.material} onChange={e => setForm({...form, material:e.target.value})}><option>PLA</option><option>PETG</option><option>ABS</option><option>ASA</option><option>TPU</option><option>PLA-CF</option><option>PETG-CF</option><option>Outro</option></select></label>
          <label>Cor (opcional)<input maxLength="60" value={form.color} onChange={e => setForm({...form, color:e.target.value})} placeholder="Ex.: verde oliva"/></label>
          <label>Peso do rolo (g)<input type="number" required min="1" step="1" value={form.spool_weight_g} onChange={e => setForm({...form, spool_weight_g:e.target.value})}/></label>
          <label>Preço pago no rolo (R$)<input type="number" required min="0" step="0.01" value={form.spool_price} onChange={e => setForm({...form, spool_price:e.target.value})} placeholder="89,90"/></label>
          <label className="admin-checkbox-inline"><input type="checkbox" checked={form.active} onChange={e => setForm({...form, active:e.target.checked})}/> Disponível para orçamentos</label>
        </div>
        <div className="admin-form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/>{busy ? 'Salvando...' : editingId ? 'Salvar filamento' : 'Cadastrar filamento'}</button>{editingId && <button type="button" className="button button-outline" onClick={resetFilamentForm}><X size={16}/> Cancelar</button>}</div>
      </form>
      <div className="filament-list">{filaments.map(item => <article className="filament-row" key={item.id}><div className="filament-color-dot" style={{ background: item.color.toLowerCase().includes('preto') ? '#242424' : item.color.toLowerCase().includes('branco') ? '#f4f3eb' : item.color.toLowerCase().includes('verde') ? '#70836a' : '#d6d7c8' }}/><div className="filament-copy"><strong>{item.name}</strong><span>{item.material}{item.color ? ' · ' + item.color : ''} · {money(number(item.spool_price) / number(item.spool_weight_g) * 1000)}/kg</span><small>{money(number(item.spool_price) / number(item.spool_weight_g))}/g · {item.spool_weight_g} g por rolo</small></div><span className={item.active ? 'admin-status published' : 'admin-status'}>{item.active ? 'Ativo' : 'Inativo'}</span><div className="admin-product-actions"><button type="button" className="button button-outline" onClick={() => editFilament(item)} disabled={busy}><Pencil size={14}/> Editar</button><button type="button" className="button button-outline" onClick={() => toggleActive(item)} disabled={busy}>{item.active ? 'Desativar' : 'Ativar'}</button><button type="button" className="admin-delete-button" aria-label={'Excluir ' + item.name} onClick={() => deleteFilament(item)} disabled={busy}><Trash2 size={15}/></button></div></article>)}</div>
      {!filaments.length && <div className="empty-state"><Calculator size={24}/><h3>Nenhum filamento cadastrado</h3><p>Cadastre os rolos que você usa para calcular o custo do material por peça.</p></div>}
    </section>
  </main></>;
}

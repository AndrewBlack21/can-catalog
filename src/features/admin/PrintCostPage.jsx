import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Calculator, CircleDollarSign, Pencil, Plus, Save, Trash2, X, Package, Info } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const blankFilament = { name: '', material: 'PLA', color: '', spool_weight_g: '1000', spool_price: '', active: true };
const money = value => formatCurrency(Number.isFinite(value) ? value : 0);
const number = value => Math.max(0, Number(value) || 0);
const getPrintDetails = product => Array.isArray(product?.product_print_details) ? product.product_print_details[0] || null : product?.product_print_details || null;

export default function PrintCostPage() {
  const [session, setSession] = useState(undefined);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [filaments, setFilaments] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [form, setForm] = useState(blankFilament);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quote, setQuote] = useState({
    grams: '35', hours: '2', minutes: '30', quantity: '1', waste: '10',
    power: '120', kwhPrice: '0.90', machineHour: '2.00',
    laborMinutes: '10', laborHour: '20', extraCost: '0',
    overhead: '10', paymentFee: '0', margin: '30'
  });

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
      if (admin) await Promise.all([loadFilaments(), loadProducts()]);
      if (alive) setChecking(false);
    }).catch(() => { if (alive) { setSession(null); setChecking(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadFilaments() {
    const { data, error: loadError } = await supabase.from('filament_types').select('*').order('name');
    if (loadError) setError('Não foi possível carregar os filamentos. Confira as permissões do banco.');
    else {
      setFilaments(data || []);
      setSelectedId(current => (data || []).some(item => item.id === current && item.active) ? current : ((data || []).find(item => item.active)?.id || ''));
    }
  }

  async function loadProducts() {
    const { data, error: loadError } = await supabase.from('products')
      .select('id, name, product_print_details(filament_weight_g, print_time_hours, print_time_minutes)')
      .order('name');
    if (loadError) setError('Não foi possível carregar os produtos para preencher o orçamento.');
    else setProducts(data || []);
  }

  const selected = filaments.find(item => item.id === selectedId && item.active);
  const selectedProduct = products.find(item => item.id === selectedProductId);
  const unitCostPerGram = selected ? number(selected.spool_price) / number(selected.spool_weight_g) : 0;

  const totals = useMemo(() => {
    const grams = number(quote.grams);
    const quantity = Math.max(1, Math.floor(number(quote.quantity)));
    const wasteRate = number(quote.waste) / 100;
    const effectiveGrams = grams * (1 + wasteRate);
    const filament = effectiveGrams * unitCostPerGram;
    const printHours = number(quote.hours) + Math.min(59, number(quote.minutes)) / 60;
    const electricity = printHours * (number(quote.power) / 1000) * number(quote.kwhPrice);
    const machine = printHours * number(quote.machineHour);
    const labor = number(quote.laborMinutes) / 60 * number(quote.laborHour);
    const extraCost = number(quote.extraCost);
    const directCost = filament + electricity + machine + labor + extraCost;
    const overhead = directCost * number(quote.overhead) / 100;
    const cost = directCost + overhead;
    const marginRate = Math.min(80, number(quote.margin)) / 100;
    const paymentRate = Math.min(30, number(quote.paymentFee)) / 100;
    const divisor = 1 - marginRate - paymentRate;
    const suggested = divisor > 0 ? cost / divisor : 0;
    const profit = suggested * (1 - paymentRate) - cost;
    return {
      grams, quantity, effectiveGrams, filament, printHours, electricity, machine, labor,
      extraCost, directCost, overhead, cost, suggested, profit,
      batchCost: cost * quantity, batchSuggested: suggested * quantity,
      batchProfit: profit * quantity, marginRate, paymentRate
    };
  }, [quote, unitCostPerGram]);

  function updateQuote(key, value) { setQuote(current => ({ ...current, [key]: value })); }
  function applyProduct(productId) {
    setSelectedProductId(productId);
    const product = products.find(item => item.id === productId);
    const details = getPrintDetails(product);
    if (!details) return;
    setQuote(current => ({
      ...current,
      grams: details.filament_weight_g != null ? String(details.filament_weight_g) : current.grams,
      hours: details.print_time_hours != null ? String(details.print_time_hours) : current.hours,
      minutes: details.print_time_minutes != null ? String(details.print_time_minutes) : current.minutes
    }));
  }
  function resetFilamentForm() { setForm(blankFilament); setEditingId(null); }
  function editFilament(item) {
    setEditingId(item.id);
    setForm({ name: item.name, material: item.material, color: item.color || '', spool_weight_g: String(item.spool_weight_g), spool_price: String(item.spool_price), active: item.active });
    setError(''); setNotice('');
  }
  async function saveFilament(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const payload = { name: form.name.trim(), material: form.material, color: form.color.trim(), spool_weight_g: number(form.spool_weight_g), spool_price: number(form.spool_price), active: form.active };
    if (!payload.name || payload.spool_weight_g <= 0 || !form.spool_price.trim()) { setError('Preencha o nome, o peso válido do rolo e o preço pago.'); setBusy(false); return; }
    const result = editingId
      ? await supabase.from('filament_types').update(payload).eq('id', editingId).select().single()
      : await supabase.from('filament_types').insert(payload).select().single();
    if (result.error) setError('Não foi possível salvar. Verifique a conexão e as permissões do banco.');
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
    <div className="admin-title-row"><div><span className="eyebrow"><Calculator size={14}/> FERRAMENTA INTERNA</span><h1>Calculadora de<br/><em>custo 3D.</em></h1><p>Descubra quanto custa produzir e qual preço cobrar por cada peça.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}

    <section className="admin-editor">
      <div className="admin-section-heading"><div><h2>Montar orçamento</h2><p>Comece escolhendo um produto ou informe os dados do fatiador manualmente.</p></div></div>
      {!filaments.some(item => item.active) && <div className="setup-notice"><strong>Cadastre um filamento para começar.</strong><span>Informe o peso total do rolo e quanto você pagou por ele.</span></div>}
      <div className="print-calculator-grid">
        <div className="print-fields">
          <label className="print-product-select"><span><Package size={15}/> Produto cadastrado (opcional)</span><select value={selectedProductId} onChange={e => applyProduct(e.target.value)}><option value="">Preencher manualmente</option>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Ao selecionar, o sistema preenche peso e tempo salvos no cadastro. Você pode ajustar os valores depois.</small></label>
          <label>Filamento utilizado<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Selecione um filamento</option>{filaments.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.material}{item.color ? ' · ' + item.color : ''}</option>)}</select>{selected && <small>Custo calculado: {money(unitCostPerGram)}/g · {money(unitCostPerGram * 1000)}/kg</small>}</label>
          <div className="print-field-group"><div className="print-group-heading"><strong>1. Material e produção</strong><span>Dados do fatiador</span></div><div className="admin-form-grid">
            <label>Filamento consumido (g)<input type="number" min="0" step="0.01" value={quote.grams} onChange={e => updateQuote('grams', e.target.value)}/></label>
            <label>Horas de impressão<input type="number" min="0" step="1" value={quote.hours} onChange={e => updateQuote('hours', e.target.value)}/></label>
            <label>Minutos adicionais<input type="number" min="0" max="59" step="1" value={quote.minutes} onChange={e => updateQuote('minutes', e.target.value)}/></label>
            <label>Quantidade de peças<input type="number" min="1" step="1" value={quote.quantity} onChange={e => updateQuote('quantity', e.target.value)}/></label>
            <label>Margem para falhas e desperdício (%)<input type="number" min="0" max="200" step="1" value={quote.waste} onChange={e => updateQuote('waste', e.target.value)}/><small>Acrescentada ao peso do filamento.</small></label>
          </div></div>
          <div className="print-field-group"><div className="print-group-heading"><strong>2. Custos de produção</strong><span>Valores configuráveis</span></div><div className="admin-form-grid">
            <label>Potência média (W)<input type="number" min="0" step="1" value={quote.power} onChange={e => updateQuote('power', e.target.value)}/><small>Use a média real da sua impressora.</small></label>
            <label>Tarifa de energia (R$/kWh)<input type="number" min="0" step="0.01" value={quote.kwhPrice} onChange={e => updateQuote('kwhPrice', e.target.value)}/></label>
            <label>Custo da máquina por hora (R$/h)<input type="number" min="0" step="0.01" value={quote.machineHour} onChange={e => updateQuote('machineHour', e.target.value)}/><small>Reserva para manutenção e desgaste.</small></label>
            <label>Tempo de trabalho manual (min)<input type="number" min="0" step="1" value={quote.laborMinutes} onChange={e => updateQuote('laborMinutes', e.target.value)}/></label>
            <label>Valor da mão de obra (R$/h)<input type="number" min="0" step="0.01" value={quote.laborHour} onChange={e => updateQuote('laborHour', e.target.value)}/></label>
            <label>Outros custos por peça (R$)<input type="number" min="0" step="0.01" value={quote.extraCost} onChange={e => updateQuote('extraCost', e.target.value)}/><small>Embalagem, cola, ímã, acabamento etc.</small></label>
            <label>Custos indiretos (%)<input type="number" min="0" step="1" value={quote.overhead} onChange={e => updateQuote('overhead', e.target.value)}/><small>Rateio de despesas gerais.</small></label>
          </div></div>
          <div className="print-field-group"><div className="print-group-heading"><strong>3. Formação do preço</strong><span>Quanto cobrar</span></div><div className="admin-form-grid">
            <label>Taxa de pagamento (%)<input type="number" min="0" max="30" step="0.1" value={quote.paymentFee} onChange={e => updateQuote('paymentFee', e.target.value)}/><small>Maquininha ou plataforma, se houver.</small></label>
            <label>Margem de lucro desejada (%)<input type="number" min="0" max="80" step="1" value={quote.margin} onChange={e => updateQuote('margin', e.target.value)}/><small>Lucro como percentual do preço de venda.</small></label>
          </div></div>
          <div className="print-formula-help"><Info size={17}/><p><strong>Como o preço é calculado?</strong><br/>O sistema soma material, energia, máquina, mão de obra, extras e custos indiretos. Depois considera a taxa de pagamento e calcula o preço para que a margem de lucro escolhida seja preservada.</p></div>
        </div>
        <aside className="print-result">
          <span className="eyebrow"><CircleDollarSign size={14}/> RESUMO DO ORÇAMENTO</span>
          <span className="print-result-label">Preço recomendado por peça</span>
          <strong className="print-suggested">{money(totals.suggested)}</strong>
          <p>Este é o valor sugerido para cobrar por uma unidade com os parâmetros informados.</p>
          <div className="print-cost-lines">
            <div><span>Filamento ({totals.effectiveGrams.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g com perdas)</span><strong>{money(totals.filament)}</strong></div>
            <div><span>Energia elétrica</span><strong>{money(totals.electricity)}</strong></div>
            <div><span>Uso e desgaste da máquina</span><strong>{money(totals.machine)}</strong></div>
            <div><span>Mão de obra</span><strong>{money(totals.labor)}</strong></div>
            <div><span>Outros custos</span><strong>{money(totals.extraCost)}</strong></div>
            <div><span>Custos indiretos</span><strong>{money(totals.overhead)}</strong></div>
            <div className="print-cost-total"><span>Custo real estimado / unidade</span><strong>{money(totals.cost)}</strong></div>
            <div><span>Taxa de pagamento</span><strong>{money(totals.suggested * totals.paymentRate)}</strong></div>
            <div><span>Lucro estimado / unidade</span><strong>{money(totals.profit)}</strong></div>
          </div>
          <div className="print-batch-summary"><div><span>Quantidade</span><strong>{totals.quantity} un.</strong></div><div><span>Custo total do lote</span><strong>{money(totals.batchCost)}</strong></div><div><span>Valor sugerido do pedido</span><strong>{money(totals.batchSuggested)}</strong></div><div><span>Lucro estimado do lote</span><strong>{money(totals.batchProfit)}</strong></div></div>
          {totals.suggested <= 0 && <p className="print-warning">Informe um filamento, custos e uma margem válida para obter o preço sugerido.</p>}
          <small className="print-note">O preço final também deve considerar concorrência, personalização, impostos e eventuais descontos. Não reduza o preço abaixo do custo calculado.</small>
        </aside>
      </div>
    </section>

    <section className="admin-editor filament-editor">
      <div className="admin-section-heading"><div><h2>Cadastro de filamentos</h2><p>O custo por grama é calculado automaticamente com base no peso e no preço de cada rolo.</p></div></div>
      <form className="product-form" onSubmit={saveFilament}>
        <div className="admin-form-grid">
          <label>Nome / marca<input required maxLength="100" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Ex.: PLA Basic Bambu"/></label>
          <label>Material<select value={form.material} onChange={e => setForm({...form, material:e.target.value})}><option>PLA</option><option>PETG</option><option>ABS</option><option>ASA</option><option>TPU</option><option>PLA-CF</option><option>PETG-CF</option><option>Outro</option></select></label>
          <label>Cor (opcional)<input maxLength="60" value={form.color} onChange={e => setForm({...form, color:e.target.value})} placeholder="Ex.: verde oliva"/></label>
          <label>Peso líquido do rolo (g)<input type="number" required min="1" step="1" value={form.spool_weight_g} onChange={e => setForm({...form, spool_weight_g:e.target.value})}/><small>Informe o peso do filamento, sem o carretel.</small></label>
          <label>Preço pago pelo rolo (R$)<input type="number" required min="0" step="0.01" value={form.spool_price} onChange={e => setForm({...form, spool_price:e.target.value})} placeholder="89,90"/></label>
          <label className="admin-checkbox-inline"><input type="checkbox" checked={form.active} onChange={e => setForm({...form, active:e.target.checked})}/> Disponível para orçamentos</label>
        </div>
        {number(form.spool_weight_g) > 0 && form.spool_price !== '' && <div className="filament-live-cost"><span>Custo calculado deste filamento</span><strong>{money(number(form.spool_price) / number(form.spool_weight_g))}/g</strong><small>{money(number(form.spool_price) / number(form.spool_weight_g) * 1000)}/kg</small></div>}
        <div className="admin-form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/>{busy ? 'Salvando...' : editingId ? 'Salvar filamento' : 'Cadastrar filamento'}</button>{editingId && <button type="button" className="button button-outline" onClick={resetFilamentForm}><X size={16}/> Cancelar</button>}</div>
      </form>
      <div className="filament-list">{filaments.map(item => <article className="filament-row" key={item.id}><div className="filament-color-dot" style={{ background: item.color.toLowerCase().includes('preto') ? '#242424' : item.color.toLowerCase().includes('branco') ? '#f4f3eb' : item.color.toLowerCase().includes('verde') ? '#70836a' : '#d6d7c8' }}/><div className="filament-copy"><strong>{item.name}</strong><span>{item.material}{item.color ? ' · ' + item.color : ''} · {money(number(item.spool_price) / number(item.spool_weight_g) * 1000)}/kg</span><small>{money(number(item.spool_price) / number(item.spool_weight_g))}/g · {item.spool_weight_g} g por rolo</small></div><span className={item.active ? 'admin-status published' : 'admin-status'}>{item.active ? 'Ativo' : 'Inativo'}</span><div className="admin-product-actions"><button type="button" className="button button-outline" onClick={() => editFilament(item)} disabled={busy}><Pencil size={14}/> Editar</button><button type="button" className="button button-outline" onClick={() => toggleActive(item)} disabled={busy}>{item.active ? 'Desativar' : 'Ativar'}</button><button type="button" className="admin-delete-button" aria-label={'Excluir ' + item.name} onClick={() => deleteFilament(item)} disabled={busy}><Trash2 size={15}/></button></div></article>)}</div>
      {!filaments.length && <div className="empty-state"><Calculator size={24}/><h3>Nenhum filamento cadastrado</h3><p>Cadastre os rolos que você usa para calcular o custo do material por peça.</p></div>}
    </section>
  </main></>;
}

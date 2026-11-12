import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CreditCard, Pencil, RefreshCw, Save, Trash2, Wallet, X } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0,10); };
const categories = [
  { value: 'materials', label: 'Materiais' }, { value: 'printer_parts', label: 'Peças para impressora' },
  { value: 'filament', label: 'Filamentos' }, { value: 'maintenance', label: 'Manutenção' },
  { value: 'packaging', label: 'Embalagens' }, { value: 'tools', label: 'Ferramentas e acessórios' },
  { value: 'other', label: 'Outros gastos' }
];
const methods = [
  { value: 'credit', label: 'Crédito' }, { value: 'debit', label: 'Débito' },
  { value: 'pix', label: 'Pix' }, { value: 'cash', label: 'Dinheiro' }, { value: 'transfer', label: 'Transferência' }
];
const blank = () => ({ title: '', category: 'filament', filament_type_id: '', supplier: '', purchase_date: today(), total_amount: '', payment_method: 'credit', installments_count: '1', installments_paid: '0', first_due_date: today(), description: '' });
const paidAmount = item => item.payment_method === 'credit' ? Number((Number(item.total_amount) * Number(item.installments_paid) / Number(item.installments_count)).toFixed(2)) : Number(item.total_amount);
const labelFor = (list, value) => list.find(item => item.value === value)?.label || value;
const dateLabel = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function ExpensesPage() {
  const [session, setSession] = useState(undefined), [authorized, setAuthorized] = useState(false), [checking, setChecking] = useState(true);
  const [expenses, setExpenses] = useState([]), [filamentTypes, setFilamentTypes] = useState([]), [form, setForm] = useState(blank), [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState(''), [categoryFilter, setCategoryFilter] = useState('all'), [paymentFilter, setPaymentFilter] = useState('all'), [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const navigate = useNavigate();

  async function loadFilamentTypes() {
    const { data, error: loadError } = await supabase.from('filament_types').select('id,name,material,color,spool_weight_g,spool_price,active').order('name');
    if (loadError) setError('Não foi possível carregar os filamentos cadastrados no Orçamento 3D: ' + loadError.message);
    else setFilamentTypes(data || []);
  }

  async function loadExpenses() {
    const { data, error: loadError } = await supabase.from('can_expenses').select('*').order('purchase_date', { ascending: false }).order('created_at', { ascending: false });
    if (loadError) setError('Não foi possível carregar os gastos: ' + loadError.message);
    else setExpenses(data || []);
  }
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!alive) return;
      const current = sessionError ? null : data.session; setSession(current);
      if (!current) { setChecking(false); return; }
      const { data: admin, error: adminError } = await supabase.from('catalog_admins').select('user_id').eq('user_id', current.user.id).maybeSingle();
      if (!alive) return;
      const ok = !adminError && Boolean(admin); setAuthorized(ok);
      if (ok) await Promise.all([loadExpenses(), loadFilamentTypes()]);
      if (alive) setChecking(false);
    }).catch(() => { if (alive) { setSession(null); setChecking(false); } });
    return () => { alive = false; };
  }, []);

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return expenses.filter(item => {
      const textMatch = !term || [item.title, item.supplier, item.description].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
      const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
      const paymentMatch = paymentFilter === 'all' || item.payment_method === paymentFilter;
      const settled = paidAmount(item) >= Number(item.total_amount) - 0.009;
      const statusMatch = statusFilter === 'all' || (statusFilter === 'paid' ? settled : !settled);
      return textMatch && categoryMatch && paymentMatch && statusMatch;
    });
  }, [expenses, search, categoryFilter, paymentFilter, statusFilter]);
  const totals = useMemo(() => expenses.reduce((result, item) => {
    result.purchased += Number(item.total_amount || 0);
    result.paid += paidAmount(item);
    result.pending += Math.max(0, Number(item.total_amount || 0) - paidAmount(item));
    return result;
  }, { purchased: 0, paid: 0, pending: 0 }), [expenses]);

  function resetForm() { setForm(blank()); setEditingId(null); setError(''); setNotice(''); }
  function selectFilament(id) {
    const filament = filamentTypes.find(item => item.id === id);
    setForm(current => ({ ...current, filament_type_id: id, title: filament ? `${filament.name} · ${filament.material}${filament.color ? ' · ' + filament.color : ''}` : current.title, total_amount: filament ? String(filament.spool_price) : current.total_amount }));
  }
  function updateForm(key, value) {
    setForm(current => {
      const next = { ...current, [key]: value };
      if (key === 'payment_method' && value !== 'credit') { next.installments_count = '1'; next.installments_paid = '1'; }
      if (key === 'payment_method' && value === 'credit' && current.payment_method !== 'credit') { next.installments_count = '1'; next.installments_paid = '0'; }
      if (key === 'installments_count') next.installments_paid = String(Math.min(Number(current.installments_paid), Number(value)));
      return next;
    });
  }
  async function saveExpense(event) {
    event.preventDefault(); setError(''); setNotice('');
    const amount = Number(form.total_amount), count = Number(form.installments_count), paid = Number(form.installments_paid);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) { setError('Informe a descrição e um valor total válido.'); return; }
    if (!Number.isInteger(count) || count < 1 || count > 48 || !Number.isInteger(paid) || paid < 0 || paid > count) { setError('Confira a quantidade de parcelas e quantas já foram pagas.'); return; }
    if (form.payment_method !== 'credit' && (count !== 1 || paid !== 1)) { setError('Compras no débito, Pix, dinheiro ou transferência são registradas como quitadas.'); return; }
    setBusy(true);
    const payload = {
      title: form.title.trim(), category: form.category, filament_type_id: form.category === 'filament' ? (form.filament_type_id || null) : null, supplier: form.supplier.trim() || null,
      purchase_date: form.purchase_date, total_amount: amount, payment_method: form.payment_method,
      installments_count: count, installments_paid: paid, first_due_date: form.payment_method === 'credit' ? (form.first_due_date || null) : null,
      description: form.description.trim() || null, ...(editingId ? {} : { created_by: session.user.id })
    };
    const result = editingId ? await supabase.from('can_expenses').update(payload).eq('id', editingId) : await supabase.from('can_expenses').insert(payload);
    if (result.error) { setError('Não foi possível salvar o gasto: ' + result.error.message); setBusy(false); return; }
    await loadExpenses(); resetForm(); setNotice(editingId ? 'Gasto atualizado com sucesso.' : 'Gasto registrado com sucesso.'); setBusy(false);
  }
  function editExpense(item) {
    setEditingId(item.id);
    setForm({ title: item.title, category: item.category, filament_type_id: item.filament_type_id || '', supplier: item.supplier || '', purchase_date: item.purchase_date, total_amount: String(item.total_amount), payment_method: item.payment_method, installments_count: String(item.installments_count), installments_paid: String(item.installments_paid), first_due_date: item.first_due_date || today(), description: item.description || '' });
    setError(''); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function deleteExpense(item) {
    if (!window.confirm('Excluir o registro "' + item.title + '"? Esta ação não pode ser desfeita.')) return;
    setBusy(true); setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('can_expenses').delete().eq('id', item.id);
    if (deleteError) setError('Não foi possível excluir: ' + deleteError.message);
    else { setExpenses(current => current.filter(row => row.id !== item.id)); setNotice('Gasto excluído.'); }
    setBusy(false);
  }
  if (!isSupabaseConfigured) return <Navigate to="/adm" replace />;
  if (checking || session === undefined) return <div className="empty-state">Verificando sessão e permissões...</div>;
  if (!session || !authorized) return <Navigate to="/adm" replace />;

  return <>
    <Header admin />
    <main className="admin-main expenses-page">
      <div className="admin-title-row">
        <div><span className="eyebrow"><Wallet size={14}/> CONTROLE FINANCEIRO</span><h1>Gastos da CAN,<br/><em>sem perder nada de vista.</em></h1><p>Registre compras, acompanhe pagamentos e saiba o que ainda falta quitar.</p></div>
        <div className="admin-title-actions">
          <button className="button button-outline" onClick={() => navigate('/adm/painel')}><ArrowLeft size={16}/> Painel</button>
          <button className="button button-outline" onClick={() => navigate('/adm/vendas')}>Controle de vendas</button>
          <button className="button button-outline" onClick={() => navigate('/adm/orcamento-3d')}>Orçamento 3D</button>
          <button className="button button-outline" onClick={async () => { await supabase.auth.signOut(); navigate('/adm'); }}>Sair</button>
        </div>
      </div>
      <div className="expenses-summary">
        <article className="expense-summary-card"><span>Total em compras</span><strong>{money(totals.purchased)}</strong><small>Soma do valor total registrado</small></article>
        <article className="expense-summary-card"><span>Já pago</span><strong>{money(totals.paid)}</strong><small>Parcelas quitadas e compras à vista</small></article>
        <article className="expense-summary-card pending"><span>Falta pagar</span><strong>{money(totals.pending)}</strong><small>Saldo das compras no crédito</small></article>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}{notice && <div className="admin-success" role="status">{notice}</div>}
      <section className="admin-editor expenses-editor">
        <div className="admin-section-heading"><div><h2>{editingId ? 'Editar gasto' : 'Registrar novo gasto'}</h2><p>Cadastre filamentos, materiais, peças da impressora e demais despesas.</p></div>{editingId && <button type="button" className="button button-outline" onClick={resetForm}><X size={15}/> Cancelar edição</button>}</div>
        <form className="product-form" onSubmit={saveExpense}>
          <div className="admin-form-grid">
            <label>Descrição da compra<input required maxLength={160} value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Ex.: Filamento PLA verde oliva 1 kg"/></label>
            <label>Categoria<select value={form.category} onChange={e => { updateForm('category', e.target.value); if (e.target.value !== 'filament') updateForm('filament_type_id', ''); }}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {form.category === 'filament' && <label>Filamento cadastrado no Orçamento 3D<select value={form.filament_type_id} onChange={e => selectFilament(e.target.value)}><option value=''>Compra avulsa / não vincular</option>{filamentTypes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.material}{item.color ? ' · ' + item.color : ''}{item.active ? '' : ' (inativo)'}</option>)}</select><small>Selecione um rolo já cadastrado para preencher descrição e valor com os dados registrados no Orçamento 3D.</small></label>}
            <label>Valor total da compra (R$)<input required type="number" min="0.01" step="0.01" value={form.total_amount} onChange={e => updateForm('total_amount', e.target.value)} placeholder="Ex.: 129,90"/></label>
            <label>Data da compra<input required type="date" value={form.purchase_date} onChange={e => updateForm('purchase_date', e.target.value)}/></label>
            <label>Loja / fornecedor<input maxLength={140} value={form.supplier} onChange={e => updateForm('supplier', e.target.value)} placeholder="Ex.: Loja de impressão 3D"/></label>
            <label>Forma de pagamento<select value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>{methods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {form.payment_method === 'credit' && <>
              <label>Pagamento no cartão<select value={form.installments_count} onChange={e => updateForm('installments_count', e.target.value)}>{Array.from({length:48},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x {n===1?'(à vista)':'(parcelado)'}</option>)}</select></label>
              <label>Parcelas já pagas<input type="number" min="0" max={form.installments_count} step="1" value={form.installments_paid} onChange={e => updateForm('installments_paid', e.target.value)}/></label>
              <label>Vencimento da primeira parcela<input type="date" value={form.first_due_date} onChange={e => updateForm('first_due_date', e.target.value)}/></label>
            </>}
          </div>
          {form.payment_method === 'credit' && <div className="expense-installment-preview"><CreditCard size={19}/><div><strong>{money(Number(form.total_amount || 0) / Math.max(1, Number(form.installments_count || 1)))} por parcela</strong><small>{form.installments_paid} de {form.installments_count} parcelas pagas · Saldo pendente: {money(Math.max(0, Number(form.total_amount || 0) * (1 - Number(form.installments_paid || 0) / Math.max(1, Number(form.installments_count || 1)))))}</small></div></div>}
          <label>Observações<textarea rows="3" maxLength="1500" value={form.description} onChange={e => updateForm('description', e.target.value)} placeholder="Detalhes, modelo, cor, quantidade, número do pedido..."/></label>
          <div className="admin-form-actions"><button className="button button-dark" disabled={busy}><Save size={16}/>{busy ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Registrar gasto'}</button><button type="button" className="button button-outline" onClick={resetForm} disabled={busy}>Limpar</button></div>
        </form>
      </section>
      <section className="admin-products expenses-history">
        <div className="admin-section-heading"><div><h2>Histórico de gastos</h2><p>Pesquise, filtre, edite e acompanhe o que já foi comprado.</p></div><button className="button button-outline" onClick={loadExpenses} disabled={busy}><RefreshCw size={15}/> Atualizar</button></div>
        <div className="expenses-filters">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar descrição ou fornecedor..."/>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="all">Todas as formas</option>{methods.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos os status</option><option value="paid">Quitados</option><option value="pending">Com parcelas pendentes</option></select>
        </div>
        <div className="expenses-list">
          {filteredExpenses.map(item => {
            const paid = paidAmount(item), pending = Math.max(0, Number(item.total_amount) - paid), settled = pending < 0.01;
            return <article className="expense-row" key={item.id}>
              <div className="expense-date"><CalendarDays size={15}/><span>{dateLabel(item.purchase_date)}</span></div>
              <div className="expense-main"><strong>{item.title}</strong><small>{labelFor(categories,item.category)}{item.filament_type_id && filamentTypes.find(f => f.id === item.filament_type_id) ? ' · Vinculado: ' + (() => { const f = filamentTypes.find(row => row.id === item.filament_type_id); return `${f.name} ${f.material}${f.color ? ' · ' + f.color : ''}`; })() : ''}{item.supplier ? ' · ' + item.supplier : ''}</small><div className="expense-tags"><span>{labelFor(methods,item.payment_method)}</span><span className={settled ? 'expense-paid' : 'expense-pending'}>{settled ? 'Quitado' : item.installments_paid + '/' + item.installments_count + ' parcelas pagas'}</span></div>{item.description && <p>{item.description}</p>}</div>
              <div className="expense-values"><strong>{money(item.total_amount)}</strong><small>Pago: {money(paid)}</small>{pending > 0 && <small className="expense-due">Pendente: {money(pending)}</small>}</div>
              <div className="expense-actions"><button type="button" className="button button-outline" onClick={() => editExpense(item)} disabled={busy}><Pencil size={14}/> Editar</button><button type="button" className="admin-delete-button" aria-label={'Excluir ' + item.title} onClick={() => deleteExpense(item)} disabled={busy}><Trash2 size={15}/></button></div>
            </article>;
          })}
        </div>
        {!filteredExpenses.length && <div className="empty-state"><Wallet size={25}/><h3>Nenhum gasto encontrado</h3><p>Registre uma compra ou ajuste os filtros da pesquisa.</p></div>}
      </section>
    </main>
  </>;
}

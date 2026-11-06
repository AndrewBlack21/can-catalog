import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CircleDollarSign, ClipboardList, LogOut, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import Header from '../../components/Header.jsx';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const money = value => Number(value || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const localDateTime = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); };
const newLine = () => ({key: crypto.randomUUID(),product_id:'',product_name:'',quantity:'1',unit_price:''});

export default function SalesPage(){
  const [session,setSession]=useState(undefined),[authorized,setAuthorized]=useState(false),[checking,setChecking]=useState(true);
  const [products,setProducts]=useState([]),[sales,setSales]=useState([]),[lines,setLines]=useState([newLine()]);
  const [soldAt,setSoldAt]=useState(localDateTime()),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const navigate=useNavigate();
  async function loadData(){
    const [p,s]=await Promise.all([
      supabase.from('products').select('id,name,price_mode,price').order('name'),
      supabase.from('sales').select('*, sale_items(*)').order('sold_at',{ascending:false}).limit(100)
    ]);
    if(p.error) setError('Não foi possível carregar os produtos: '+p.error.message); else setProducts(p.data||[]);
    if(s.error) setError('Não foi possível carregar o histórico: '+s.error.message); else setSales(s.data||[]);
  }
  useEffect(()=>{
    if(!isSupabaseConfigured)return;
    let alive=true;
    supabase.auth.getSession().then(async ({data,error:sessionError})=>{
      if(!alive)return;
      const current=sessionError?null:data.session;setSession(current);
      if(!current){setChecking(false);return;}
      const {data:admin,error:adminError}=await supabase.from('catalog_admins').select('user_id').eq('user_id',current.user.id).maybeSingle();
      if(!alive)return;
      const ok=!adminError&&!!admin;setAuthorized(ok);
      if(ok) await loadData();
      if(alive)setChecking(false);
    }).catch(()=>{if(alive){setSession(null);setChecking(false);}});
    return()=>{alive=false;};
  },[]);
  const total=useMemo(()=>lines.reduce((sum,line)=>sum+(Number(line.quantity)||0)*(Number(line.unit_price)||0),0),[lines]);
  const revenue=sales.reduce((sum,sale)=>sum+Number(sale.total_amount||0),0);
  const soldUnits=sales.reduce((sum,sale)=>sum+(sale.sale_items||[]).reduce((n,item)=>n+Number(item.quantity||0),0),0);
  function updateLine(key,patch){setLines(current=>current.map(line=>line.key===key?{...line,...patch}:line));}
  function chooseProduct(key,id){
    const product=products.find(item=>item.id===id);
    updateLine(key,{product_id:id,product_name:product?.name||'',unit_price:product?.price_mode==='fixed'&&product.price!=null?String(product.price):''});
  }
  async function saveSale(event){
    event.preventDefault();setError('');setNotice('');
    const valid=lines.filter(line=>line.product_id&&Number(line.quantity)>0&&Number.isFinite(Number(line.unit_price))&&Number(line.unit_price)>=0);
    if(!valid.length){setError('Adicione ao menos um produto, com quantidade e valor vendido válidos.');return;}
    if(valid.length!==lines.length){setError('Complete ou remova as linhas incompletas antes de registrar a venda.');return;}
    setBusy(true);
    const amount=valid.reduce((sum,line)=>sum+Number(line.quantity)*Number(line.unit_price),0);
    const {data:sale,error:saleError}=await supabase.from('sales').insert({sold_at:new Date(soldAt).toISOString(),total_amount:amount,notes:notes.trim()||null,created_by:session.user.id}).select('id').single();
    if(saleError||!sale){setError('Não foi possível registrar a venda: '+(saleError?.message||'registro não retornado'));setBusy(false);return;}
    const payload=valid.map(line=>({sale_id:sale.id,product_id:line.product_id,product_name:products.find(p=>p.id===line.product_id)?.name||line.product_name,quantity:Number(line.quantity),unit_price:Number(line.unit_price),line_total:Number(line.quantity)*Number(line.unit_price)}));
    const {error:itemError}=await supabase.from('sale_items').insert(payload);
    if(itemError){await supabase.from('sales').delete().eq('id',sale.id);setError('Falha ao salvar os itens. A venda não foi mantida: '+itemError.message);setBusy(false);return;}
    setLines([newLine()]);setNotes('');setSoldAt(localDateTime());await loadData();setNotice('Venda registrada com sucesso.');setBusy(false);
  }
  async function logout(){await supabase.auth.signOut();navigate('/adm');}
  if(!isSupabaseConfigured)return <Navigate to="/adm" replace/>;
  if(checking||session===undefined)return <div className="empty-state">Verificando sessão e permissões...</div>;
  if(!session||!authorized)return <Navigate to="/adm" replace/>;
  return <><Header admin/><main className="admin-main sales-main">
    <div className="admin-title-row"><div><button className="sales-back" onClick={()=>navigate('/adm/painel')}><ArrowLeft size={15}/> Painel administrativo</button><span className="eyebrow"><ClipboardList size={14}/> CONTROLE INTERNO</span><h1>Controle de<br/><em>vendas.</em></h1><p>Registre os produtos que saíram, as quantidades e os valores realmente vendidos.</p></div><div className="admin-title-actions"><button className="button button-outline" onClick={loadData} disabled={busy}><RefreshCw size={15}/> Atualizar</button><button className="button button-outline" onClick={logout}><LogOut size={16}/> Sair</button></div></div>
    <div className="stats-grid"><div className="stat-card"><span>Vendas registradas</span><strong>{sales.length}</strong></div><div className="stat-card"><span>Unidades vendidas</span><strong>{soldUnits}</strong></div><div className="stat-card"><span>Total vendido</span><strong>{money(revenue)}</strong></div></div>
    {error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="admin-success" role="status">{notice}</div>}
    <section className="admin-editor sales-editor"><div className="admin-section-heading"><div><h2>Registrar nova venda</h2><p>Selecione os itens do catálogo e informe o preço efetivamente pago por unidade.</p></div></div>
      <form className="product-form" onSubmit={saveSale}>
        <label className="sales-date-field"><span><CalendarDays size={15}/> Data e horário da venda</span><input type="datetime-local" required value={soldAt} onChange={e=>setSoldAt(e.target.value)}/></label>
        <div className="sales-lines">{lines.map((line,index)=><div className="sales-line" key={line.key}>
          <div className="sales-line-heading"><strong>Item {index+1}</strong>{lines.length>1&&<button type="button" className="sales-remove" onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))} aria-label="Remover item"><Trash2 size={15}/></button>}</div>
          <label>Produto do catálogo<select required value={line.product_id} onChange={e=>chooseProduct(line.key,e.target.value)}><option value="">Selecione um produto</option>{products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Quantidade<input type="number" min="1" step="1" required value={line.quantity} onChange={e=>updateLine(line.key,{quantity:e.target.value})}/></label>
          <label>Valor vendido por unidade (R$)<input type="number" min="0" step="0.01" required value={line.unit_price} onChange={e=>updateLine(line.key,{unit_price:e.target.value})} placeholder="0,00"/></label>
          <div className="sales-line-total"><span>Subtotal do item</span><strong>{money((Number(line.quantity)||0)*(Number(line.unit_price)||0))}</strong></div>
        </div>)}</div>
        <button type="button" className="button button-outline sales-add" onClick={()=>setLines(current=>[...current,newLine()])}><Plus size={16}/> Adicionar outro produto</button>
        <label>Observações (opcional)<textarea rows="2" maxLength="1000" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: venda presencial, encomenda, nome do cliente..."/></label>
        <div className="sales-grand-total"><span>Total desta venda</span><strong>{money(total)}</strong></div>
        <div className="admin-form-actions"><button className="button button-dark" disabled={busy||!products.length}><Save size={16}/>{busy?'Registrando...':'Registrar venda'}</button></div>
        {!products.length&&<p className="sales-empty-note">Cadastre produtos no catálogo antes de registrar uma venda.</p>}
      </form>
    </section>
    <section className="admin-products sales-history"><div className="admin-section-heading"><div><h2>Histórico de vendas</h2><p>Últimas 100 vendas registradas, com os itens e valores salvos.</p></div></div>
      {!sales.length?<div className="empty-state"><CircleDollarSign size={25}/><h3>Nenhuma venda registrada</h3><p>As vendas adicionadas aparecerão aqui.</p></div>:<div className="sales-history-list">{sales.map(sale=><article className="sales-history-card" key={sale.id}><div className="sales-history-head"><div><strong>{new Date(sale.sold_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</strong><small>{(sale.sale_items||[]).reduce((n,item)=>n+Number(item.quantity),0)} unidade(s)</small></div><b>{money(sale.total_amount)}</b></div><div className="sales-history-items">{(sale.sale_items||[]).map(item=><div key={item.id}><span>{item.quantity} × {item.product_name} <small>({money(item.unit_price)} cada)</small></span><strong>{money(item.line_total)}</strong></div>)}</div>{sale.notes&&<p className="sales-history-note">{sale.notes}</p>}</article>)}</div>}
    </section>
  </main></>;
}

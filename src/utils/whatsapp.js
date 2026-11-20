const number = (import.meta.env.VITE_WHATSAPP_NUMBER || '5513997092751').replace(/\D/g, '');

function buildProductDetails(product, customization = '') {
  const price = product.price_mode === 'quote' ? 'Preço sob consulta' : `Preço: ${Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  return [
    `Produto: ${product.name}`,
    price,
    customization ? `Personalização: ${customization}` : null,
    `Link: ${window.location.origin}/produto/${product.slug}`
  ].filter(Boolean);
}

export function productWhatsAppUrl(product, customization = '') {
  const message = [
    'Olá, CAN Group! Tenho interesse neste produto:',
    ...buildProductDetails(product, customization)
  ].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function paymentWhatsAppUrl(product, customization = '') {
  const message = [
    'Olá, CAN Group! Já realizei o pagamento pela InfinitePay e quero enviar os dados para meu pedido.',
    ...buildProductDetails(product, customization),
    '',
    'Quantidade:',
    'Nome completo:',
    'CEP:',
    'Endereço e número:',
    'Bairro:',
    'Cidade/Estado:',
    'Complemento:',
    '',
    'Vou encaminhar o comprovante para conferência.'
  ].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

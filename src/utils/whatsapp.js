const number = (import.meta.env.VITE_WHATSAPP_NUMBER || '5513997092751').replace(/\D/g, '');

export function productWhatsAppUrl(product, customization = '') {
  const price = product.price_mode === 'quote' ? 'Preço sob consulta' : `Preço: ${Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  const message = [
    'Olá, CAN Group! Tenho interesse neste produto:',
    `Produto: ${product.name}`,
    price,
    customization ? `Personalização: ${customization}` : null,
    `Link: ${window.location.origin}/produto/${product.slug}`
  ].filter(Boolean).join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

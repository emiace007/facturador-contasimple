// SOLO PARA PROBAR LA PANTALLA EN LOCAL: backend con ARCA SIMULADO. Nunca emite facturas reales.
const { crearApp } = require('../server');
let n = 0;
crearApp({ emisor: async (d) => { if (d.importe === 666) throw new Error('ARCA no aprobó el comprobante (simulado)'); n++; return { numero: n, cae: '7' + String(n).padStart(13, '0'), caeVencimiento: '20261231', fecha: null }; } })
  .listen(3000, () => console.log('dev-server (ARCA simulado) en :3000'));

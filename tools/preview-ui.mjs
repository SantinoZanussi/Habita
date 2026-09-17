// Revisión visual del código real del panel, con datos ficticios en memoria.
// No usa Firebase, Render ni credenciales; no forma parte del build productivo.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const web = resolve(import.meta.dirname, '../web');
const source = await readFile(resolve(web, 'src/main.js'), 'utf8');
const gestion = (await readFile(resolve(web, 'src/gestion.js'), 'utf8')).replaceAll('export function', 'function');
const estado = {
  complejoId: 'demo', complejo: {nombre:'Torre del Parque · Prueba'}, resumen: {},
  usuario: {}, claims: {}, seccion:'amenities', listeners: [], eventos:[], reclamos:[], periodos:[], obras:[],
  filtroUnidades:'', filtroReclamos:'', estadoReclamos:'todos', filtroAvisos:'',
  filtrosReservas:{estado:'todos',amenity:'todos',fecha:''},
  unidades: [{id:'3a',identificador:'3A',estado:'ocupada',coeficiente:50},{id:'4b',identificador:'4B',estado:'ocupada',coeficiente:50}],
  amenities: [
    {id:'sum',nombre:'Salón de encuentros',descripcion:'Un espacio equipado para celebrar, reunirnos y compartir.',capacidad:30,activo:true,requiereAprobacion:true},
    {id:'pileta',nombre:'Pileta y solárium',descripcion:'Disfrutá al aire libre. Respetá las indicaciones del espacio.',capacidad:20,activo:true},
    {id:'gimnasio',nombre:'Gimnasio',descripcion:'Equipamiento en mantenimiento.',capacidad:8,activo:false},
  ],
  reservas: [
    {id:'r1',amenityId:'sum',amenityNombre:'Salón de encuentros',unidadId:'3a',asistentes:3,estado:'pendiente',desde:'2026-09-18T16:00:00',hasta:'2026-09-18T18:00:00'},
    {id:'r2',amenityId:'pileta',amenityNombre:'Pileta y solárium',unidadId:'4b',asistentes:2,estado:'confirmada',desde:'2026-09-18T10:00:00',hasta:'2026-09-18T12:00:00'},
    {id:'r3',amenityId:'sum',amenityNombre:'Salón de encuentros',unidadId:'4b',asistentes:2,estado:'cancelada',desde:'2026-09-17T10:00:00',hasta:'2026-09-17T12:00:00'},
  ],
  avisos: [
    {id:'n1',titulo:'Mantenimiento de ascensores',cuerpo:'El viernes realizaremos la revisión programada. Agradecemos tu colaboración.',tipo:'mantenimiento',destinatarios:'todos',enviadaEn:'2026-09-16T10:00:00'},
    {id:'n2',titulo:'Reunión de propietarios',cuerpo:'Encontrémonos en el salón para conversar sobre las próximas mejoras del complejo.',tipo:'asamblea',destinatarios:['3a','4b'],enviadaEn:'2026-09-15T18:00:00'},
  ],
};
const bootstrap = [
  'const $=(s,r=document)=>r.querySelector(s);',
  'const $$=(s,r=document)=>[...r.querySelectorAll(s)];',
  'const appShell=$("#aplicacion"); const estado='+JSON.stringify(estado)+';',
  'const config={emuladores:{activo:true}};',
  gestion,
  source.slice(source.indexOf('function renderTodo()')),
  'window.peticionesPrueba=[];',
  'api=async(ruta,opciones={})=>{ window.peticionesPrueba.push({ruta,...opciones}); const d=opciones.body; if(opciones.method==="POST"&&ruta.endsWith("/notificaciones")) estado.avisos.unshift({id:"nuevo",...d,enviadaEn:new Date().toISOString()}); else if(ruta.includes("/reservas/")) Object.assign(estado.reservas.find(r=>r.id===ruta.split("/").at(-1)),d); else if(ruta.includes("/amenities/")) Object.assign(estado.amenities.find(a=>a.id===ruta.split("/").at(-1)),d); else throw new Error("Acción no incluida en esta vista de prueba"); renderTodo(); return {}; };',
  '$("#login").hidden=true; appShell.hidden=false; renderTodo(); navegar("amenities");',
  '$("#menu-movil").onclick=()=>appShell.classList.toggle("menu-open");',
].join('\n');
const tipos={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/vista.js') { res.setHeader('Content-Type','text/javascript'); res.end(bootstrap); return; }
    const path=resolve(web,'.'+(url.pathname==='/'||url.pathname==='/panel/'?'/panel/index.html':decodeURIComponent(url.pathname)));
    if(!path.startsWith(web+sep)) {res.writeHead(403); res.end(); return;}
    let contenido=await readFile(path);
    if(path.endsWith('index.html')) contenido=contenido.toString().replace(/<script[\s\S]*?<\/script>/g,'')
      .replace('</body>','<script type="module" src="/vista.js"></script></body>')
      .replace('<body>','<body><div style="background:#fff0c2;padding:8px;text-align:center">Vista de prueba · datos ficticios · sin conexión a producción</div>');
    res.setHeader('Content-Type',tipos[extname(path)]??'application/octet-stream'); res.end(contenido);
  } catch {res.writeHead(404);res.end('No encontrado');}
}).listen(5180,'127.0.0.1',()=>console.log('Vista aislada: http://127.0.0.1:5180/panel/'));

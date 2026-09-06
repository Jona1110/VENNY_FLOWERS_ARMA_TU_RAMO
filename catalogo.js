/* ==========================================================================
   Lógica del Menú Interactivo - Optimizado (Fechas dinámicas y Mayoreo)
   ========================================================================== */
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwy7qdPM56p_NT0VRM-f9QMGFD_9jxgCzOIzYcUKrFsOdDOd-ABwEGUjFvjpTRDHgCfSQ/exec";
const CACHE_KEY = "venny_flowers_catalogo_cache";

document.addEventListener('DOMContentLoaded', () => {
    let currentStep = 1;
    const totalSteps = 5;
    
    const elements = {
        pantallaCarga: document.getElementById('pantalla-carga'),
        basesContainer: document.getElementById('bases-container'),
        floresContainer: document.getElementById('flores-container'),
        papelesContainer: document.getElementById('papeles-container'),
        extrasContainer: document.getElementById('extras-container'),
        totalPrice: document.getElementById('total-price'),
        btnNext: document.getElementById('next-btn'),
        btnPrev: document.getElementById('prev-btn'),
        btnWhatsApp: document.getElementById('whatsapp-btn'),
        steps: document.querySelectorAll('.wizard-step'),
        indicators: document.querySelectorAll('.step-indicator'),
        inputFecha: document.getElementById('fecha-entrega')
    };
    
    let estadoPedido = { baseNombre: "", basePrecio: 0, flores: {}, papelNombre: "", extras: {}, total: 0 };
    
    // ==========================================================================
    // 1. LÓGICA DE TEMPORADAS ALTAS (Dinámica)
    // ==========================================================================
    // Fechas clave: 14 Feb, 21 Mar, 10 May, 21 Sep, 1 Nov
    function evaluarSiEsTemporada(fechaStrOrDate) {
        if (!fechaStrOrDate) return false;
        
        let fechaEvaluar = new Date(fechaStrOrDate);
        
        // Ajuste de zona horaria si la fecha viene del input HTML tipo date (UTC-0)
        if (typeof fechaStrOrDate === 'string' && fechaStrOrDate.includes('-')) {
            fechaEvaluar = new Date(fechaStrOrDate + 'T12:00:00'); 
        }

        const anio = fechaEvaluar.getFullYear();
        const fechasAlta = [
            new Date(anio, 1, 14), // 14 Feb
            new Date(anio, 2, 21), // 21 Mar
            new Date(anio, 4, 10), // 10 May
            new Date(anio, 8, 21), // 21 Sep
            new Date(anio, 10, 1)  // 1 Nov
        ];
        
        for (let f of fechasAlta) {
            const limiteInferior = new Date(f);
            limiteInferior.setDate(f.getDate() - 7);
            
            // Ajustar a las 00:00 del límite inferior y 23:59 del día de la fecha alta
            limiteInferior.setHours(0,0,0,0);
            f.setHours(23,59,59,999);
            
            if (fechaEvaluar >= limiteInferior && fechaEvaluar <= f) return true;
        }
        return false;
    }

    // Inicializamos evaluando si el día de HOY es temporada alta
    let esTemporada = evaluarSiEsTemporada(new Date());

    // Listener para recalcular si eligen una fecha futura de temporada alta
    if (elements.inputFecha) {
        elements.inputFecha.addEventListener('change', (e) => {
            const fechaElegida = e.target.value;
            // Si "HOY" es temporada, o la "FECHA ELEGIDA" es temporada, bloqueamos precios.
            if (fechaElegida) {
                esTemporada = evaluarSiEsTemporada(new Date()) || evaluarSiEsTemporada(fechaElegida);
            } else {
                esTemporada = evaluarSiEsTemporada(new Date());
            }
            
            const alerta = document.getElementById('alerta-temporada');
            if(esTemporada) alerta.classList.remove('hidden');
            else alerta.classList.add('hidden');
            
            calcularTotal(); // Recalcula y actualiza la barra del footer
        });
    }

    // ==========================================================================
    // 2. MODALES E INTERFAZ
    // ==========================================================================
    window.abrirImagen = function(e, url) {
        e.preventDefault(); e.stopPropagation();
        if(!url || url.length < 10) return;
        const modal = document.getElementById('modal-imagen');
        const img = document.getElementById('img-ampliada');
        img.src = url;
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); img.classList.remove('scale-95'); }, 10);
    }

    window.cerrarImagen = function() {
        const modal = document.getElementById('modal-imagen');
        const img = document.getElementById('img-ampliada');
        modal.classList.add('opacity-0'); img.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    // ==========================================================================
    // 3. SINCRONIZACIÓN
    // ==========================================================================
    function inicializarSistema() {
        if(esTemporada) document.getElementById('alerta-temporada').classList.remove('hidden');
        const datosGuardados = localStorage.getItem(CACHE_KEY);
        if (datosGuardados) {
            try { procesarCatalogo(JSON.parse(datosGuardados)); elements.pantallaCarga.classList.add('hidden'); updateWizard(); } 
            catch (e) { console.error(e); }
        }
        sincronizarConServidor();
    }

    async function sincronizarConServidor() {
        try {
            const res = await fetch(`${URL_GOOGLE_SCRIPT}?accion=obtener_catalogo`);
            const json = await res.json();
            if(json.exito) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(json.datos));
                if (elements.pantallaCarga.classList.contains('hidden') === false) {
                    procesarCatalogo(json.datos); elements.pantallaCarga.classList.add('hidden'); updateWizard();
                }
            }
        } catch (error) { if (!localStorage.getItem(CACHE_KEY)) alert("Revisa tu conexión a internet."); }
    }

    function procesarCatalogo(datos) {
        renderizarBases(datos.bases); renderizarFlores(datos.flores); renderizarPapeles(datos.papeles); renderizarExtras(datos.extras);
    }

    // ==========================================================================
    // 4. RENDERIZADO DE PRODUCTOS
    // ==========================================================================
    function renderizarBases(bases) {
        elements.basesContainer.innerHTML = '';
        bases.forEach((base, index) => {
            const precioNum = parseFloat(base.Precio);
            const html = `
                <div class="cursor-pointer border-2 border-[#E8DCC4] rounded-xl p-3 flex flex-col items-center text-center transition bg-white shadow-sm relative group" id="base-card-${index}" onclick="seleccionarBase(this, '${base.Nombre}', ${precioNum})">
                    <input type="radio" name="base_ramo" value="${base.Nombre}" data-precio="${precioNum}" class="sr-only" ${index === 0 ? 'checked' : ''}>
                    <div id="insignia-base-${index}" class="absolute top-2 right-2 bg-oro text-white text-[10px] font-bold px-2 py-0.5 rounded-full ${index === 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} transition-all shadow-sm z-10 flex items-center space-x-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg><span>Elegido</span>
                    </div>
                    <div class="w-full h-24 bg-stone-100 rounded-lg mb-2 bg-cover bg-center border border-stone-200 transition" style="background-image: url('${base.Imagen_URL || ''}')" onclick="abrirImagen(event, '${base.Imagen_URL || ''}')">
                        <div class="w-full h-full flex items-end justify-end p-1 opacity-60 hover:opacity-100"><svg class="w-5 h-5 text-white drop-shadow-md bg-stone-800/50 rounded-full p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg></div>
                    </div>
                    <span class="font-semibold text-sm text-cafe group-hover:text-oro transition">${base.Nombre}</span>
                    <span class="text-xs text-oro font-bold mt-1">${esTemporada ? 'Precio Variable' : (precioNum > 0 ? `+$${precioNum}` : 'Sin costo base')}</span>
                </div>
            `;
            elements.basesContainer.insertAdjacentHTML('beforeend', html);
        });
        const primerRadio = document.querySelector('input[name="base_ramo"]:checked');
        if(primerRadio) { estadoPedido.baseNombre = primerRadio.value; estadoPedido.basePrecio = parseFloat(primerRadio.dataset.precio); setTimeout(()=>document.getElementById(`base-card-0`).classList.add('border-oro','bg-rosa-suave'), 100); }
    }

    window.seleccionarBase = function(elemento, nombre, precio) {
        document.querySelectorAll('input[name="base_ramo"]').forEach(r => r.checked = false);
        elemento.querySelector('input').checked = true;
        document.querySelectorAll('[id^="base-card-"]').forEach(c => c.classList.remove('border-oro', 'bg-rosa-suave'));
        document.querySelectorAll('[id^="insignia-base-"]').forEach(i => { i.classList.remove('opacity-100', 'scale-100'); i.classList.add('opacity-0', 'scale-75'); });
        elemento.classList.add('border-oro', 'bg-rosa-suave');
        elemento.querySelector('div[id^="insignia-base-"]').classList.replace('opacity-0', 'opacity-100');
        elemento.querySelector('div[id^="insignia-base-"]').classList.replace('scale-75', 'scale-100');
        estadoPedido.baseNombre = nombre; estadoPedido.basePrecio = precio; calcularTotal();
    }

    function renderizarFlores(flores) {
        elements.floresContainer.innerHTML = '';
        flores.forEach(flor => {
            const precioUnit = parseFloat(flor.Precio_Unitario);
            const precioDoc = parseFloat(flor.Precio_Docena) || 0;
            
            if(!estadoPedido.flores[flor.ID]) { estadoPedido.flores[flor.ID] = { nombre: flor.Nombre, precio: precioUnit, precioDocena: precioDoc, cantidad: 0 }; } 
            else { estadoPedido.flores[flor.ID].precio = precioUnit; estadoPedido.flores[flor.ID].precioDocena = precioDoc; }
            
            const cantidadActual = estadoPedido.flores[flor.ID].cantidad;
            const txtPrecio = esTemporada ? '<span class="text-rose-600">Variable</span>' : `$${precioUnit} c/u ${precioDoc>0 ? `| <span class="text-emerald-600">Docena $${precioDoc}</span>` : ''}`;

            const html = `
                <div id="flor-card-${flor.ID}" class="flor-card bg-white p-3 rounded-xl border-2 ${cantidadActual>0 ? 'border-oro bg-rosa-suave' : 'border-[#E8DCC4]'} flex items-center justify-between shadow-sm transition duration-300">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-stone-100 rounded-lg bg-cover bg-center border border-stone-200 cursor-pointer" style="background-image: url('${flor.Imagen_URL || ''}')" onclick="abrirImagen(event, '${flor.Imagen_URL || ''}')"></div>
                        <div>
                            <h4 class="font-semibold text-sm text-cafe">${flor.Nombre}</h4>
                            <p class="text-[10px] text-oro font-bold">${txtPrecio}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="modificarCantidadFlor('${flor.ID}', -1)" class="w-8 h-8 rounded-lg bg-[#FAF6F0] text-cafe font-bold border border-[#E8DCC4]">-</button>
                        <span id="qty-${flor.ID}" class="text-sm font-semibold w-6 text-center text-cafe">${cantidadActual}</span>
                        <button type="button" onclick="modificarCantidadFlor('${flor.ID}', 1)" class="w-8 h-8 rounded-lg bg-oro text-white font-bold">+</button>
                    </div>
                </div>
            `;
            elements.floresContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    window.modificarCantidadFlor = function(id, cambio) {
        const nuevaCant = estadoPedido.flores[id].cantidad + cambio;
        if(nuevaCant >= 0) {
            estadoPedido.flores[id].cantidad = nuevaCant;
            document.getElementById(`qty-${id}`).textContent = nuevaCant;
            const card = document.getElementById(`flor-card-${id}`);
            if(nuevaCant > 0) { card.classList.replace('border-[#E8DCC4]', 'border-oro'); card.classList.add('bg-rosa-suave'); } 
            else { card.classList.replace('border-oro', 'border-[#E8DCC4]'); card.classList.remove('bg-rosa-suave'); }
            calcularTotal();
        }
    }

    function renderizarPapeles(papeles) {
        elements.papelesContainer.innerHTML = '';
        papeles.forEach((papel, index) => {
            const bgStyle = papel.Imagen_URL && papel.Imagen_URL.length > 50 ? `background-image: url('${papel.Imagen_URL}'); background-size: cover; background-position: center;` : `background-color: #E8DCC4;`;
            const html = `
                <label class="cursor-pointer border-2 border-[#E8DCC4] rounded-xl p-2.5 flex flex-col items-center bg-white transition relative group hover:border-oro">
                    <input type="radio" name="papel" value="${papel.Nombre}" class="peer sr-only" ${index === 0 ? 'checked' : ''}>
                    <div class="absolute -top-2 -right-2 bg-oro text-white p-1 rounded-full opacity-0 peer-checked:opacity-100 transition shadow-md z-10 transform peer-checked:scale-100 scale-75">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <div class="w-12 h-12 rounded-full mb-2 shadow-inner border border-stone-300 peer-checked:ring-4 peer-checked:ring-rosa-suave transition" style="${bgStyle}"></div>
                    <span class="text-[10px] font-semibold text-cafe text-center leading-tight group-hover:text-oro">${papel.Nombre}</span>
                    <div class="absolute inset-0 border-2 border-transparent peer-checked:border-oro peer-checked:bg-rosa-suave peer-checked:bg-opacity-20 rounded-xl pointer-events-none transition"></div>
                </label>
            `;
            elements.papelesContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    function renderizarExtras(extras) {
        elements.extrasContainer.innerHTML = '';
        extras.forEach(extra => {
            if(!estadoPedido.extras[extra.ID]) estadoPedido.extras[extra.ID] = { nombre: extra.Nombre, precio: parseFloat(extra.Precio), seleccionado: false };
            else { estadoPedido.extras[extra.ID].precio = parseFloat(extra.Precio); estadoPedido.extras[extra.ID].nombre = extra.Nombre; }
            const estaSeleccionado = estadoPedido.extras[extra.ID].seleccionado;
            
            const imgHtml = extra.Imagen_URL && extra.Imagen_URL.length > 50 ? `<div class="w-10 h-10 bg-stone-100 rounded-lg bg-cover bg-center border border-[#E8DCC4] flex-shrink-0 cursor-pointer" style="background-image: url('${extra.Imagen_URL}')" onclick="abrirImagen(event, '${extra.Imagen_URL}')"></div>` : '';
            const esTarjeta = extra.Nombre.toLowerCase().includes('tarjeta');
            const textareaHtml = esTarjeta ? `<div id="caja-mensaje-${extra.ID}" class="${estaSeleccionado ? '' : 'hidden'} w-full pl-10 pr-3 pb-3 mt-1"><textarea id="mensaje-${extra.ID}" rows="2" placeholder="Escribe aquí tu dedicatoria..." class="w-full bg-stone-50 border border-[#E8DCC4] rounded-lg p-2 text-xs text-cafe focus:outline-none focus:border-oro transition"></textarea></div>` : '';

            const html = `
                <div class="flex flex-col bg-white rounded-xl border-2 ${estaSeleccionado ? 'border-oro bg-rosa-suave' : 'border-[#E8DCC4]'} transition-all duration-300" id="contenedor-extra-${extra.ID}">
                    <label id="label-extra-${extra.ID}" class="flex items-center space-x-3 p-3 cursor-pointer">
                        <input type="checkbox" id="chk-${extra.ID}" data-id="${extra.ID}" data-estarjeta="${esTarjeta}" ${estaSeleccionado ? 'checked' : ''} class="extra-checkbox sr-only">
                        <div id="box-${extra.ID}" class="w-5 h-5 flex-shrink-0 border-2 ${estaSeleccionado ? 'border-oro bg-oro' : 'border-[#E8DCC4]'} rounded flex items-center justify-center transition-colors"><svg id="svg-${extra.ID}" class="w-3 h-3 text-white ${estaSeleccionado ? '' : 'hidden'}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                        ${imgHtml}
                        <span class="text-sm font-medium flex-1 text-cafe leading-tight">${extra.Nombre}</span>
                        <span class="text-xs text-oro font-bold">${esTemporada ? '' : `+$${extra.Precio}`}</span>
                    </label>
                    ${textareaHtml}
                </div>
            `;
            elements.extrasContainer.insertAdjacentHTML('beforeend', html);
        });

        document.querySelectorAll('.extra-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id, esTarjeta = e.target.dataset.estarjeta === 'true', isChecked = e.target.checked;
                estadoPedido.extras[id].seleccionado = isChecked;
                const box = document.getElementById(`box-${id}`), svg = document.getElementById(`svg-${id}`), contenedor = document.getElementById(`contenedor-extra-${id}`);
                if (isChecked) {
                    box.classList.replace('border-[#E8DCC4]', 'border-oro'); box.classList.add('bg-oro'); svg.classList.remove('hidden');
                    contenedor.classList.replace('border-[#E8DCC4]', 'border-oro'); contenedor.classList.add('bg-rosa-suave');
                    if(esTarjeta) document.getElementById(`caja-mensaje-${id}`).classList.remove('hidden');
                } else {
                    box.classList.replace('border-oro', 'border-[#E8DCC4]'); box.classList.remove('bg-oro'); svg.classList.add('hidden');
                    contenedor.classList.replace('border-oro', 'border-[#E8DCC4]'); contenedor.classList.remove('bg-rosa-suave');
                    if(esTarjeta) document.getElementById(`caja-mensaje-${id}`).classList.add('hidden');
                }
                calcularTotal();
            });
        });
    }

    // ==========================================================================
    // 5. CALCULADORA (Mayoreo y Temporadas)
    // ==========================================================================
    function calcularTotal() {
        if(esTemporada) {
            elements.totalPrice.innerHTML = `A Cotizar <span class="text-[10px] block text-rose-600 font-bold uppercase mt-0.5">Temporada Alta</span>`;
            estadoPedido.total = "A cotizar";
            return;
        }

        let total = estadoPedido.basePrecio;
        
        for (let key in estadoPedido.flores) {
            const flor = estadoPedido.flores[key];
            if(flor.cantidad > 0) {
                // Lógica de Mayoreo (Docena)
                if (flor.precioDocena > 0 && flor.cantidad >= 12) {
                    let docenas = Math.floor(flor.cantidad / 12);
                    let sueltas = flor.cantidad % 12;
                    total += (docenas * flor.precioDocena) + (sueltas * flor.precio);
                } else {
                    total += (flor.cantidad * flor.precio);
                }
            }
        }
        
        for (let key in estadoPedido.extras) {
            if(estadoPedido.extras[key].seleccionado) total += estadoPedido.extras[key].precio;
        }
        
        estadoPedido.total = total;
        elements.totalPrice.innerHTML = `$${total.toFixed(2)} <span class="text-xs font-sans font-normal">MXN</span>`;
    }

    // ==========================================================================
    // 6. NAVEGACIÓN Y ENVÍO A WHATSAPP
    // ==========================================================================
    function updateWizard() {
        elements.steps.forEach((step, index) => { if (index + 1 === currentStep) step.classList.remove('hidden'); else step.classList.add('hidden'); });
        elements.indicators.forEach((indicator, index) => {
            if (index + 1 === currentStep) { indicator.classList.add('text-oro', 'font-bold', 'border-oro'); indicator.classList.remove('inactive'); } 
            else { indicator.classList.remove('text-oro', 'font-bold', 'border-oro'); indicator.classList.add('inactive'); }
        });
        elements.btnPrev.classList.toggle('hidden', currentStep === 1);
        
        if (currentStep === totalSteps) { elements.btnNext.classList.add('hidden'); elements.btnWhatsApp.classList.remove('hidden'); } 
        else { elements.btnNext.classList.remove('hidden'); elements.btnWhatsApp.classList.add('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    elements.btnNext.addEventListener('click', () => { if (currentStep < totalSteps) { currentStep++; updateWizard(); } });
    elements.btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateWizard(); } });

    elements.btnWhatsApp.addEventListener('click', async () => {
        const papelInput = document.querySelector('input[name="papel"]:checked');
        estadoPedido.papelNombre = papelInput ? papelInput.value : "Sin papel";
        const listonNombre = document.getElementById('selector-liston').value;
        const cNombre = document.getElementById('cliente-nombre').value || "Cliente Nuevo";
        const cTel = document.getElementById('cliente-telefono').value || "-";
        const fEntrega = document.getElementById('fecha-entrega').value || "Lo antes posible";
        const tEntrega = document.getElementById('tipo-entrega').value;

        let extrasListParaSheets = []; let extrasTxtParaWhatsApp = "";
        for (let key in estadoPedido.extras) {
            if(estadoPedido.extras[key].seleccionado) {
                let txtNombreExtra = estadoPedido.extras[key].nombre;
                const txtArea = document.getElementById(`mensaje-${key}`);
                if(txtArea && txtArea.value.trim() !== "") {
                    extrasTxtParaWhatsApp += `   - ${txtNombreExtra}\n     *Mensaje:* "${txtArea.value.trim()}"\n`;
                    extrasListParaSheets.push(`${txtNombreExtra} (Dedicatoria: ${txtArea.value.trim()})`);
                } else {
                    extrasTxtParaWhatsApp += `   - ${txtNombreExtra}\n`; extrasListParaSheets.push(txtNombreExtra);
                }
            }
        }
        let listonYExtrasStr = listonNombre;
        if(extrasListParaSheets.length > 0) listonYExtrasStr += ` | Extras: ${extrasListParaSheets.join(', ')}`;

        const datosParaGuardar = { baseNombre: estadoPedido.baseNombre, flores: Object.values(estadoPedido.flores).filter(f => f.cantidad > 0), papelNombre: estadoPedido.papelNombre, listonNombre: listonYExtrasStr, clienteNombre: cNombre, clienteTelefono: cTel, fechaEntrega: fEntrega, horarioEntrega: "Coordinar por chat", tipoServicio: tEntrega, modalidadPago: "Transferencia/Efectivo", total: estadoPedido.total };

        const originalBtnHTML = elements.btnWhatsApp.innerHTML;
        elements.btnWhatsApp.innerHTML = `Procesando...`; elements.btnWhatsApp.disabled = true;

        try { await fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ accion: 'guardar_pedido', pedido: datosParaGuardar }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }); } 
        catch (error) { console.error("Error BD", error); }
        elements.btnWhatsApp.innerHTML = originalBtnHTML; elements.btnWhatsApp.disabled = false;

        let mensaje = `🌸 *NUEVO PEDIDO PERSONALIZADO* 🌸\n\n`;
        mensaje += `👤 *Cliente:* ${cNombre}\n📞 *Tel:* ${cTel}\n🚚 *Entrega:* ${tEntrega} (${fEntrega})\n\n`;
        mensaje += `*📦 DETALLES DEL DISEÑO:*\n• *Base:* ${estadoPedido.baseNombre}\n`;
        
        let floresTxt = "";
        datosParaGuardar.flores.forEach(f => { floresTxt += `   - ${f.cantidad}x ${f.nombre}\n`; });
        if(floresTxt) mensaje += `• *Flores:*\n${floresTxt}`;
        mensaje += `• *Papel:* ${estadoPedido.papelNombre}\n• *Listón:* ${listonNombre}\n`;
        if(extrasTxtParaWhatsApp !== "") mensaje += `• *Extras:*\n${extrasTxtParaWhatsApp}`;
        
        // Mensaje especial si es temporada alta
        if (esTemporada) {
            mensaje += `\n⚠️ *PRECIO A COTIZAR*\n_Debido a la alta demanda de la fecha seleccionada, el precio final será acordado con tu florista por este medio._\n`;
        } else {
            mensaje += `\n💰 *Total Estimado:* $${estadoPedido.total.toFixed(2)} MXN\n`;
        }

        mensaje += `\n💳 *DATOS PARA PAGO / ANTICIPO:*\nBanco: [AQUÍ TU BANCO]\nCuenta: [0000000000]\nCLABE: [000000000000000000]\nTitular: Venny Flowers\n\n_Hola, acabo de armar mi ramo desde su app, quiero confirmar mi pedido._`;

        window.open(`https://wa.me/523327593202?text=${encodeURIComponent(mensaje)}`, '_blank');
    });

    inicializarSistema();
});

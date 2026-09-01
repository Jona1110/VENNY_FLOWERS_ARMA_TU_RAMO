/* ==========================================================================
   Lógica del Menú Interactivo - Conectado a Google Sheets
   ========================================================================== */

// 🔴 IMPORTANTE: Pega aquí la URL de tu implementación de Apps Script
const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwy7qdPM56p_NT0VRM-f9QMGFD_9jxgCzOIzYcUKrFsOdDOd-ABwEGUjFvjpTRDHgCfSQ/exec";

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
        indicators: document.querySelectorAll('.step-indicator')
    };
    
    let estadoPedido = {
        baseNombre: "", basePrecio: 0, flores: {}, papelNombre: "", extras: {}, total: 0
    };

    // 1. INICIALIZAR Y TRAER DATOS
    async function inicializarSistema() {
        try {
            const response = await fetch(`${URL_GOOGLE_SCRIPT}?accion=obtener_catalogo`);
            const json = await response.json();
            
            if(json.exito) {
                renderizarBases(json.datos.bases);
                renderizarFlores(json.datos.flores);
                renderizarPapeles(json.datos.papeles);
                renderizarExtras(json.datos.extras);
                
                elements.pantallaCarga.classList.add('hidden');
                updateWizard();
            }
        } catch (error) {
            console.error("Error: ", error);
            alert("No se pudo cargar el catálogo.");
        }
    }

    // 2. RENDERIZAR BASES
    function renderizarBases(bases) {
        elements.basesContainer.innerHTML = '';
        bases.forEach((base, index) => {
            const precioNum = parseFloat(base.Precio);
            const textoPrecio = precioNum > 0 ? `+$${precioNum}` : "Sin costo base";

            const html = `
                <label class="cursor-pointer border-2 border-[#E8DCC4] rounded-xl p-3 flex flex-col items-center text-center transition bg-white shadow-sm peer-checked:border-oro peer-checked:bg-rosa-suave relative">
                    <input type="radio" name="base_ramo" value="${base.Nombre}" data-precio="${precioNum}" class="peer sr-only" ${index === 0 ? 'checked' : ''}>
                    <div class="w-full h-24 bg-stone-100 rounded-lg mb-2 bg-cover bg-center border border-stone-200 peer-checked:border-oro transition" style="background-image: url('${base.Imagen_URL || ''}')"></div>
                    <span class="font-semibold text-sm text-cafe">${base.Nombre}</span>
                    <span class="text-xs text-oro font-bold mt-1">${textoPrecio}</span>
                    <div class="absolute inset-0 border-2 border-transparent peer-checked:border-oro rounded-xl pointer-events-none transition"></div>
                </label>
            `;
            elements.basesContainer.insertAdjacentHTML('beforeend', html);
        });

        const primerRadio = document.querySelector('input[name="base_ramo"]:checked');
        if(primerRadio) {
            estadoPedido.baseNombre = primerRadio.value;
            estadoPedido.basePrecio = parseFloat(primerRadio.dataset.precio);
        }
        
        document.querySelectorAll('input[name="base_ramo"]').forEach(r => {
            r.addEventListener('change', (e) => {
                estadoPedido.baseNombre = e.target.value;
                estadoPedido.basePrecio = parseFloat(e.target.dataset.precio);
                calcularTotal();
            });
        });
    }

    // 3. RENDERIZAR FLORES
    function renderizarFlores(flores) {
        elements.floresContainer.innerHTML = '';
        flores.forEach(flor => {
            estadoPedido.flores[flor.ID] = { nombre: flor.Nombre, precio: parseFloat(flor.Precio_Unitario), cantidad: 0 };
            
            const html = `
                <div id="flor-card-${flor.ID}" class="flor-card bg-white p-3 rounded-xl border-2 border-[#E8DCC4] flex items-center justify-between shadow-sm transition duration-300">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-stone-100 rounded-lg bg-cover bg-center border border-stone-200" style="background-image: url('${flor.Imagen_URL || ''}')"></div>
                        <div>
                            <h4 class="font-semibold text-sm text-cafe">${flor.Nombre}</h4>
                            <p class="text-xs text-oro font-bold">$${flor.Precio_Unitario} c/u</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="modificarCantidadFlor('${flor.ID}', -1)" class="w-8 h-8 rounded-lg bg-[#FAF6F0] text-cafe font-bold flex items-center justify-center border border-[#E8DCC4] hover:bg-stone-200 transition">-</button>
                        <span id="qty-${flor.ID}" class="text-sm font-semibold w-6 text-center text-cafe">0</span>
                        <button type="button" onclick="modificarCantidadFlor('${flor.ID}', 1)" class="w-8 h-8 rounded-lg bg-oro text-white font-bold flex items-center justify-center shadow-sm hover:bg-[#b58f4a] transition">+</button>
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
            if(nuevaCant > 0) {
                card.classList.replace('border-[#E8DCC4]', 'border-oro');
                card.classList.add('bg-rosa-suave');
            } else {
                card.classList.replace('border-oro', 'border-[#E8DCC4]');
                card.classList.remove('bg-rosa-suave');
            }
            calcularTotal();
        }
    }

    // 4. RENDERIZAR PAPELES (Soporte de Imagenes)
    function renderizarPapeles(papeles) {
        elements.papelesContainer.innerHTML = '';
        papeles.forEach((papel, index) => {
            const bgStyle = papel.Imagen_URL && papel.Imagen_URL.length > 50 
                ? `background-image: url('${papel.Imagen_URL}'); background-size: cover; background-position: center;` 
                : `background-color: #E8DCC4;`;

            const html = `
                <label class="cursor-pointer border-2 border-[#E8DCC4] rounded-xl p-2.5 flex flex-col items-center bg-white transition relative">
                    <input type="radio" name="papel" value="${papel.Nombre}" class="peer sr-only" ${index === 0 ? 'checked' : ''}>
                    <div class="w-12 h-12 rounded-full mb-2 shadow-inner border border-stone-300" style="${bgStyle}"></div>
                    <span class="text-[10px] font-semibold text-cafe text-center leading-tight">${papel.Nombre}</span>
                    <div class="absolute inset-0 border-2 border-transparent peer-checked:border-oro peer-checked:bg-rosa-suave peer-checked:bg-opacity-20 rounded-xl pointer-events-none transition"></div>
                </label>
            `;
            elements.papelesContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    // 5. RENDERIZAR EXTRAS (Soporte de Imagenes)
    function renderizarExtras(extras) {
        elements.extrasContainer.innerHTML = '';
        extras.forEach(extra => {
            estadoPedido.extras[extra.ID] = { nombre: extra.Nombre, precio: parseFloat(extra.Precio), seleccionado: false };
            
            const imgHtml = extra.Imagen_URL && extra.Imagen_URL.length > 50 
                ? `<div class="w-10 h-10 bg-stone-100 rounded-lg bg-cover bg-center border border-[#E8DCC4]" style="background-image: url('${extra.Imagen_URL}')"></div>` 
                : '';

            const html = `
                <label id="label-extra-${extra.ID}" class="flex items-center space-x-3 bg-white p-3 rounded-xl border-2 border-[#E8DCC4] cursor-pointer transition-all duration-300">
                    <input type="checkbox" id="chk-${extra.ID}" data-id="${extra.ID}" class="extra-checkbox sr-only">
                    
                    <div id="box-${extra.ID}" class="w-5 h-5 flex-shrink-0 border-2 border-[#E8DCC4] rounded flex items-center justify-center transition-colors duration-300">
                        <svg id="svg-${extra.ID}" class="w-3 h-3 text-white hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    
                    ${imgHtml}
                    
                    <span class="text-sm font-medium flex-1 text-cafe leading-tight">${extra.Nombre}</span>
                    <span class="text-xs text-oro font-bold whitespace-nowrap">+$${extra.Precio}</span>
                </label>
            `;
            elements.extrasContainer.insertAdjacentHTML('beforeend', html);
        });

        document.querySelectorAll('.extra-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const isChecked = e.target.checked;
                estadoPedido.extras[id].seleccionado = isChecked;
                
                const box = document.getElementById(`box-${id}`);
                const svg = document.getElementById(`svg-${id}`);
                const label = document.getElementById(`label-extra-${id}`);

                if (isChecked) {
                    box.classList.replace('border-[#E8DCC4]', 'border-oro');
                    box.classList.add('bg-oro');
                    svg.classList.remove('hidden');
                    
                    label.classList.replace('border-[#E8DCC4]', 'border-oro');
                    label.classList.replace('bg-white', 'bg-rosa-suave');
                } else {
                    box.classList.replace('border-oro', 'border-[#E8DCC4]');
                    box.classList.remove('bg-oro');
                    svg.classList.add('hidden');
                    
                    label.classList.replace('border-oro', 'border-[#E8DCC4]');
                    label.classList.replace('bg-rosa-suave', 'bg-white');
                }
                calcularTotal();
            });
        });
    }

    // 6. CALCULADORA Y WIZARD
    function calcularTotal() {
        let total = estadoPedido.basePrecio;
        for (let key in estadoPedido.flores) {
            total += (estadoPedido.flores[key].cantidad * estadoPedido.flores[key].precio);
        }
        for (let key in estadoPedido.extras) {
            if(estadoPedido.extras[key].seleccionado) {
                total += estadoPedido.extras[key].precio;
            }
        }
        estadoPedido.total = total;
        elements.totalPrice.innerHTML = `$${total.toFixed(2)} <span class="text-xs font-sans font-normal">MXN</span>`;
    }

    function updateWizard() {
        elements.steps.forEach((step, index) => {
            if (index + 1 === currentStep) step.classList.remove('hidden');
            else step.classList.add('hidden');
        });

        elements.indicators.forEach((indicator, index) => {
            if (index + 1 === currentStep) {
                indicator.classList.add('text-oro', 'font-bold', 'border-oro');
                indicator.classList.remove('inactive');
            } else {
                indicator.classList.remove('text-oro', 'font-bold', 'border-oro');
                indicator.classList.add('inactive');
            }
        });

        elements.btnPrev.classList.toggle('hidden', currentStep === 1);
        
        if (currentStep === totalSteps) {
            elements.btnNext.classList.add('hidden');
            elements.btnWhatsApp.classList.remove('hidden');
        } else {
            elements.btnNext.classList.remove('hidden');
            elements.btnWhatsApp.classList.add('hidden');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    elements.btnNext.addEventListener('click', () => { if (currentStep < totalSteps) { currentStep++; updateWizard(); } });
    elements.btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateWizard(); } });

    // 7. GUARDAR EN SHEETS Y ENVIAR A WHATSAPP
    elements.btnWhatsApp.addEventListener('click', async () => {
        const papelInput = document.querySelector('input[name="papel"]:checked');
        estadoPedido.papelNombre = papelInput ? papelInput.value : "Sin papel";
        const listonNombre = document.getElementById('selector-liston').value;
        const cNombre = document.getElementById('cliente-nombre').value || "Cliente Nuevo";
        const cTel = document.getElementById('cliente-telefono').value || "-";
        const fEntrega = document.getElementById('fecha-entrega').value || "Lo antes posible";
        const tEntrega = document.getElementById('tipo-entrega').value;

        const datosParaGuardar = {
            baseNombre: estadoPedido.baseNombre,
            flores: Object.values(estadoPedido.flores).filter(f => f.cantidad > 0),
            papelNombre: estadoPedido.papelNombre,
            listonNombre: listonNombre,
            clienteNombre: cNombre,
            clienteTelefono: cTel,
            fechaEntrega: fEntrega,
            horarioEntrega: "Coordinar por chat", 
            tipoServicio: tEntrega,
            modalidadPago: "Por definir", 
            total: estadoPedido.total
        };

        const originalBtnHTML = elements.btnWhatsApp.innerHTML;
        elements.btnWhatsApp.innerHTML = `<span class="animate-pulse">Procesando...</span>`;
        elements.btnWhatsApp.disabled = true;

        try {
            await fetch(URL_GOOGLE_SCRIPT, {
                method: 'POST',
                body: JSON.stringify({ accion: 'guardar_pedido', pedido: datosParaGuardar }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
        } catch (error) { console.error("Fallo al guardar en base de datos, pero enviaremos el WhatsApp:", error); }

        elements.btnWhatsApp.innerHTML = originalBtnHTML;
        elements.btnWhatsApp.disabled = false;

        let mensaje = `🌸 *NUEVO PEDIDO PERSONALIZADO* 🌸\n\n`;
        mensaje += `👤 *Cliente:* ${cNombre}\n`;
        mensaje += `📞 *Tel:* ${cTel}\n`;
        mensaje += `🚚 *Entrega:* ${tEntrega} (${fEntrega})\n\n`;
        
        mensaje += `*📦 DETALLES DEL DISEÑO:*\n`;
        mensaje += `• *Base:* ${estadoPedido.baseNombre}\n`;
        
        let floresTxt = "";
        datosParaGuardar.flores.forEach(f => { floresTxt += `   - ${f.cantidad}x ${f.nombre}\n`; });
        if(floresTxt) mensaje += `• *Flores:*\n${floresTxt}`;
        
        mensaje += `• *Papel:* ${estadoPedido.papelNombre}\n`;
        mensaje += `• *Listón:* ${listonNombre}\n`;
        
        let extrasTxt = "";
        for (let key in estadoPedido.extras) {
            if(estadoPedido.extras[key].seleccionado) extrasTxt += `   - ${estadoPedido.extras[key].nombre}\n`;
        }
        if(extrasTxt) mensaje += `• *Extras:*\n${extrasTxt}`;
        
        mensaje += `\n💰 *Total Estimado:* $${estadoPedido.total.toFixed(2)} MXN\n\n`;
        mensaje += `_Hola, acabo de armar mi ramo desde su app, quiero confirmar mi pedido._`;

        const urlWhatsApp = `https://wa.me/523322961969?text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, '_blank');
    });

    inicializarSistema();
});
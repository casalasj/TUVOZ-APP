// --- 1. CONFIGURACIÓN BÁSICA ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('btnDark').innerHTML = isDark ? '<i class="fa-solid fa-sun"></i> Modo Claro' : '<i class="fa-solid fa-moon"></i> Modo Oscuro';
}
function toggleColorblindMode() { document.body.classList.toggle('colorblind-mode'); }

// --- 2. SÍNTESIS DE VOZ ---
const ELEVENLABS_API_KEY = 'sk_fba7cc72a408c68f8130c345cefa201c80be1535c2633f92'; 

async function speakText() {
    let textInput = document.getElementById('textToSpeak').value;
    let voiceId = document.getElementById('voiceSelect').value;

    if (textInput !== '') {
        const btnHablar = document.querySelector('.btn-primary');
        const textoOriginal = btnHablar.innerHTML;
        btnHablar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...';
        btnHablar.disabled = true;

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textInput, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
            });

            if (!response.ok) throw new Error('Error de API');

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);

            audio.playbackRate = document.getElementById('speedSlider').value;
            addToHistory(textInput);

            audio.onended = function() { clearText(); URL.revokeObjectURL(audioUrl); };
            audio.play();
        } catch (error) {
            alert('Error al generar la voz. Verifica tu conexión y tu API Key.');
        } finally {
            btnHablar.innerHTML = textoOriginal;
            btnHablar.disabled = false;
        }
    }
}
function clearText() { document.getElementById('textToSpeak').value = ''; }

// --- 3. RECONOCIMIENTO DE VOZ (STT) + HÁPTICO ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;
const statusPill = document.getElementById('listeningStatus');
const recognizedTextArea = document.getElementById('recognizedText');

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-CL';

    recognition.onstart = function() {
        isListening = true;
        statusPill.textContent = 'Escuchando...';
        statusPill.classList.add('active');
        if(navigator.vibrate) navigator.vibrate(100); // Feedback inicio
    };

    recognition.onresult = function(event) {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + '. ';
        }
        if(finalTranscript) {
            recognizedTextArea.value += finalTranscript;
            recognizedTextArea.scrollTop = recognizedTextArea.scrollHeight;
        }
    };
    recognition.onerror = function() { stopListening(); };
    recognition.onend = function() {
        if(isListening) recognition.start();
        else {
            statusPill.textContent = 'Inactivo';
            statusPill.classList.remove('active');
        }
    };
}
function startListening() { if (recognition && !isListening) recognition.start(); }
function stopListening() {
    if (recognition && isListening) {
        isListening = false;
        recognition.stop();
        statusPill.textContent = 'Inactivo';
        statusPill.classList.remove('active');
        if(navigator.vibrate) navigator.vibrate([100, 50, 100]); // Feedback fin
    }
}
function copyToResponse() { document.getElementById('textToSpeak').value += (document.getElementById('textToSpeak').value ? ' ' : '') + recognizedTextArea.value; }

// --- 4. FUNCIONALIDADES AVANZADAS ---

// 4.1 S.O.S GPS
function triggerSOS() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const mapLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            const msg = encodeURIComponent(`S.O.S. Tengo una emergencia, no puedo hablar ni escuchar. Esta es mi ubicación actual: ${mapLink}`);
            window.open(`https://wa.me/?text=${msg}`, '_blank');
        }, () => { alert("No se pudo obtener la ubicación. Activa el GPS de tu dispositivo."); });
    } else { alert("Tu navegador no soporta GPS."); }
}

// 4.2 Alerta de Ruido
let audioContext, analyser, microphone, noiseAlertActive = false, animationId;
async function toggleNoiseAlert() {
    noiseAlertActive = !noiseAlertActive;
    const btn = document.getElementById('btnNoise');
    if (noiseAlertActive) {
        btn.style.color = '#ef4444';
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function detectNoise() {
                if(!noiseAlertActive) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                let average = sum / dataArray.length;
                
                // Si el ruido supera el umbral (100)
                if(average > 100) {
                    document.body.classList.add('flash-alert');
                    if(navigator.vibrate) navigator.vibrate([300, 100, 300]);
                    setTimeout(() => document.body.classList.remove('flash-alert'), 3000); // Pausa antes de la siguiente alerta
                }
                animationId = requestAnimationFrame(detectNoise);
            }
            detectNoise();
        } catch(err) {
            alert("Se necesita acceso al micrófono para las alertas.");
            noiseAlertActive = false;
            btn.style.color = 'var(--text-main)';
        }
    } else {
        btn.style.color = 'var(--text-main)';
        if(audioContext) audioContext.close();
        cancelAnimationFrame(animationId);
    }
}

// 4.3 Modo Letrero
function openLetrero() {
    const text = document.getElementById('textToSpeak').value;
    if(!text) return;
    document.getElementById('letreroText').textContent = text;
    document.getElementById('letreroModal').style.display = 'flex';
}
function closeLetrero() { document.getElementById('letreroModal').style.display = 'none'; }

// 4.4 Pizarra de Dibujo
const canvas = document.getElementById('pizarraCanvas');
const ctx = canvas.getContext('2d');
let painting = false;

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight - 60; }
function startPosition(e) { painting = true; draw(e); }
function endPosition() { painting = false; ctx.beginPath(); }
function draw(e) {
    if (!painting) return;
    e.preventDefault();
    let clientX = e.clientX || e.touches[0].clientX;
    let clientY = (e.clientY || e.touches[0].clientY) - 60; // Ajuste por el header
    ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    ctx.lineTo(clientX, clientY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(clientX, clientY);
}
canvas.addEventListener('mousedown', startPosition); canvas.addEventListener('mouseup', endPosition); canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', startPosition); canvas.addEventListener('touchend', endPosition); canvas.addEventListener('touchmove', draw);

function openPizarra() { document.getElementById('pizarraModal').style.display = 'flex'; resizeCanvas(); }
function closePizarra() { document.getElementById('pizarraModal').style.display = 'none'; }
function clearPizarra() { ctx.clearRect(0,0, canvas.width, canvas.height); }

// 4.5 Alarma, Historial y Predictivo
function playAlarm() {
    const ctxA = new (window.AudioContext || window.webkitAudioContext)();
    function createBeep(freq, start) {
        const osc = ctxA.createOscillator(), gain = ctxA.createGain();
        osc.connect(gain); gain.connect(ctxA.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(1, start); gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        osc.start(start); osc.stop(start + 0.5);
    }
    createBeep(880, ctxA.currentTime); createBeep(1100, ctxA.currentTime + 0.15);
}

let speechHistory = [];
function addToHistory(text) {
    if (!text || (speechHistory.length > 0 && speechHistory[0] === text)) return;
    speechHistory.unshift(text);
    if (speechHistory.length > 5) speechHistory.pop();
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    speechHistory.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'history-item'; btn.textContent = t;
        btn.onclick = () => { document.getElementById('textToSpeak').value = t; };
        historyList.appendChild(btn);
    });
}

// NUEVO: Función para limpiar el historial manualmente
function clearHistory() {
    speechHistory = []; // Vaciamos el arreglo de historial
    document.getElementById('historyList').innerHTML = ''; // Limpiamos el contenedor en el HTML
}

const commonWords = ["por favor", "gracias", "necesito", "ayuda", "baño", "comer", "tomar", "agua", "duele", "mucho", "poco", "dónde está", "quiero", "ir", "casa"];
document.getElementById('textToSpeak').addEventListener('input', (e) => {
    const currentText = e.target.value.toLowerCase(), words = currentText.split(' '), lastWord = words[words.length - 1];
    const suggestionsRow = document.getElementById('suggestions'); suggestionsRow.innerHTML = '';
    if (lastWord.length > 1) {
        commonWords.filter(w => w.startsWith(lastWord) && w !== lastWord).forEach(match => {
            const chip = document.createElement('button'); chip.className = 'suggestion-chip'; chip.textContent = match;
            chip.onclick = () => { words[words.length - 1] = match; e.target.value = words.join(' ') + ' '; e.target.focus(); suggestionsRow.innerHTML = ''; };
            suggestionsRow.appendChild(chip);
        });
    }
});

let lastX, lastY, lastZ;
window.addEventListener('devicemotion', (e) => {
    let acc = e.accelerationIncludingGravity; if (!acc.x) return;
    if (Math.abs(acc.x - lastX) + Math.abs(acc.y - lastY) + Math.abs(acc.z - lastZ) > 15) {
        if (document.getElementById('textToSpeak').value.trim() !== '') { clearText(); if (navigator.vibrate) navigator.vibrate(100); }
    }
    lastX = acc.x; lastY = acc.y; lastZ = acc.z;
});

// --- 5. ATAJOS RÁPIDOS, GÉNERO Y FAVORITOS ---
// Cargar favoritos guardados en el dispositivo
let misFavoritos = JSON.parse(localStorage.getItem('tuvoz_favoritos')) || [];

const shortcutsData = {
    "⭐ Favoritos": misFavoritos,
    "Uso Diario": [
        { text: "Hola, ¿cómo estás?", icon: "👋" },
        { text: "Estoy bien, gracias", icon: "👍" },
        { text: "Me llamo ______", icon: "👤" },
        { text: "Tengo ___ años", icon: "🎂" },
        { text: "Sí", icon: "✅" },
        { text: "No", icon: "❌" },
        { text: "A veces", icon: "🤷" },
        { text: "No lo sé", icon: "❓" },
        { text: "No puedo", icon: "🚫" },
        { text: "No quiero", icon: "✋" },
        { text: "Adiós", icon: "👋" },
        { text: "Nos vemos, que estés bien", icon: "🌟" },
        { text: "Soy hombre", icon: "👨" },
        { text: "Soy mujer", icon: "👩" },
        { text: "Me identifico como ____", icon: "⚧️" },
        { text: "Soy chileno/a", icon: "🇨🇱" },
        { text: "Soy extranjero/a", icon: "🌎" },
        { text: "Vivo en ______", icon: "🏠" },
        { text: "Estudio en ____", icon: "📚" },
        { text: "Trabajo en _____", icon: "💼" },
        { text: "Mi número de contacto es ______", icon: "📱" },
        { text: "Esta persona es mi contacto de emergencia", icon: "🦺" },
        { text: "Buenos días", icon: "🌅" },
        { text: "Buenas tardes", icon: "☀️" },
        { text: "Buenas noches", icon: "🌙" },
        { text: "No puedo hablar", icon: "🤐" },
        { text: "No puedo escuchar", icon: "🦻🚫" },
        { text: "Tengo una discapacidad del habla", icon: "🗣️🚫" },
        { text: "Soy sordo/a", icon: "🧏" },
        { text: "Por favor, tenga paciencia", icon: "⏳" },
        { text: "Puede escribir lo que quiere decirme", icon: "✍️" },
        { text: "Estoy usando esta app para comunicarme", icon: "📱" },
        { text: "Gracias por su comprensión", icon: "🙏" },
        { text: "Estoy perdido/a", icon: "🗺️" },
        { text: "¿Dónde estoy?", icon: "📍" },
        { text: "¿Puede ayudarme, por favor?", icon: "🤝" },
        { text: "Busco esta dirección", icon: "📍" },
        { text: "Necesito llegar a _______", icon: "🎯" },
        { text: "Estoy esperando a alguien", icon: "⌚" },
        { text: "No entiendo lo que dice", icon: "🤔" },
        { text: "¿Puede repetirlo más despacio?", icon: "🐢" }
    ],
    "Comida y Bebidas": [
        { text: "Quiero pedir, por favor", icon: "🙋" },
        { text: "Quiero esto", icon: "👉" },
        { text: "Quiero el menú del día", icon: "📋" },
        { text: "Para llevar", icon: "🛍️" },
        { text: "Para comer aquí", icon: "🍽️" },
        { text: "La cuenta, por favor", icon: "🧾" },
        { text: "¿Cuánto cuesta?", icon: "💰" },
        { text: "¿Puede recomendarme algo?", icon: "⭐" },
        { text: "Soy alérgico/a a ______", icon: "⚠️" },
        { text: "Esto no es lo que pedí", icon: "🔄" },
        { text: "¿Tiene una opción vegetariana?", icon: "🥗" },
        { text: "¿Tiene una opción vegana?", icon: "🌱" },
        { text: "Agua", icon: "💧" },
        { text: "Agua sin gas", icon: "🚰" },
        { text: "Agua con gas", icon: "🫧" },
        { text: "Bebida", icon: "🥤" },
        { text: "Bebida sin azúcar", icon: "🧊" },
        { text: "Jugo", icon: "🧃" },
        { text: "Café", icon: "☕" },
        { text: "Té", icon: "🍵" },
        { text: "¿Tiene hielo?", icon: "🧊" },
        { text: "Sin hielo, por favor", icon: "🚫🧊" },
        { text: "Quiero un completo", icon: "🌭" },
        { text: "Quiero una empanada", icon: "🥟" },
        { text: "Quiero una sopaipilla", icon: "🍘" },
        { text: "Quiero un mote con huesillo", icon: "🥤" },
        { text: "Sin picante", icon: "🌶️🚫" },
        { text: "Sin gluten", icon: "🌾🚫" }
    ],
    "Transporte y Ubicación": [
        { text: "Estoy perdido/a", icon: "🗺️" },
        { text: "¿Dónde estoy?", icon: "📍" },
        { text: "¿Dónde queda ____?", icon: "🔍" },
        { text: "Busco esta dirección", icon: "📍" },
        { text: "¿Cómo llego a _____?", icon: "🚶" },
        { text: "¿Está lejos?", icon: "📏" },
        { text: "¿Está cerca?", icon: "🤏" },
        { text: "Muéstreme en el mapa, por favor", icon: "🗺️" },
        { text: "Necesito llegar aquí", icon: "🎯" },
        { text: "¿Dónde está la salida?", icon: "🚪" },
        { text: "No sé dónde bajar", icon: "🤷" },
        { text: "Metro", icon: "🚇" },
        { text: "Micro", icon: "🚌" },
        { text: "Taxi", icon: "🚕" },
        { text: "Colectivo", icon: "🚗" },
        { text: "Uber", icon: "📱" },
        { text: "Paradero", icon: "🚏" },
        { text: "¿Esta micro va a _____?", icon: "🚌" },
        { text: "¿En qué estación debo bajar?", icon: "🚉" },
        { text: "Avísame cuando lleguemos, por favor", icon: "🔔" },
        { text: "Necesito cargar la bip", icon: "💳" },
        { text: "Quiero comprar una bip", icon: "💳" }
    ],
    "Emergencia": [
        { text: "Llame a una ambulancia, por favor", icon: "🚑" },
        { text: "Me siento muy mal", icon: "🤒" },
        { text: "Me duele aquí", icon: "🤕" },
        { text: "Tengo dificultad para respirar", icon: "🫁" },
        { text: "Estoy mareado/a", icon: "😵‍💫" },
        { text: "Tengo fiebre", icon: "🌡️" },
        { text: "Tengo vómitos", icon: "🤢" },
        { text: "Necesito ir al hospital", icon: "🏥" },
        { text: "Soy alérgico/a a _____", icon: "⚠️" },
        { text: "Tomo este medicamento", icon: "💊" },
        { text: "Estoy en peligro", icon: "🆘" },
        { text: "Llame a Carabineros, por favor", icon: "🚓" },
        { text: "Me están siguiendo", icon: "👀" },
        { text: "Tengo esta condición médica", icon: "⚕️" },
        { text: "Necesito que llamen a mi familia, por favor", icon: "👨‍👩‍👧‍👦" },
        { text: "Necesito licencia médica", icon: "📄" },
        { text: "Vengo por una hora médica", icon: "📅" },
        { text: "Necesito agendar hora", icon: "🗓️" },
        { text: "Necesito receta", icon: "📝" }
    ],
    "Trámites y Servicios": [
        { text: "Tengo una cita", icon: "📅" },
        { text: "Vengo a hacer un trámite", icon: "📁" },
        { text: "Estoy esperando atención", icon: "⏳" },
        { text: "Necesito información", icon: "ℹ️" },
        { text: "¿Dónde debo esperar?", icon: "🪑" },
        { text: "Necesito un certificado", icon: "📜" },
        { text: "Necesito renovar mi documento", icon: "🪪" },
        { text: "Perdí mi documento", icon: "🤷" },
        { text: "Aquí están mis documentos", icon: "📂" },
        { text: "¿Falta algún documento?", icon: "❓" },
        { text: "Necesito imprimir esto", icon: "🖨️" },
        { text: "Quiero hacer una transferencia", icon: "💸" },
        { text: "Quiero retirar dinero", icon: "🏧" },
        { text: "¿Cuál es mi saldo?", icon: "💰" },
        { text: "Necesito bloquear mi tarjeta", icon: "💳🚫" },
        { text: "No recuerdo mi clave", icon: "🔐" }
    ],
    "Compras y Farmacia": [
        { text: "¿Cuánto cuesta?", icon: "💵" },
        { text: "Estoy buscando esto", icon: "🔍" },
        { text: "No encuentro este producto", icon: "🤷" },
        { text: "¿Aceptan tarjeta?", icon: "💳" },
        { text: "¿Aceptan efectivo?", icon: "💵" },
        { text: "¿Me puede dar boleta?", icon: "🧾" },
        { text: "Bolsa, por favor", icon: "🛍️" },
        { text: "¿Hay descuento?", icon: "📉" },
        { text: "¿Tiene promoción?", icon: "🏷️" },
        { text: "Necesito este medicamento", icon: "💊" },
        { text: "¿Necesita receta?", icon: "📝" },
        { text: "No tengo receta", icon: "❌📝" },
        { text: "¿Tiene genérico?", icon: "💊" },
        { text: "Me duele la cabeza", icon: "🤕" },
        { text: "Me duele el estómago", icon: "🤢" },
        { text: "Soy alérgico/a a ______", icon: "⚠️" }
    ],
    "Sentimientos": [
        { text: "Estoy feliz", icon: "😊" },
        { text: "Estoy tranquilo/a", icon: "😌" },
        { text: "Estoy triste", icon: "😢" },
        { text: "Estoy enojado/a", icon: "😠" },
        { text: "Estoy frustrado/a", icon: "😤" },
        { text: "Estoy nervioso/a", icon: "😬" },
        { text: "Tengo miedo", icon: "😨" },
        { text: "Estoy confundido/a", icon: "😕" },
        { text: "Estoy cansado/a", icon: "🥱" },
        { text: "Estoy estresado/a", icon: "😫" },
        { text: "Necesito estar solo/a", icon: "👤" },
        { text: "No quiero hablar ahora", icon: "🤐" },
        { text: "Necesito apoyo", icon: "🫂" },
        { text: "No me siento bien emocionalmente", icon: "💔" },
        { text: "Esto me incomoda", icon: "😖" },
        { text: "Te quiero", icon: "❤️" },
        { text: "Te extraño", icon: "🥺" },
        { text: "Me importas", icon: "🥰" },
        { text: "Gracias por estar conmigo", icon: "🤝" },
        { text: "Me siento acompañado/a", icon: "👫" },
        { text: "Estoy orgulloso/a", icon: "🦚" },
        { text: "Me siento querido/a", icon: "💘" },
        { text: "Te amo", icon: "💖" }
    ],
    "Familia y Relaciones": [
        { text: "Ella es mi mamá", icon: "👩‍👧" },
        { text: "Él es mi papá", icon: "👨‍👦" },
        { text: "Es mi hermano", icon: "👦" },
        { text: "Es mi hermana", icon: "👧" },
        { text: "Es mi pareja", icon: "💑" },
        { text: "Es mi amigo", icon: "🙋‍♂️" },
        { text: "Es mi amiga", icon: "🙋‍♀️" },
        { text: "Es mi hijo", icon: "👶" },
        { text: "Es mi hija", icon: "👧" },
        { text: "Es mi cuidador/a", icon: "🏥" },
        { text: "Es mi tutor legal", icon: "⚖️" },
        { text: "Quiero llamar a mi mamá", icon: "📞👩" },
        { text: "Quiero llamar a mi papá", icon: "📞👨" },
        { text: "Quiero llamar a mi hijo", icon: "📞👶" },
        { text: "Me gustas", icon: "😏" },
        { text: "Me atraes", icon: "😍" },
        { text: "¿Quieres pololear conmigo?", icon: "🌹" },
        { text: "¿Te gustaría salir conmigo?", icon: "☕" },
        { text: "Quiero conocerte mejor", icon: "🗣️" },
        { text: "Estoy en una relación", icon: "💍" },
        { text: "No estoy buscando pareja", icon: "🛑" },
        { text: "Necesito tiempo", icon: "⏳" }
    ],
    "Educación y Trabajo": [
        { text: "Soy estudiante", icon: "🎒" },
        { text: "No puedo hablar", icon: "🤐" },
        { text: "Quiero participar", icon: "🙋" },
        { text: "No entendí", icon: "❓" },
        { text: "¿Puede repetir?", icon: "🔄" },
        { text: "Tengo una duda", icon: "🤔" },
        { text: "¿Puedo responder por escrito?", icon: "✍️" },
        { text: "Soy trabajador/a", icon: "👷" },
        { text: "Estoy en una entrevista", icon: "👔" },
        { text: "Tengo una reunión", icon: "🤝" },
        { text: "¿Puede enviarme la información por correo?", icon: "📧" },
        { text: "¿Cuál es el horario?", icon: "⏰" },
        { text: "¿Cuándo es la entrega?", icon: "📅" },
        { text: "¿Dónde debo ir?", icon: "📍" },
        { text: "Terminé mi trabajo", icon: "✅" },
        { text: "Necesito más tiempo", icon: "⏳" },
        { text: "Vengo a dejar currículum", icon: "📄" },
        { text: "Estoy buscando trabajo", icon: "🔎" },
        { text: "¿Están recibiendo personal?", icon: "🏢" },
        { text: "Estoy interesado en trabajar aquí", icon: "💼" },
        { text: "Busco trabajo de medio tiempo", icon: "⏱️" },
        { text: "Busco trabajo de tiempo completo", icon: "🏢" },
        { text: "Tengo experiencia en _____", icon: "⭐" },
        { text: "Tengo disponibilidad inmediata", icon: "🏃" },
        { text: "No puedo hablar, pero puedo comunicarme por aquí", icon: "📱" },
        { text: "Este es mi número ______", icon: "📞" },
        { text: "Este es mi correo ______", icon: "📧" }
    ]
};

const categoryFilters = document.getElementById('categoryFilters');
const shortcutsGrid = document.getElementById('shortcutsGrid');
let currentGender = 'A';

function setGender(gender) {
    currentGender = gender;
    document.getElementById('btnAmbos').classList.remove('active'); document.getElementById('btnMujer').classList.remove('active'); document.getElementById('btnHombre').classList.remove('active');
    if (gender === 'A') document.getElementById('btnAmbos').classList.add('active');
    if (gender === 'F') document.getElementById('btnMujer').classList.add('active');
    if (gender === 'M') document.getElementById('btnHombre').classList.add('active');

    const voiceSelect = document.getElementById('voiceSelect');
    let firstVisible = null;
    voiceSelect.querySelectorAll('option').forEach(opt => {
        if (gender === 'A' || opt.getAttribute('data-gender') === gender) { opt.style.display = ''; if (!firstVisible) firstVisible = opt; } 
        else opt.style.display = 'none';
    });
    if (firstVisible) voiceSelect.value = firstVisible.value;
    const activeCat = document.querySelector('.btn-filter.active'); if (activeCat) renderShortcuts(activeCat.textContent);
}

function renderShortcuts(category) {
    shortcutsGrid.innerHTML = '';
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    document.getElementById('filter-' + category.replace(/\s+/g, '')).classList.add('active');

    if(category === "⭐ Favoritos" && shortcutsData[category].length === 0) {
        shortcutsGrid.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center; width:100%; margin-top:10px;">Aún no tienes favoritos. Mantén presionado cualquier atajo para añadirlo aquí.</p>';
        return;
    }

    shortcutsData[category].forEach(item => {
        if (currentGender === 'F' && item.text === "Soy hombre") return;
        if (currentGender === 'M' && item.text === "Soy mujer") return;

        let displayText = item.text;
        if (currentGender === 'F') displayText = displayText.replace(/o\/a/g, 'a');
        else if (currentGender === 'M') displayText = displayText.replace(/o\/a/g, 'o');

        const btn = document.createElement('button');
        btn.className = 'shortcut-btn'; btn.innerHTML = `<span>${item.icon}</span> ${displayText}`;
        
        // Clic normal: añadir al texto
        btn.onclick = () => { document.getElementById('textToSpeak').value += (document.getElementById('textToSpeak').value ? ' ' : '') + displayText; };
        
        // Clic derecho o Mantener Presionado (Móvil): Favoritos
        btn.oncontextmenu = (e) => {
            e.preventDefault(); // Evita que salga el menú del navegador
            if (category !== "⭐ Favoritos") {
                if(confirm(`¿Añadir "${item.text}" a Favoritos?`)) {
                    misFavoritos.push(item);
                    localStorage.setItem('tuvoz_favoritos', JSON.stringify(misFavoritos));
                    shortcutsData["⭐ Favoritos"] = misFavoritos;
                }
            } else {
                if(confirm(`¿Quitar "${item.text}" de Favoritos?`)) {
                    misFavoritos = misFavoritos.filter(f => f.text !== item.text);
                    localStorage.setItem('tuvoz_favoritos', JSON.stringify(misFavoritos));
                    shortcutsData["⭐ Favoritos"] = misFavoritos;
                    renderShortcuts("⭐ Favoritos");
                }
            }
        };
        shortcutsGrid.appendChild(btn);
    });
}

Object.keys(shortcutsData).forEach((cat, index) => {
    const btn = document.createElement('button'); btn.className = 'btn-filter'; btn.id = 'filter-' + cat.replace(/\s+/g, ''); btn.textContent = cat;
    btn.onclick = () => renderShortcuts(cat); categoryFilters.appendChild(btn);
    if(index === 0) renderShortcuts(cat);
});
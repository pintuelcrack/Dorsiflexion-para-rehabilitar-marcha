// Elementos del DOM
const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const videoUpload = document.getElementById('videoUpload');
const btnWebcam = document.getElementById('btnWebcam');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnReset = document.getElementById('btnReset');

// Elementos de la tabla de métricas
const angleValueEl = document.getElementById('angleValue');
const minAngleValueEl = document.getElementById('minAngleValue');
const maxAngleValueEl = document.getElementById('maxAngleValue');
const romValueEl = document.getElementById('romValue');

let isAnalyzing = false;
let animationFrameId = null;
let minAngle = Infinity;
let maxAngle = -Infinity;
let frameCount = 0;

// Configuración de Chart.js
const chartCtx = document.getElementById('angleChart').getContext('2d');
const angleChart = new Chart(chartCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Ángulo de Tobillo (°)',
      data: [],
      borderColor: '#0066cc',
      borderWidth: 2,
      fill: false,
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      x: { title: { display: true, text: 'Cuadros / Frames' } },
      y: { title: { display: true, text: 'Ángulo Articular (°)' }, min: 40, max: 160 }
    }
  }
});

// Función para calcular el ángulo vectorial entre Rodilla (Pierna), Tobillo (Maléolo) y Punta del pie
function calculateAngle(p1, p2, p3) {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return Math.round(angle);
}

// Configurar MediaPipe Pose con archivos desde CDN estable
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// Procesamiento y renderizado de resultados
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
  // Dibujar el fotograma del video en el canvas
  if (results.image) {
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }

  if (results.poseLandmarks && isAnalyzing) {
    const landmarks = results.poseLandmarks;

    // Puntos Anatómicos Seleccionados:
    // 25: Rodilla, 27: Tobillo (Maléolo), 31: Punta del pie (Dedos)
    const knee = landmarks[25];
    const ankle = landmarks[27];
    const toe = landmarks[31];

    if (knee && ankle && toe && knee.visibility > 0.3 && ankle.visibility > 0.3) {
      // Dibujar líneas y articulaciones
      drawConnectors(canvasCtx, landmarks, [[25, 27], [27, 31]], { color: '#00FF00', lineWidth: 4 });
      drawLandmarks(canvasCtx, [knee, ankle, toe], { color: '#FF0000', lineWidth: 3 });

      // Calcular ángulo de dorsiflexión
      const angle = calculateAngle(knee, ankle, toe);

      // Actualizar Valores Mínimos y Máximos
      if (angle < minAngle) minAngle = angle;
      if (angle > maxAngle) maxAngle = angle;

      const rom = (maxAngle !== -Infinity && minAngle !== Infinity) ? (maxAngle - minAngle) : 0;

      // Actualizar Tabla de Métricas
      angleValueEl.textContent = angle;
      minAngleValueEl.textContent = minAngle !== Infinity ? minAngle : 0;
      maxAngleValueEl.textContent = maxAngle !== -Infinity ? maxAngle : 0;
      romValueEl.textContent = rom;

      // Actualizar gráfico
      frameCount++;
      angleChart.data.labels.push(frameCount);
      angleChart.data.datasets[0].data.push(angle);
      angleChart.update();
    }
  }
  canvasCtx.restore();
}

// Bucle continuo para enviar fotogramas a MediaPipe
async function processVideoFrame() {
  if (isAnalyzing && videoElement.readyState >= 2 && !videoElement.paused && !videoElement.ended) {
    await pose.send({ image: videoElement });
  }
  if (isAnalyzing) {
    animationFrameId = requestAnimationFrame(processVideoFrame);
  }
}

// Controladores de Eventos
videoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.onloadedmetadata = () => {
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;
      btnStart.disabled = false;
    };
  }
});

btnWebcam.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    videoElement.onloadedmetadata = () => {
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;
      btnStart.disabled = false;
    };
  } catch (err) {
    alert("No se pudo acceder a la cámara web. Verifica los permisos de tu navegador.");
  }
});

btnStart.addEventListener('click', () => {
  isAnalyzing = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  videoElement.play();
  processVideoFrame();
});

btnStop.addEventListener('click', () => {
  isAnalyzing = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  videoElement.pause();
  btnStart.disabled = false;
  btnStop.disabled = true;
});

btnReset.addEventListener('click', () => {
  minAngle = Infinity;
  maxAngle = -Infinity;
  frameCount = 0;
  angleValueEl.textContent = '0';
  minAngleValueEl.textContent = '0';
  maxAngleValueEl.textContent = '0';
  romValueEl.textContent = '0';
  
  angleChart.data.labels = [];
  angleChart.data.datasets[0].data = [];
  angleChart.update();
});

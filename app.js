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
      label: 'Ángulo de Tobillo - Maléolo (°)',
      data: [],
      borderColor: '#0066cc',
      borderWidth: 2,
      fill: false,
      tension: 0.1
    }]
  },
  options: {
    responsive: true,
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

// Configurar MediaPipe Pose
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

// Procesamiento de cada frame
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks && isAnalyzing) {
    const landmarks = results.poseLandmarks;

    // Puntos Anatómicos Seleccionados:
    // 25: Rodilla (Dirección de la pierna)
    // 27: Tobillo / Maléolo Lateral (Vértice)
    // 31: Punta del pie / Dedos (Brazo distal)
    const knee = landmarks[25];
    const ankle = landmarks[27]; // Maléolo
    const toe = landmarks[31];   // Punta del pie

    if (knee && ankle && toe) {
      // Dibujar las líneas de la articulación del tobillo
      drawConnectors(canvasCtx, landmarks, [[25, 27], [27, 31]], { color: '#00FF00', lineWidth: 4 });
      drawLandmarks(canvasCtx, [knee, ankle, toe], { color: '#FF0000', lineWidth: 3 });

      // Calcular ángulo de dorsiflexión/plantiflexión
      const angle = calculateAngle(knee, ankle, toe);

      // Actualizar Valores Mínimos (Dorsiflexión máxima) y Máximos (Plantiflexión máxima)
      if (angle < minAngle) minAngle = angle;
      if (angle > maxAngle) maxAngle = angle;

      const rom = (maxAngle !== -Infinity && minAngle !== Infinity) ? (maxAngle - minAngle) : 0;

      // Actualizar Tabla de Métricas en la Interfaz
      angleValueEl.textContent = angle;
      minAngleValueEl.textContent = minAngle !== Infinity ? minAngle : 0;
      maxAngleValueEl.textContent = maxAngle !== -Infinity ? maxAngle : 0;
      romValueEl.textContent = rom;

      // Actualizar gráfico en tiempo real
      frameCount++;
      angleChart.data.labels.push(frameCount);
      angleChart.data.datasets[0].data.push(angle);
      angleChart.update('none');
    }
  }
  canvasCtx.restore();
}

// Controladores de Eventos
videoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    videoElement.src = URL.createObjectURL(file);
    videoElement.onloadedmetadata = () => {
      canvasElement.width = videoElement.videoWidth || 640;
      canvasElement.height = videoElement.videoHeight || 480;
      btnStart.disabled = false;
    };
  }
});

btnWebcam.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  videoElement.play();
  btnStart.disabled = false;
});

btnStart.addEventListener('click', () => {
  isAnalyzing = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  videoElement.play();
  
  async function processFrame() {
    if (isAnalyzing && !videoElement.paused && !videoElement.ended) {
      await pose.send({ image: videoElement });
      requestAnimationFrame(processFrame);
    }
  }
  processFrame();
});

btnStop.addEventListener('click', () => {
  isAnalyzing = false;
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

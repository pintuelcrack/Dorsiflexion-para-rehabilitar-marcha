// Elementos del DOM
const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const videoUpload = document.getElementById('videoUpload');
const btnWebcam = document.getElementById('btnWebcam');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const angleValueEl = document.getElementById('angleValue');
const maxAngleValueEl = document.getElementById('maxAngleValue');

let isAnalyzing = false;
let maxAngle = 0;
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
    scales: {
      x: { title: { display: true, text: 'Cuadros (Frames)' } },
      y: { title: { display: true, text: 'Ángulo (°)' }, min: 60, max: 140 }
    }
  }
});

// Función para calcular el ángulo entre 3 puntos (Rodilla -> Tobillo -> Pie)
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

    // Puntos de la pierna izquierda (o derecha según vista)
    // 25: Rodilla Izq, 27: Tobillo Izq, 31: Pie/Metatarso Izq
    const knee = landmarks[25];
    const ankle = landmarks[27];
    const foot = landmarks[31];

    if (knee && ankle && foot) {
      // Dibujar los puntos y líneas sobre la articulación
      drawConnectors(canvasCtx, landmarks, [[25, 27], [27, 31]], { color: '#00FF00', lineWidth: 4 });
      drawLandmarks(canvasCtx, [knee, ankle, foot], { color: '#FF0000', lineWidth: 2 });

      // Calcular ángulo articular
      const angle = calculateAngle(knee, ankle, foot);

      // Actualizar UI y Métricas
      angleValueEl.textContent = angle;
      if (angle > maxAngle) {
        maxAngle = angle;
        maxAngleValueEl.textContent = maxAngle;
      }

      // Actualizar gráfico
      frameCount++;
      angleChart.data.labels.push(frameCount);
      angleChart.data.datasets[0].data.push(angle);
      angleChart.update('none'); // Renderizado rápido sin animación
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

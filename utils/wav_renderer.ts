const dataMap = new WeakMap();

/**
 * Normalizes a Float32Array to Array(m): We use this to draw amplitudes on a graph
 * If we're rendering the same audio data, then we'll often be using
 * the same (data, m, downsamplePeaks) triplets so we give option to memoize
 */
const normalizeArray = (
  data: Float32Array,
  m: number,
  downsamplePeaks: boolean = false,
  memoize: boolean = false
) => {
  let cache, mKey, dKey;
  if (memoize) {
    mKey = m.toString();
    dKey = downsamplePeaks.toString();
    cache = dataMap.has(data) ? dataMap.get(data) : {};
    dataMap.set(data, cache);
    cache[mKey] = cache[mKey] || {};
    if (cache[mKey][dKey]) {
      return cache[mKey][dKey];
    }
  }
  const n = data.length;
  const result = new Array(m);
  if (m <= n) {
    // Downsampling
    result.fill(0);
    const count = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      const index = Math.floor(i * (m / n));
      if (downsamplePeaks) {
        // take highest result in the set
        result[index] = Math.max(result[index], Math.abs(data[i]));
      } else {
        result[index] += Math.abs(data[i]);
      }
      count[index]++;
    }
    if (!downsamplePeaks) {
      for (let i = 0; i < result.length; i++) {
        result[i] = result[i] / count[i];
      }
    }
  } else {
    for (let i = 0; i < m; i++) {
      const index = (i * (n - 1)) / (m - 1);
      const low = Math.floor(index);
      const high = Math.ceil(index);
      const t = index - low;
      if (high >= n) {
        result[i] = data[n - 1];
      } else {
        result[i] = data[low] * (1 - t) + data[high] * t;
      }
    }
  }
  if (memoize) {
    cache[mKey as string][dKey as string] = result;
  }
  return result;
};

export const WavRenderer = {
  /**
   * Renders a point-in-time snapshot of an audio sample, usually frequency values
   * @param canvas
   * @param ctx
   * @param data
   * @param color
   * @param pointCount number of bars to render
   * @param barWidth width of bars in px
   * @param barSpacing spacing between bars in px
   * @param center vertically center the bars
   */
  drawBars: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    color: string,
    pointCount: number = 0,
    barWidth: number = 0,
    barSpacing: number = 0,
    center: boolean = false
  ) => {
    pointCount = Math.floor(
      Math.min(
        pointCount,
        (canvas.width - barSpacing) / (Math.max(barWidth, 1) + barSpacing)
      )
    );
    if (!pointCount) {
      pointCount = Math.floor(
        (canvas.width - barSpacing) / (Math.max(barWidth, 1) + barSpacing)
      );
    }
    if (!barWidth) {
      barWidth = (canvas.width - barSpacing) / pointCount - barSpacing;
    }
    const points = normalizeArray(data, pointCount, true);
    for (let i = 0; i < pointCount; i++) {
      const amplitude = Math.abs(points[i]);
      const height = Math.max(1, amplitude * canvas.height);
      const x = barSpacing + i * (barWidth + barSpacing);
      const y = center ? (canvas.height - height) / 2 : canvas.height - height;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, height);
    }
  },

  drawModernWave: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    data: Float32Array,
    color: string,
    pointCount: number = 100
  ) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const points = normalizeArray(data, pointCount, true);
    const centerY = canvas.height / 2;
    const amplitude = canvas.height * 0.4;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `${color}22`);
    gradient.addColorStop(0.5, `${color}44`);
    gradient.addColorStop(1, `${color}22`);

    // Draw top wave
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let i = 0; i < points.length; i++) {
      const x = (canvas.width * i) / (points.length - 1);
      const y = centerY - points[i] * amplitude;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (canvas.width * (i - 1)) / (points.length - 1);
        const prevY = centerY - points[i - 1] * amplitude;
        const cpX = (x + prevX) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (y + prevY) / 2);
      }
    }

    // Complete the path for bottom wave
    for (let i = points.length - 1; i >= 0; i--) {
      const x = (canvas.width * i) / (points.length - 1);
      const y = centerY + points[i] * amplitude;

      if (i === points.length - 1) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (canvas.width * (i + 1)) / (points.length - 1);
        const prevY = centerY + points[i + 1] * amplitude;
        const cpX = (x + prevX) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (y + prevY) / 2);
      }
    }

    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw center line with glow
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  },
};

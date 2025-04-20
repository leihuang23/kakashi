// Discrete Fourier Transform (DFT)
export function dft(x) {
  const N = x.length;
  const X = [];
  for (let k = 0; k < N; k++) {
    let re = 0,
      im = 0;
    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      // Multiply by e^(-i*phi) = cos(phi) - i*sin(phi)
      re += x[n].re * Math.cos(phi) + x[n].im * Math.sin(phi);
      im += -x[n].re * Math.sin(phi) + x[n].im * Math.cos(phi);
    }
    re /= N;
    im /= N;
    const freq = k;
    const amp = Math.hypot(re, im);
    const phase = Math.atan2(im, re);
    X.push({ re, im, freq, amp, phase });
  }
  return X;
}

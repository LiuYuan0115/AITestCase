try {
  window.__PERFORMANCE_DATA__ = {
    html_start: performance.now(),
    js_start: null,
    js_end: null,
    dom_ready: null,
    window_load: null,
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (window.__PERFORMANCE_DATA__) {
      window.__PERFORMANCE_DATA__.dom_ready = performance.now()
    }
  })
  window.addEventListener('load', function () {
    if (window.__PERFORMANCE_DATA__) {
      window.__PERFORMANCE_DATA__.window_load = performance.now()
    }
  })
} catch (error) {
  console.error('Failed to initialize performance data:', error)
}

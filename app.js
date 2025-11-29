const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
const sayHelpBtn = document.getElementById('sayHelp');
const bubble = document.getElementById('voiceBubble');
const micButton = document.getElementById('micButton');
const errorBanner = document.getElementById('errorBanner');
const micOverlay = document.getElementById('micOverlay');
const overlayRetry = document.getElementById('overlayRetry');
const statusText = document.getElementById('statusText');
const heardText = document.getElementById('heardText');
const appointmentsList = document.getElementById('appointmentsList');
const remindersList = document.getElementById('remindersList');
const supportNotice = document.getElementById('supportNotice');
let recognition;
let listening = false;
let interim = '';
let audioCtx;
let analyser;
let micStream;
let meterId;
let voices = [];
function speak(text) {
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.95;
  synth.cancel();
  synth.speak(utter);
}
function loadData() {
  const a = JSON.parse(localStorage.getItem('appointments') || '[]');
  const r = JSON.parse(localStorage.getItem('reminders') || '[]');
  renderAppointments(a);
  renderReminders(r);
}
function saveAppointments(items) {
  localStorage.setItem('appointments', JSON.stringify(items));
}
function saveReminders(items) {
  localStorage.setItem('reminders', JSON.stringify(items));
}
function renderAppointments(items) {
  appointmentsList.innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.textContent = `${it.title} • ${new Date(it.when).toLocaleString()}`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'secondary';
    del.onclick = () => {
      const next = items.slice(0, idx).concat(items.slice(idx + 1));
      saveAppointments(next);
      renderAppointments(next);
    };
    li.appendChild(document.createTextNode(' '));
    li.appendChild(del);
    appointmentsList.appendChild(li);
  });
}
function renderReminders(items) {
  remindersList.innerHTML = '';
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.textContent = `${it.title} • ${new Date(it.when).toLocaleString()}`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'secondary';
    del.onclick = () => {
      const next = items.slice(0, idx).concat(items.slice(idx + 1));
      saveReminders(next);
      renderReminders(next);
    };
    li.appendChild(document.createTextNode(' '));
    li.appendChild(del);
    remindersList.appendChild(li);
  });
}
function parseTimePhrase(text) {
  const m1 = text.match(/\b(at)\s+(\d{1,2})(?:\s*(:)\s*(\d{2}))?\s*(am|pm)?\b/i);
  if (m1) {
    let h = parseInt(m1[2], 10);
    const minutes = m1[4] ? parseInt(m1[4], 10) : 0;
    const ampm = m1[5] ? m1[5].toLowerCase() : '';
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    const now = new Date();
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, minutes, 0, 0);
    if (when < now) when.setDate(when.getDate() + 1);
    return when;
  }
  return null;
}
function parseDatePhrase(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes('today')) return now;
  if (lower.includes('tomorrow')) return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, now.getHours(), now.getMinutes());
  const m = text.match(/\bon\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (m) {
    const months = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
    const month = months[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    let h = m[3] ? parseInt(m[3], 10) : 9;
    const minutes = m[4] ? parseInt(m[4], 10) : 0;
    const ampm = m[5] ? m[5].toLowerCase() : '';
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    const year = now.getFullYear();
    const when = new Date(year, month, day, h, minutes, 0, 0);
    if (when < now) when.setFullYear(year + 1);
    return when;
  }
  const t = parseTimePhrase(text);
  if (t) return t;
  return null;
}
function intentHelp() {
  speak('You can say, book appointment with a doctor on a date at a time. Or, remind medication at a time every day.');
}
function scheduleReminder(title, when) {
  const items = JSON.parse(localStorage.getItem('reminders') || '[]');
  items.push({ title, when: when.getTime() });
  saveReminders(items);
  renderReminders(items);
  const delay = when.getTime() - Date.now();
  if (delay > 0) setTimeout(() => { speak(`${title} now`); }, Math.min(delay, 2147483647));
}
function scheduleAppointment(title, when) {
  const items = JSON.parse(localStorage.getItem('appointments') || '[]');
  items.push({ title, when: when.getTime() });
  saveAppointments(items);
  renderAppointments(items);
}
function handleCommand(text) {
  const lower = text.toLowerCase();
  if (lower.includes('what can i say') || lower.includes('help')) {
    intentHelp();
    return;
  }
  if (lower.includes('book') && lower.includes('appointment')) {
    const withMatch = text.match(/with\s+([a-zA-Z\s\.]+?)(?:\s+on|\s+at|$)/i);
    const doctor = withMatch ? withMatch[1].trim() : 'doctor';
    const when = parseDatePhrase(text);
    if (when) {
      scheduleAppointment(`Appointment with ${doctor}`, when);
      speak(`Booked appointment with ${doctor} on ${when.toLocaleString()}`);
    } else {
      speak('Please say the date and time. For example, on December fifth at three p m.');
    }
    return;
  }
  if (lower.includes('remind') && lower.includes('medication')) {
    const when = parseDatePhrase(text);
    if (when) {
      scheduleReminder('Medication', when);
      speak(`Medication reminder set for ${when.toLocaleString()}`);
    } else {
      speak('Please say the time. For example, remind medication at eight a m.');
    }
    return;
  }
}
function initRecognition() {
  if (!SpeechRecognition) {
    supportNotice.hidden = false;
    if (micButton) micButton.disabled = true;
    sayHelpBtn.disabled = false;
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onstart = () => {
    listening = true;
    statusText.textContent = 'Listening…';
    if (micButton) micButton.textContent = 'Stop Speaking';
    speak('I am listening.');
    document.body.classList.add('listening');
    startMeter();
  };
  recognition.onend = () => {
    listening = false;
    statusText.textContent = 'Idle';
    if (micButton) micButton.textContent = 'Tap to Speak';
    document.body.classList.remove('listening');
    stopMeter();
  };
  recognition.onerror = (e) => {
    const code = e && e.error ? e.error : 'error';
    let msg = 'Error';
    if (code === 'not-allowed' || code === 'service-not-allowed') msg = 'Microphone permission denied. Click Allow in the address bar.';
    else if (code === 'no-speech') msg = 'No speech detected. Try speaking louder or closer to the mic.';
    else if (code === 'audio-capture') msg = 'No microphone found. Check your device or input settings.';
    else if (code === 'network') msg = 'Network error with speech service. Try again.';
    statusText.textContent = msg;
    showBanner(msg);
  };
  recognition.onresult = (event) => {
    let finalText = '';
    interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += t;
      else interim += t;
    }
    heardText.textContent = finalText || interim || '—';
    if (finalText) handleCommand(finalText.trim());
  };
}
if (micButton) {
  micButton.addEventListener('click', () => {
    if (!recognition) return;
    if (!listening) {
      preflightMic().then(() => recognition.start()).catch(() => {
        showMicOverlay();
      });
    } else {
      recognition.stop();
    }
  });
}
sayHelpBtn.addEventListener('click', () => { intentHelp(); });
document.addEventListener('DOMContentLoaded', () => {
  initRecognition();
  loadData();
  initChips();
});

async function startMeter() {
  try {
    if (meterId) cancelAnimationFrame(meterId);
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStream = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    micStream.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const base = 100;
      const size = Math.max(base, Math.min(220, base + rms * 280));
      if (bubble) bubble.style.setProperty('--size', `${size}px`);
      if (bubble) bubble.style.setProperty('--rms', `${Math.min(0.8, rms * 2).toFixed(3)}`);
      meterId = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    if (bubble) bubble.style.setProperty('--size', `100px`);
  }
}
function stopMeter() {
  if (meterId) cancelAnimationFrame(meterId);
  meterId = undefined;
  if (bubble) bubble.style.setProperty('--size', `100px`);
}

function initChips() {
  const actionBtns = document.querySelectorAll('.action-btn[data-phrase]');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const phrase = btn.getAttribute('data-phrase');
      if (phrase) {
        speak(phrase);
        handleCommand(phrase);
      }
    });
  });
}

function initChips() {
  const chipButtons = document.querySelectorAll('.chip[data-phrase]');
  chipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const phrase = btn.getAttribute('data-phrase');
      if (phrase) {
        speak(phrase);
        handleCommand(phrase);
      }
    });
  });
  const quickCards = document.querySelectorAll('.quick-card[data-phrase]');
  quickCards.forEach(card => {
    card.addEventListener('click', () => {
      const phrase = card.getAttribute('data-phrase');
      if (phrase) {
        speak(phrase);
        handleCommand(phrase);
      }
    });
  });
}
function showBanner(text) {
  if (!errorBanner) return;
  errorBanner.textContent = text;
  errorBanner.hidden = false;
  setTimeout(() => { if (errorBanner) errorBanner.hidden = true; }, 5000);
}
function showMicOverlay() {
  if (micOverlay) micOverlay.hidden = false;
}
function hideMicOverlay() {
  if (micOverlay) micOverlay.hidden = true;
}
async function preflightMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(t => t.stop());
}
if (overlayRetry) overlayRetry.addEventListener('click', async () => {
  try {
    await preflightMic();
    hideMicOverlay();
    if (recognition && !listening) recognition.start();
  } catch (e) {}
});

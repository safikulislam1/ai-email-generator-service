// Client-side script for AI Email Template Generator Studio

const PRESETS = {
  demo: {
    recipient_name: "Sarah Jenkins",
    purpose: "Follow up on product demo request and schedule a 15-minute alignment call",
    tone: "professional"
  },
  payment: {
    recipient_name: "John Doe",
    purpose: "Reminder regarding overdue invoice #INV-4092",
    tone: "urgent"
  },
  welcome: {
    recipient_name: "Sophia Chen",
    purpose: "Welcome new customer to the Premium Pro plan and guide on getting started",
    tone: "casual"
  },
  discount: {
    recipient_name: "Valued Customer",
    purpose: "Announce exclusive 25% anniversary discount on yearly subscription",
    tone: "persuasive"
  }
};

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
});

async function checkHealth() {
  const pill = document.getElementById('healthPill');
  const text = document.getElementById('healthText');
  try {
    const res = await fetch('/api/v1/health');
    const data = await res.json();
    if (data.status === 'UP') {
      const aiMode = data.email_service?.ai_service?.mode || data.ai_service?.mode || 'Live';
      text.innerText = `Service Online (${aiMode})`;
      const dot = pill?.querySelector('.dot');
      if (dot) {
        dot.style.background = 'var(--accent-emerald)';
        dot.style.boxShadow = '0 0 6px var(--accent-emerald)';
      }
    } else {
      text.innerText = 'Service Warning';
      const dot = pill?.querySelector('.dot');
      if (dot) {
        dot.style.background = '#f59e0b';
        dot.style.boxShadow = '0 0 6px #f59e0b';
      }
    }
  } catch (err) {
    text.innerText = 'Offline / Error';
    const dot = pill?.querySelector('.dot');
    if (dot) {
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 6px #ef4444';
    }
  }
}

function applyPreset(key) {
  const data = PRESETS[key];
  if (!data) return;

  document.getElementById('recipient_name').value = data.recipient_name;
  document.getElementById('purpose').value = data.purpose;
  document.getElementById('tone').value = data.tone;
}

async function handleGenerate(event) {
  event.preventDefault();

  const recipient_name = document.getElementById('recipient_name').value.trim();
  const purpose = document.getElementById('purpose').value.trim();
  const tone = document.getElementById('tone').value;

  // Toggle UI States
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('resultState').classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('timingBadge').classList.add('hidden');

  const payload = { recipient_name, purpose, tone };

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;

  try {
    const response = await fetch('/api/v1/generate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new Error(json.message || 'Failed to generate email template.');
    }

    // Display result
    document.getElementById('subjectText').innerText = json.data.subject;
    document.getElementById('bodyText').innerText = json.data.body;
    document.getElementById('toneBadge').innerText = `Tone: ${json.data.tone.toUpperCase()}`;
    document.getElementById('explanationText').innerText = json.data.tone_explanation || '';

    // Show response time log metric
    if (json.meta && typeof json.meta.response_time_ms !== 'undefined') {
      let badgeText = `${json.meta.response_time_ms}ms`;
      if (json.meta.quota_limit) {
        badgeText += ` (Quota Limit: ${json.meta.quota_limit} | Used: ${json.meta.quota_used || json.meta.quota_limit})`;
      }
      document.getElementById('responseTimeVal').innerText = badgeText;
      document.getElementById('timingBadge').classList.remove('hidden');
    }

    // Display raw JSON
    document.getElementById('jsonCode').innerText = JSON.stringify(json, null, 2);

    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultState').classList.remove('hidden');
  } catch (err) {
    alert(`Error: ${err.message}`);
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

function copyText(elementId) {
  const text = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  }).catch(err => {
    console.error('Copy failed', err);
  });
}

(function () {
  'use strict';

  const ALERT_TIMEOUT = 5000;

  function getAlertContainer() {
    return document.getElementById('global-alert-container');
  }

  function showAlert(message, variant = 'danger') {
    const container = getAlertContainer();
    if (!container || !message) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `alert alert-${variant} shadow-sm d-flex align-items-start gap-2 mb-2 fade show`;
    wrapper.setAttribute('role', 'alert');
    wrapper.innerHTML = `
      <i class="bi ${variant === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'}"></i>
      <div class="flex-grow-1">${message}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    `;

    container.appendChild(wrapper);

    window.setTimeout(() => {
      wrapper.classList.remove('show');
      wrapper.addEventListener('transitionend', () => wrapper.remove(), { once: true });
    }, ALERT_TIMEOUT);
  }

  function findSubmitButton(form) {
    return form.querySelector('[data-loading-button]') || form.querySelector('[type="submit"]');
  }

  function toggleLoading(button, isLoading) {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const originalContentKey = 'appOriginalContent';
    if (isLoading) {
      if (!button.dataset[originalContentKey]) {
        button.dataset[originalContentKey] = button.innerHTML;
      }
      const text = button.dataset.loadingText || button.textContent?.trim() || 'Carregando...';
      button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${text}`;
      button.setAttribute('disabled', 'disabled');
    } else {
      const original = button.dataset[originalContentKey];
      if (original) {
        button.innerHTML = original;
      }
      button.removeAttribute('disabled');
    }
  }

  async function handleAsyncSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    event.preventDefault();

    const button = findSubmitButton(form);
    toggleLoading(button, true);

    const formData = new FormData(form);
    const method = (form.getAttribute('method') || 'POST').toUpperCase();
    const action = form.getAttribute('action') || window.location.href;

    try {
      const response = await fetch(action, {
        method,
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      let payload;

      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        payload = await response.text();
      }

      if (!response.ok) {
        const message = typeof payload === 'object' && payload && 'message' in payload ? payload.message : 'Não foi possível concluir a operação.';
        showAlert(message, 'danger');
        return;
      }

      if (payload && typeof payload === 'object') {
        if (payload.error) {
          showAlert(payload.message || 'Ocorreu um erro ao processar sua solicitação.', 'danger');
          return;
        }

        if (payload.message) {
          showAlert(payload.message, 'success');
        }

        if (payload.redirect) {
          window.location.href = payload.redirect;
          return;
        }

        if (form.hasAttribute('data-reset-on-success')) {
          form.reset();
        }
        return;
      }

      if (typeof payload === 'string' && payload.trim()) {
        showAlert(payload, 'success');
      }
    } catch (error) {
      console.error(error);
      showAlert('Não foi possível comunicar com o servidor. Tente novamente mais tarde.', 'danger');
    } finally {
      toggleLoading(button, false);
    }
  }

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (form.hasAttribute('data-async')) {
      handleAsyncSubmit(event);
    } else {
      const button = findSubmitButton(form);
      toggleLoading(button, true);
    }
  });

  document.body.addEventListener('htmx:beforeRequest', (event) => {
    const target = event.detail.elt;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.matches('[data-loading-button]')
      ? target
      : target.querySelector('[data-loading-button]');
    if (button) {
      toggleLoading(button, true);
    }
  });

  document.body.addEventListener('htmx:afterRequest', (event) => {
    const target = event.detail.elt;
    const button = target instanceof HTMLElement && target.matches('[data-loading-button]')
      ? target
      : target instanceof HTMLElement
      ? target.querySelector('[data-loading-button]')
      : null;
    if (button) {
      toggleLoading(button, false);
    }

    const xhr = event.detail.xhr;
    if (!xhr) {
      return;
    }
    const contentType = xhr.getResponseHeader('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (data.error) {
          showAlert(data.message || 'Ocorreu um erro ao processar a requisição.', 'danger');
        } else if (data.message) {
          showAlert(data.message, 'success');
        }
      } catch (error) {
        console.error('Erro ao interpretar resposta JSON.', error);
      }
    }
  });

  document.body.addEventListener('htmx:responseError', () => {
    showAlert('Não foi possível concluir a operação. Verifique sua conexão.', 'danger');
  });

  document.body.addEventListener('click', (event) => {
    const toggle = event.target instanceof HTMLElement ? event.target.closest('[data-action="toggle-answer"]') : null;
    if (!toggle) {
      return;
    }
    event.preventDefault();
    const targetId = toggle.getAttribute('data-answer-target');
    if (!targetId) {
      return;
    }
    const answer = document.getElementById(targetId);
    if (!answer) {
      return;
    }
    const collapse = bootstrap.Collapse.getOrCreateInstance(answer, { toggle: false });
    collapse.toggle();
  });

  document.body.addEventListener('click', (event) => {
    const simulateBtn = event.target instanceof HTMLElement ? event.target.closest('[data-action="simulate-error"]') : null;
    if (!simulateBtn) {
      return;
    }
    event.preventDefault();
    fetch('/app/simulate-error', { method: 'POST' })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          showAlert(data.message || 'Erro simulado.', 'danger');
        } else if (data.message) {
          showAlert(data.message, 'success');
        }
      })
      .catch(() => {
        showAlert('Não foi possível simular o erro.', 'danger');
      });
  });
})();

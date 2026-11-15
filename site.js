"use strict";

(() => {
  const endpoint = "https://vumborala.com.br/api/public/contato";
  const form = document.querySelector("#contact-form");
  const submit = document.querySelector("#submit-ticket");
  const error = document.querySelector("#form-error");
  const success = document.querySelector("#ticket-success");
  let receipt = null;
  let sending = false;

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    error.focus();
  }

  document.querySelectorAll("[data-topic]").forEach((link) => {
    link.addEventListener("click", () => {
      if (sending) return;
      if (form.hidden) {
        form.hidden = false;
        success.hidden = true;
        form.reset();
      }
      form.elements.topic.value = link.dataset.topic;
      form.elements.product.value =
        link.dataset.product || "StoreApps / Institucional";
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    error.hidden = true;
    const fields = new FormData(form);
    const payload = {
      app: "site",
      appVersion: "storeapps-web-2026-11",
      name: String(fields.get("name")).trim(),
      email: String(fields.get("email")).trim(),
      phone: String(fields.get("phone")).trim(),
      product: fields.get("product"),
      topic: fields.get("topic"),
      message: String(fields.get("message")).trim(),
      website: String(fields.get("website")).trim(),
    };
    if (payload.website)
      return showError(
        "Não foi possível validar o formulário. Atualize a página e tente novamente.",
      );
    if (payload.name.length < 2 || payload.message.length < 10) {
      return showError(
        "Informe seu nome e uma mensagem com pelo menos 10 caracteres, além dos espaços.",
      );
    }
    if (
      payload.phone &&
      !/^\d{2}9?\d{8}$/.test(
        payload.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""),
      )
    ) {
      return showError(
        "Confira o telefone com DDD, por exemplo: (79) 99999-9999. Você também pode deixar esse campo vazio.",
      );
    }
    sending = true;
    submit.disabled = true;
    submit.textContent = "Abrindo chamado…";
    form.setAttribute("aria-busy", "true");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            (response.status === 429
              ? "Muitas tentativas. Aguarde alguns minutos antes de enviar novamente."
              : "Não conseguimos confirmar o envio. Seus dados continuam no formulário. Tente mais tarde ou escreva para contato@storeapps.com.br."),
        );
      }
      if (!/^CE-\d{5,}$/.test(result?.data?.protocolo || "")) {
        throw new Error(
          "Não recebemos um protocolo válido. O chamado pode ter sido registrado. Antes de reenviar, fale com contato@storeapps.com.br.",
        );
      }
      receipt = {
        protocol: result.data.protocolo,
        email: payload.email,
        product: payload.product,
        topic: form.elements.topic.selectedOptions[0].text,
        date: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
      };
      document.querySelector("#ticket-protocol").textContent = receipt.protocol;
      document.querySelector("#ticket-contact").textContent =
        `O retorno será pelo e-mail ${receipt.email} ou pelo telefone informado.`;
      form.hidden = true;
      form.reset();
      success.hidden = false;
      success.focus();
    } catch (failure) {
      showError(
        failure instanceof TypeError || failure.name === "AbortError"
          ? "A conexão foi interrompida e não conseguimos confirmar o envio. O chamado pode ter sido registrado. Seus dados continuam no formulário; antes de reenviar, consulte contato@storeapps.com.br."
          : failure.message,
      );
    } finally {
      clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.textContent = "Abrir chamado";
      form.removeAttribute("aria-busy");
    }
  });

  document
    .querySelector("#copy-protocol")
    .addEventListener("click", async () => {
      if (!receipt) return;
      const status = document.querySelector("#copy-status");
      try {
        await navigator.clipboard.writeText(receipt.protocol);
        status.textContent = "Protocolo copiado.";
      } catch {
        status.textContent = `Copie o protocolo acima ou baixe o comprovante: ${receipt.protocol}`;
      }
    });

  document.querySelector("#download-receipt").addEventListener("click", () => {
    if (!receipt) return;
    const text = `StoreApps Tecnologia — comprovante de abertura de chamado\n\nProtocolo: ${receipt.protocol}\nData: ${receipt.date} (horário de Brasília)\nProduto: ${receipt.product}\nAssunto: ${receipt.topic}\nE-mail para retorno: ${receipt.email}\n\nPara falar sobre este atendimento, informe o protocolo para contato@storeapps.com.br.\nEste comprovante confirma a abertura do chamado; não é um link de acompanhamento.\n`;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `StoreApps-${receipt.protocol}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.querySelector("#new-ticket").addEventListener("click", () => {
    receipt = null;
    document.querySelector("#ticket-protocol").textContent = "";
    document.querySelector("#ticket-contact").textContent = "";
    document.querySelector("#copy-status").textContent = "";
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
})();

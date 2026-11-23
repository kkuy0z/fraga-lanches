import { AsYouType, parsePhoneNumberFromString } from "https://cdn.jsdelivr.net/npm/libphonenumber-js@1.11.20/+esm";

(function () {
  "use strict";

  function analisar(valor) {
    const texto = String(valor || "").trim();
    if (!texto) return { vazio: true, valido: true, numero: null };

    const internacional = texto.startsWith("+");
    const digitos = texto.replace(/\D/g, "");
    if (digitos.length > (internacional ? 15 : 11)) {
      return { valido: false, mensagem: "O telefone ultrapassa o limite de dígitos." };
    }

    const numero = parsePhoneNumberFromString(texto, internacional ? undefined : "BR");
    if (
      !numero ||
      !numero.isValid() ||
      numero.number.replace(/\D/g, "").length > 15 ||
      (numero.country === "BR" && numero.nationalNumber.length !== 11)
    ) {
      return { valido: false, mensagem: "Número inválido. Confira o DDD e o código do país." };
    }

    return { valido: true, numero: numero.number, parsed: numero };
  }

  function formatarCampo(campo) {
    if (!campo || campo.dataset.telefoneConfigurado === "1") return;
    campo.dataset.telefoneConfigurado = "1";

    campo.addEventListener("input", () => {
      const internacional = campo.value.trim().startsWith("+");
      const digitos = campo.value.replace(/\D/g, "").slice(0, internacional ? 15 : 11);
      campo.value = new AsYouType(internacional ? undefined : "BR")
        .input((internacional ? "+" : "") + digitos);
      campo.setCustomValidity("");
    });

    campo.addEventListener("blur", () => {
      const resultado = analisar(campo.value);
      if (resultado.valido && resultado.numero) {
        campo.value = resultado.parsed.formatInternational();
      }
    });
  }

  window.FragaTelefone = {
    validar: analisar,
    normalizar(valor) {
      const resultado = analisar(valor);
      return resultado.valido ? resultado.numero : null;
    },
    formatarCampo,
  };

  document.querySelectorAll('input[type="tel"]').forEach(formatarCampo);
  document.dispatchEvent(new CustomEvent("fraga-telefone-ready"));
})();

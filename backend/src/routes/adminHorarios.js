const express = require("express");
const router = express.Router();

const db = require("../database");
const autenticarAdmin = require("../middleware/autenticarAdmin");

router.use(autenticarAdmin);

const DIAS_VALIDOS = [0, 1, 2, 3, 4, 5, 6];

function validarDia(dia) {
  const numero = Number(dia);
  return Number.isInteger(numero) && DIAS_VALIDOS.includes(numero);
}

function validarHorario(horario) {
  return (
    typeof horario === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario)
  );
}

// LISTAR HORÁRIOS
router.get("/", async (req, res) => {
  try {
    const [horarios] = await db.query(`
      SELECT
        id,
        dia_semana,
        TIME_FORMAT(horario_abertura, '%H:%i') AS horario_abertura,
        TIME_FORMAT(horario_fechamento, '%H:%i') AS horario_fechamento,
        ativo
      FROM horarios_funcionamento
      ORDER BY dia_semana ASC
    `);

    res.json(horarios);
  } catch (erro) {
    console.error("Erro ao listar horários:", erro);

    res.status(500).json({
      mensagem: "Erro ao carregar horários de funcionamento.",
    });
  }
});

// CADASTRAR HORÁRIO
router.post("/", async (req, res) => {
  try {
    const { dia_semana, horario_abertura, horario_fechamento, fechado } =
      req.body;

    if (!validarDia(dia_semana)) {
      return res.status(400).json({
        mensagem: "Selecione um dia da semana válido.",
      });
    }

    const dia = Number(dia_semana);
    const estaFechado = fechado === true || fechado === 1 || fechado === "true";

    let abertura = horario_abertura;
    let fechamento = horario_fechamento;

    if (estaFechado) {
      abertura = "00:00";
      fechamento = "00:00";
    } else {
      if (!validarHorario(abertura) || !validarHorario(fechamento)) {
        return res.status(400).json({
          mensagem: "Informe horários de abertura e fechamento válidos.",
        });
      }

      if (abertura === fechamento) {
        return res.status(400).json({
          mensagem: "A abertura e o fechamento não podem ser iguais.",
        });
      }
    }

    const [existente] = await db.query(
      "SELECT id FROM horarios_funcionamento WHERE dia_semana = ? LIMIT 1",
      [dia],
    );

    if (existente.length) {
      return res.status(409).json({
        mensagem: "Já existe um horário cadastrado para esse dia.",
      });
    }

    await db.query(
      `
        INSERT INTO horarios_funcionamento (
          dia_semana,
          horario_abertura,
          horario_fechamento,
          ativo
        )
        VALUES (?, ?, ?, ?)
      `,
      [dia, abertura, fechamento, estaFechado ? 0 : 1],
    );

    res.status(201).json({
      mensagem: "Horário cadastrado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao cadastrar horário:", erro);

    res.status(500).json({
      mensagem: "Erro ao cadastrar horário.",
    });
  }
});

// EDITAR HORÁRIO
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { dia_semana, horario_abertura, horario_fechamento, fechado } =
      req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido.",
      });
    }

    if (!validarDia(dia_semana)) {
      return res.status(400).json({
        mensagem: "Selecione um dia da semana válido.",
      });
    }

    const dia = Number(dia_semana);
    const estaFechado = fechado === true || fechado === 1 || fechado === "true";

    let abertura = horario_abertura;
    let fechamento = horario_fechamento;

    if (estaFechado) {
      abertura = "00:00";
      fechamento = "00:00";
    } else {
      if (!validarHorario(abertura) || !validarHorario(fechamento)) {
        return res.status(400).json({
          mensagem: "Informe horários de abertura e fechamento válidos.",
        });
      }

      if (abertura === fechamento) {
        return res.status(400).json({
          mensagem: "A abertura e o fechamento não podem ser iguais.",
        });
      }
    }

    const [horario] = await db.query(
      "SELECT id FROM horarios_funcionamento WHERE id = ? LIMIT 1",
      [id],
    );

    if (!horario.length) {
      return res.status(404).json({
        mensagem: "Horário não encontrado.",
      });
    }

    const [duplicado] = await db.query(
      `
        SELECT id
        FROM horarios_funcionamento
        WHERE dia_semana = ? AND id <> ?
        LIMIT 1
      `,
      [dia, id],
    );

    if (duplicado.length) {
      return res.status(409).json({
        mensagem: "Já existe outro horário cadastrado para esse dia.",
      });
    }

    await db.query(
      `
        UPDATE horarios_funcionamento
        SET
          dia_semana = ?,
          horario_abertura = ?,
          horario_fechamento = ?,
          ativo = ?
        WHERE id = ?
      `,
      [dia, abertura, fechamento, estaFechado ? 0 : 1, id],
    );

    res.json({
      mensagem: "Horário atualizado com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao editar horário:", erro);

    res.status(500).json({
      mensagem: "Erro ao atualizar horário.",
    });
  }
});

// EXCLUIR HORÁRIO
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido.",
      });
    }

    const [horario] = await db.query(
      "SELECT id FROM horarios_funcionamento WHERE id = ? LIMIT 1",
      [id],
    );

    if (!horario.length) {
      return res.status(404).json({
        mensagem: "Horário não encontrado.",
      });
    }

    await db.query("DELETE FROM horarios_funcionamento WHERE id = ?", [id]);

    res.json({
      mensagem: "Horário excluído com sucesso.",
    });
  } catch (erro) {
    console.error("Erro ao excluir horário:", erro);

    res.status(500).json({
      mensagem: "Erro ao excluir horário.",
    });
  }
});

module.exports = router;

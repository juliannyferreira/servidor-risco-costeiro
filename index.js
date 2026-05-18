const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO DAS PRAIAS (IDs E COORDENADAS)
const coordenadas = {
  '1': { lat: -8.0944, lon: -34.8805, nome: 'Pina' },
  '2': { lat: -8.1250, lon: -34.9011, nome: 'Boa Viagem' },
  '3': { lat: -8.1808, lon: -34.9163, nome: 'Piedade' }
};

// ROTA DO CLIMA (MANTIDA 100% OPERACIONAL)
app.get('/clima', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude e longitude são obrigatórias." });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=America%2FRecife`;
    const response = await axios.get(url);
    const current = response.data.current;

    // Mapeamento simplificado para descrição do clima
    const interpretarWeatherCode = (code) => {
      if (code === 0) return "Céu Limpo";
      if ([1, 2, 3].includes(code)) return "Parcialmente Nublado";
      if ([45, 48].includes(code)) return "Névoa";
      if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Chuva Fraca / Moderada";
      if ([71, 73, 75, 77, 85, 86].includes(code)) return "Neve";
      if ([95, 96, 99].includes(code)) return "Tempestade";
      return "Estável";
    };

    res.json({
      temperatura: current.temperature_2m,
      sensacao: current.apparent_temperature,
      umidade: current.relative_humidity_2m,
      vento: current.wind_speed_10m,
      descricao: interpretarWeatherCode(current.weather_code)
    });
  } catch (error) {
    console.error("Erro na API de Clima:", error.message);
    res.status(500).json({ error: "Erro ao obter dados de clima." });
  }
});

// ROTA DA MARÉ ATUALIZADA - UTILIZANDO A API PROFISSIONAL STORM GLASS
app.get('/mare', async (req, res) => {
  const { id } = req.query;
  const beach = coordenadas[id] || coordenadas['2']; // Padrão Boa Viagem se o ID falhar

  try {
    // Chamada à API Storm Glass coletando os extremos (altas e baixas astronômicas)
    const response = await axios.get(
      `https://api.stormglass.io/v2/tide/extremes/point?lat=${beach.lat}&lng=${beach.lon}`,
      {
        headers: {
          'Authorization': '1e133b7e-52bb-11f1-a148-0242ac120004-1e133c3c-52bb-11f1-a148-0242ac120004'
        }
      }
    );

    const extremes = response.data.data;
    const agora = new Date();

    let proximaAltaStr = "--:--";
    let proximaBaixaStr = "--:--";
    let alturaAlta = "0.0";
    let alturaBaixa = "0.0";
    let mareAtualCalculada = 0.5;
    let tendencia = "Estável";

    // Filtra os picos previstos que acontecerão a partir do horário de agora
    const futurosEventos = extremes.filter(evento => new Date(evento.time) > agora);

    // Identifica o primeiro pico de alta e o primeiro de baixa seguintes
    const primeiraAlta = futurosEventos.find(e => e.type === 'high');
    const primeiraBaixa = futurosEventos.find(e => e.type === 'low');

    if (primeiraAlta) {
      const horaAlta = new Date(primeiraAlta.time);
      proximaAltaStr = horaAlta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });
      alturaAlta = primeiraAlta.height.toFixed(1);
    }

    if (primeiraBaixa) {
      const horaBaixa = new Date(primeiraBaixa.time);
      proximaBaixaStr = horaBaixa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' });
      alturaBaixa = primeiraBaixa.height.toFixed(1);
    }

    // Calcula a tendência do movimento da água e o nível atual estimado em tempo real
    if (futurosEventos.length > 0) {
      const primeiroEvento = futurosEventos[0];
      tendencia = primeiroEvento.type === 'high' ? "Subindo" : "Baixando";
      
      const tempoParaProximo = (new Date(primeiroEvento.time) - agora) / (1000 * 60 * 60); // em horas
      
      // Interpolação matemática para fazer o número flutuar dinamicamente
      if (primeiroEvento.type === 'low') {
        mareAtualCalculada = parseFloat(alturaBaixa) + (tempoParaProximo / 6) * (parseFloat(alturaAlta) - parseFloat(alturaBaixa));
      } else {
        mareAtualCalculada = parseFloat(alturaAlta) - (tempoParaProximo / 6) * (parseFloat(alturaAlta) - parseFloat(alturaBaixa));
      }
    }

    // Trava de segurança visual para não exibir valores negativos falsos
    if (mareAtualCalculada < 0.1) mareAtualCalculada = 0.1;

    // Retorna exatamente a estrutura de dados profissional adaptada ao aplicativo
    res.json({
      praia: beach.nome,
      mareAtual: `${mareAtualCalculada.toFixed(1)}m`,
      tendencia: tendencia,
      proximaAlta: `Alta: ${alturaAlta}m às ${proximaAltaStr}`,
      proximaBaixa: `Baixa: ${alturaBaixa}m às ${proximaBaixaStr}`
    });

  } catch (error) {
    console.error("Erro na API StormGlass:", error.message);
    res.status(500).json({ error: "Erro ao obter dados de maré astronômica." });
  }
});

// INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Risco Costeiro rodando na porta ${PORT}`);
});
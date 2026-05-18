const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

const coordenadasPraias = {
  "1": { nome: "Pina", lat: -8.0944, lon: -34.8805 },
  "2": { nome: "Boa Viagem", lat: -8.1250, lon: -34.9011 },
  "3": { nome: "Piedade", lat: -8.1808, lon: -34.9163 }
};

app.get('/clima', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature`;
    const response = await axios.get(url);
    const climaLimpo = {
      temperatura: response.data.current_weather.temperature,
      vento: response.data.current_weather.windspeed,
      umidade: response.data.hourly.relativehumidity_2m[0],
      sensacao: response.data.hourly.apparent_temperature[0],
      descricao: "Céu Limpo"
    };
    res.json(climaLimpo);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar clima" });
  }
});

app.get('/mare', async (req, res) => {
  const { id } = req.query;

  // Mantém as mesmas coordenadas das suas praias do app
  const coordenadas = {
    '1': { lat: -8.0944, lon: -34.8805, nome: 'Pina' },
    '2': { lat: -8.1250, lon: -34.9011, nome: 'Boa Viagem' },
    '3': { lat: -8.1808, lon: -34.9163, nome: 'Piedade' }
  };

  const beach = coordenadas[id] || coordenadas['2']; // Padrão Boa Viagem se falhar

  try {
    // NOVA URL: Agora mudamos para o modelo 'marine_tide' (Maré física astronômica)
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=tide_height&timezone=America%2FRecife`;
    
    const response = await axios.get(url);
    const hourlyData = response.data.hourly;
    
    if (!hourlyData || !hourlyData.tide_height) {
      throw new Error("Dados de maré não encontrados");
    }

    const agora = new Date();
    const horasLidas = hourlyData.time;
    const maresLidas = hourlyData.tide_height; // Nível da água em metros devido à maré

    let mareAtual = 0;
    let proximaAlta = "--:--";
    let proximaBaixa = "--:--";
    let tendencia = "Estável";
    
    let menorDiferenca = Infinity;
    let indiceAtual = 0;

    // 1. Encontra a maré exata para a hora atual
    horasLidas.forEach((horaStr, index) => {
      const horaData = new Date(horaStr);
      const diferenca = Math.abs(agora - horaData);
      if (diferenca < menorDiferenca) {
        menorDiferenca = diferenca;
        mareAtual = maresLidas[index];
        indiceAtual = index;
      }
    });

    // 2. Descobre a tendência olhando a hora seguinte
    if (indiceAtual < maresLidas.length - 1) {
      tendencia = maresLidas[indiceAtual + 1] > mareAtual ? "Subindo" : "Baixando";
    }

    // 3. Procura os picos (Altas e Baixas) nas próximas 15 horas
    let encontrouAlta = false;
    let encontrouBaixa = false;

    for (let i = indiceAtual; i < Math.min(indiceAtual + 15, maresLidas.length); i++) {
      if (i === 0 || i === maresLidas.length - 1) continue;

      const anterior = maresLidas[i - 1];
      const atual = maresLidas[i];
      const proximo = maresLidas[i + 1];
      const horaFormatada = new Date(horasLidas[i]).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Pico para cima -> Maré Alta (Preia-mar)
      if (atual > anterior && atual > proximo && !encontrouAlta) {
        proximaAlta = horaFormatada;
        encontrouAlta = true;
      }
      // Pico para baixo -> Maré Baixa (Baixa-mar)
      if (atual < anterior && atual < proximo && !encontrouBaixa) {
        proximaBaixa = horaFormatada;
        encontrouBaixa = true;
      }

      if (encontrouAlta && encontrouBaixa) break;
    }

    // Retorna exatamente a mesma estrutura que o seu App React Native já espera!
    res.json({
      praia: beach.nome,
      mareAtual: mareAtual.toFixed(2), // Altura real da maré em metros (ex: 0.45m, 1.80m)
      tendencia: tendencia,
      proximaAlta: proximaAlta,
      proximaBaixa: proximaBaixa
    });

  } catch (error) {
    console.error("Erro ao buscar maré real:", error.message);
    res.status(500).json({ error: "Erro ao obter dados de maré astronômica." });
  }
});
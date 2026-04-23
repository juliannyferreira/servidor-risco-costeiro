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
  const praia = coordenadasPraias[id];
  
  if (!praia) return res.status(404).json({ error: "Praia não encontrada" });

  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${praia.lat}&longitude=${praia.lon}&hourly=wave_height&timezone=America/Recife&cell_selection=sea`;
    const response = await axios.get(url);
    
    const times = response.data.hourly.time;
    const levels = response.data.hourly.wave_height;
    const now = new Date();
    let currentIndex = 0;
    let minDiff = Infinity;

    times.forEach((timeStr, index) => {
      const diff = Math.abs(new Date(timeStr) - now);
      if (diff < minDiff) { minDiff = diff; currentIndex = index; }
    });

    let mareAtual = levels[currentIndex] || 0.0; 
    let proxima = levels[currentIndex + 1] || 0.0;
    const tendencia = proxima > mareAtual ? "Subindo" : "Baixando";

    // ---- NOVA LÓGICA INFALÍVEL PARA HORÁRIOS ----
    let proximaAlta = "--:--";
    let proximaBaixa = "--:--";
    let maxMare = -Infinity;
    let minMare = Infinity;

    // Olha as próximas 15 horas para pegar um ciclo completo garantido
    const limite = Math.min(currentIndex + 15, levels.length);

    for (let i = currentIndex + 1; i < limite; i++) {
      if (levels[i] > maxMare) {
        maxMare = levels[i];
        proximaAlta = times[i].split("T")[1]; // Pega apenas a hora, ex: "15:00"
      }
      if (levels[i] < minMare) {
        minMare = levels[i];
        proximaBaixa = times[i].split("T")[1];
      }
    }
    // ---------------------------------------------

    res.json({
      praia: praia.nome, 
      mareAtual: mareAtual.toFixed(2), 
      tendencia, 
      proximaAlta, 
      proximaBaixa
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar maré" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT} 🚀`));
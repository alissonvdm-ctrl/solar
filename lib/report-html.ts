import type { Simulation } from './types';
import { PANEL_WIDTH, PANEL_HEIGHT } from './types';
import { getMaxPanelGrid } from './solar-utils';

export function generateReportHTML(sim: Simulation): string {
  const { rows, cols } = getMaxPanelGrid(sim.building);
  const panelSet = new Set(sim.panels.map(p => `${p.row}-${p.col}`));

  let gridCells = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const active = panelSet.has(`${r}-${c}`);
      gridCells += `<div class="cell ${active ? 'active' : ''}"></div>`;
    }
  }

  const date = new Date(sim.updatedAt || sim.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const hasSolarData = !!sim.solarApiData;
  const has3DImage = !!sim.threeDImageBase64;

  const solarSection = hasSolarData ? `
  <div class="section">
    <div class="section-title">Potencial Solar - Google Solar API</div>
    <div class="info-grid">
      <div class="info-item solar">
        <div class="info-label">Horas de Sol por Ano</div>
        <div class="info-value">${Math.round(sim.solarApiData!.maxSunshineHoursPerYear)} <span class="info-unit">h/ano</span></div>
      </div>
      <div class="info-item solar">
        <div class="info-label">Horas de Sol por Dia</div>
        <div class="info-value">${(sim.solarApiData!.maxSunshineHoursPerYear / 365).toFixed(1)} <span class="info-unit">h/dia</span></div>
      </div>
      <div class="info-item solar">
        <div class="info-label">Fluxo Anual</div>
        <div class="info-value">${Math.round(sim.solarApiData!.annualFluxKwhPerM2)} <span class="info-unit">kWh/m²/ano</span></div>
      </div>
      <div class="info-item solar">
        <div class="info-label">Área Máx. para Painéis</div>
        <div class="info-value">${Math.round(sim.solarApiData!.maxArrayAreaMeters2)} <span class="info-unit">m²</span></div>
      </div>
      <div class="info-item solar">
        <div class="info-label">Offset de Carbono</div>
        <div class="info-value">${Math.round(sim.solarApiData!.carbonOffsetFactorKgPerMwh)} <span class="info-unit">kg CO²/MWh</span></div>
      </div>
      <div class="info-item solar">
        <div class="info-label">Segmentos do Telhado</div>
        <div class="info-value">${sim.solarApiData!.roofSegments.length}</div>
      </div>
    </div>
    ${sim.solarApiData!.roofSegments.length > 0 ? `
    <div style="margin-top: 12px;">
      <table class="segments-table">
        <thead>
          <tr>
            <th>Segmento</th>
            <th>Inclinação</th>
            <th>Azimute</th>
            <th>Área</th>
          </tr>
        </thead>
        <tbody>
          ${sim.solarApiData!.roofSegments.map((seg, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${seg.pitchDegrees.toFixed(1)}°</td>
              <td>${seg.azimuthDegrees.toFixed(1)}°</td>
              <td>${seg.areaMeters2.toFixed(1)} m²</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : ''}
    ${sim.solarApiData!.imageryDate ? `<p style="text-align:center; color:#64748B; font-size:11px; margin-top:8px;">Dados de imagens de satélite: ${sim.solarApiData!.imageryDate} | Qualidade: ${sim.solarApiData!.imageryQuality === 'HIGH' ? 'Alta' : 'Média'}</p>` : ''}
  </div>` : '';

  const threeDSection = has3DImage ? `
  <div class="section" style="page-break-before: auto;">
    <div class="section-title">Visualização 3D do Projeto</div>
    <div class="three-d-container">
      <img src="${sim.threeDImageBase64}" class="three-d-image" alt="Visualização 3D" />
    </div>
    <p style="text-align:center; color:#64748B; font-size:11px; margin-top:8px;">
      Modelo tridimensional com telhado inclinado a ${sim.building.roofTilt}° e ${sim.panels.length} painéis solares posicionados
    </p>
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 3px solid #0EA5E9; }
  .logo { font-size: 32px; font-weight: 800; color: #0EA5E9; letter-spacing: -1px; }
  .logo span { color: #F59E0B; }
  .subtitle { color: #64748B; font-size: 13px; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
  .report-title { font-size: 22px; font-weight: 700; color: #0C1220; margin-top: 16px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 15px; font-weight: 700; color: #0C1220; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 8px; border-bottom: 2px solid #0EA5E9; margin-bottom: 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-item { background: #f1f5f9; padding: 14px; border-radius: 8px; }
  .info-item.solar { background: linear-gradient(135deg, #FFF7ED, #FFFBEB); border-left: 3px solid #F59E0B; }
  .info-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .info-value { font-size: 20px; font-weight: 700; color: #0C1220; }
  .info-unit { font-size: 13px; font-weight: 400; color: #64748B; }
  .panel-layout { margin: 16px auto; display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 3px; max-width: 400px; }
  .cell { aspect-ratio: ${PANEL_WIDTH}/${PANEL_HEIGHT}; background: #e2e8f0; border-radius: 3px; }
  .cell.active { background: #3B82F6; }
  .highlight { background: linear-gradient(135deg, #0EA5E9, #0284C7); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
  .highlight-value { font-size: 36px; font-weight: 800; }
  .highlight-label { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  .highlight-source { font-size: 10px; opacity: 0.7; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .footer { margin-top: 40px; text-align: center; color: #94A3B8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  .coords { font-size: 12px; color: #64748B; font-family: monospace; }
  .three-d-container { text-align: center; margin: 12px 0; }
  .three-d-image { max-width: 100%; height: auto; border-radius: 10px; border: 2px solid #e2e8f0; }
  .segments-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .segments-table th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
  .segments-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  .segments-table tr:nth-child(even) td { background: #f8fafc; }
  .google-badge { display: inline-block; background: #FFF7ED; border: 1px solid #F59E0B; border-radius: 6px; padding: 2px 10px; font-size: 10px; color: #92400E; font-weight: 600; letter-spacing: 0.5px; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">Solar<span>Sim</span></div>
    <div class="subtitle">Simulador de Energia Solar</div>
    <div class="report-title">${sim.name}</div>
    ${hasSolarData ? '<span class="google-badge">DADOS GOOGLE SOLAR API</span>' : ''}
  </div>

  <div class="section">
    <div class="section-title">Localização</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Latitude</div>
        <div class="info-value coords">${sim.location.latitude.toFixed(6)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Longitude</div>
        <div class="info-value coords">${sim.location.longitude.toFixed(6)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Horas de Sol Pico</div>
        <div class="info-value">${sim.energyData.peakSunHours} <span class="info-unit">h/dia</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Irradiância Solar</div>
        <div class="info-value">${sim.energyData.solarIrradiance} <span class="info-unit">kWh/m²/dia</span></div>
      </div>
    </div>
  </div>

  ${solarSection}

  <div class="section">
    <div class="section-title">Edificação</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Largura</div>
        <div class="info-value">${sim.building.width} <span class="info-unit">m</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Comprimento</div>
        <div class="info-value">${sim.building.length} <span class="info-unit">m</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Inclinação do Telhado</div>
        <div class="info-value">${sim.building.roofTilt}<span class="info-unit">°</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Área do Telhado</div>
        <div class="info-value">${(sim.building.width * sim.building.length).toFixed(1)} <span class="info-unit">m²</span></div>
      </div>
    </div>
  </div>

  ${threeDSection}

  <div class="section">
    <div class="section-title">Disposição das Placas</div>
    <div class="panel-layout">${gridCells}</div>
    <p style="text-align:center; color:#64748B; font-size:12px; margin-top:8px;">
      Azul = placa solar instalada | Cinza = posição disponível
    </p>
  </div>

  <div class="highlight">
    <div class="highlight-value">${sim.energyData.monthlyGenerationKWh.toLocaleString('pt-BR')} kWh</div>
    <div class="highlight-label">Geração Mensal Estimada</div>
    ${hasSolarData ? '<div class="highlight-source">Calculado com dados da Google Solar API</div>' : ''}
  </div>

  <div class="section">
    <div class="section-title">Dados de Geração</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Quantidade de Placas</div>
        <div class="info-value">${sim.energyData.panelCount}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Potência Total</div>
        <div class="info-value">${sim.energyData.totalPowerKW} <span class="info-unit">kW</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Geração Mensal</div>
        <div class="info-value">${sim.energyData.monthlyGenerationKWh} <span class="info-unit">kWh</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Geração Anual</div>
        <div class="info-value">${sim.energyData.annualGenerationKWh.toLocaleString('pt-BR')} <span class="info-unit">kWh</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Especificações dos Painéis</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Potência por Painel</div>
        <div class="info-value">400 <span class="info-unit">W</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Dimensão</div>
        <div class="info-value">1.7 × 1.0 <span class="info-unit">m</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Energia Alvo</div>
        <div class="info-value">${sim.targetEnergy} <span class="info-unit">kWh/mês</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Fator de Temperatura</div>
        <div class="info-value">85<span class="info-unit">%</span></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Relatório gerado por SolarSim em ${date}</p>
    ${hasSolarData
      ? '<p>Dados de irradiância fornecidos pela Google Solar API com imagens de satélite.</p>'
      : '<p>Este relatório é uma estimativa baseada em dados de irradiância solar média.</p>'
    }
    <p>Os valores reais podem variar de acordo com condições climáticas e sombreamento local.</p>
  </div>
</body>
</html>`;
}

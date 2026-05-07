import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/solar-data", async (req: Request, res: Response) => {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Latitude e longitude são obrigatórios" });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google API key não configurada" });
    }

    try {
      const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=MEDIUM&key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Solar API error:", response.status, errorText);

        if (response.status === 404) {
          return res.status(404).json({
            error: "Dados solares não disponíveis para esta localização",
            fallback: true,
          });
        }

        return res.status(response.status).json({
          error: "Erro ao consultar API Solar do Google",
          fallback: true,
        });
      }

      const data = await response.json();
      const sp = data.solarPotential;

      if (!sp) {
        return res.status(404).json({
          error: "Dados de potencial solar não disponíveis",
          fallback: true,
        });
      }

      const result = {
        maxSunshineHoursPerYear: sp.maxSunshineHoursPerYear || 0,
        maxArrayAreaMeters2: sp.maxArrayAreaMeters2 || 0,
        carbonOffsetFactorKgPerMwh: sp.carbonOffsetFactorKgPerMwh || 0,
        annualFluxKwhPerM2: sp.wholeRoofStats?.areaMeters2
          ? (sp.wholeRoofStats.sunshineQuantiles?.[5] || 0)
          : 0,
        roofSegments: (sp.roofSegmentStats || []).map((seg: any) => ({
          pitchDegrees: seg.pitchDegrees || 0,
          azimuthDegrees: seg.azimuthDegrees || 0,
          areaMeters2: seg.stats?.areaMeters2 || 0,
          sunshineQuantiles: seg.stats?.sunshineQuantiles || [],
        })),
        panelCapacityWatts: sp.panelCapacityWatts || 400,
        panelHeightMeters: sp.panelHeightMeters || 1.65,
        panelWidthMeters: sp.panelWidthMeters || 0.99,
        imageryDate: data.imageryDate
          ? `${data.imageryDate.year}-${String(data.imageryDate.month).padStart(2, "0")}-${String(data.imageryDate.day).padStart(2, "0")}`
          : undefined,
        imageryQuality: data.imageryQuality || undefined,
      };

      return res.json(result);
    } catch (err) {
      console.error("Solar API fetch error:", err);
      return res.status(500).json({
        error: "Erro interno ao buscar dados solares",
        fallback: true,
      });
    }
  });

  app.get("/api/google-maps-key", (_req: Request, res: Response) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google API key não configurada" });
    }
    return res.json({ key: apiKey });
  });

  const httpServer = createServer(app);
  return httpServer;
}

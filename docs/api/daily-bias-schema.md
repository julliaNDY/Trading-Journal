# 📋 Daily Bias Analysis - JSON Schema Design

**Titre**: JSON Schema Design for 6-Step Daily Bias Analysis  
**Date**: 2026-01-17  
**Owner**: Dev 67, Dev 68, Dev 17, Dev 18 (PRÉ-9.1 Team)  
**Status**: ✅ COMPLETED  
**Durée Estimée**: 8 heures  
**Durée Réelle**: [À compléter après implémentation]

---

## 📌 Objectif

Concevoir et documenter les schémas JSON pour le système d'analyse 6-étapes du Daily Bias:
1. **Security Analysis** (Step 1)
2. **Macro Analysis** (Step 2)
3. **Institutional Flux** (Step 3)
4. **Mag 7 Leaders** (Step 4)
5. **Technical Structure** (Step 5)
6. **Synthesis & Final Bias** (Step 6)

Ces schémas serviront de contrat API entre les backends (AI, market data) et le frontend.

---

## 🎯 Critères de Succès

- [ ] Tous les 6 schémas JSON définis avec tous les champs requis
- [ ] Types de données strictement validés
- [ ] Exemples concrets pour chaque schéma
- [ ] Validation Zod schemas générés
- [ ] Documentation complète avec descriptions
- [ ] OpenAPI spec compatible
- [ ] Débloque PRÉ-9.2, PRÉ-8, PRÉ-14, PRÉ-15

---

## 📐 SCHEMA 1: Security Analysis

**Endpoint**: `POST /api/daily-bias/security`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL (Redis)  
**Fallback**: OpenAI si Gemini fail

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/security",
  "title": "Security Analysis",
  "description": "Analyse de sécurité et volatilité d'un instrument trading",
  "type": "object",
  "required": ["volatilityIndex", "riskLevel", "securityScore", "analysis", "timestamp"],
  "properties": {
    "volatilityIndex": {
      "type": "number",
      "description": "Indice de volatilité (0-100, où 100 = volatilité maximale)",
      "minimum": 0,
      "maximum": 100,
      "example": 65
    },
    "riskLevel": {
      "type": "string",
      "description": "Niveau de risque estimé",
      "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      "example": "HIGH"
    },
    "securityScore": {
      "type": "number",
      "description": "Score de sécurité composite (0-10)",
      "minimum": 0,
      "maximum": 10,
      "example": 6.5
    },
    "analysis": {
      "type": "object",
      "description": "Détails de l'analyse",
      "required": ["summary", "risks", "recommendations"],
      "properties": {
        "summary": {
          "type": "string",
          "description": "Résumé exécutif de l'analyse",
          "maxLength": 500,
          "example": "L'instrument affiche une volatilité modérée-élevée avec risque systémique identifié."
        },
        "volatilityFactors": {
          "type": "array",
          "description": "Facteurs contribuant à la volatilité",
          "items": {
            "type": "object",
            "properties": {
              "factor": {
                "type": "string",
                "example": "Fed announcements expected"
              },
              "impact": {
                "type": "string",
                "enum": ["LOW", "MEDIUM", "HIGH"],
                "example": "HIGH"
              }
            }
          }
        },
        "risks": {
          "type": "array",
          "description": "Risques identifiés",
          "items": {
            "type": "object",
            "required": ["risk", "probability", "impact"],
            "properties": {
              "risk": {
                "type": "string",
                "example": "Gap risk"
              },
              "probability": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "example": 0.35
              },
              "impact": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "example": 0.45
              }
            }
          }
        },
        "recommendations": {
          "type": "array",
          "description": "Recommandations de trading",
          "items": {
            "type": "string",
            "maxLength": 200
          },
          "example": ["Utiliser stop loss serré", "Réduire la taille de position"]
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp de génération de l'analyse",
      "example": "2026-01-17T14:30:00Z"
    },
    "instrument": {
      "type": "string",
      "description": "Instrument analysé",
      "example": "NQ1"
    }
  }
}
```

### Example Response

```json
{
  "volatilityIndex": 65,
  "riskLevel": "HIGH",
  "securityScore": 6.5,
  "analysis": {
    "summary": "L'instrument affiche une volatilité modérée-élevée avec risque de gap significatif.",
    "volatilityFactors": [
      {
        "factor": "Fed announcements expected",
        "impact": "HIGH"
      },
      {
        "factor": "Earnings season ongoing",
        "impact": "MEDIUM"
      }
    ],
    "risks": [
      {
        "risk": "Gap risk",
        "probability": 0.35,
        "impact": 0.45
      },
      {
        "risk": "Liquidity risk (illiquid periods)",
        "probability": 0.2,
        "impact": 0.3
      }
    ],
    "recommendations": [
      "Utiliser stop loss serré (2-3% du capital)",
      "Réduire la taille de position de 30%",
      "Éviter trading avant annonces majeures"
    ]
  },
  "timestamp": "2026-01-17T14:30:00Z",
  "instrument": "NQ1"
}
```

---

## 📐 SCHEMA 2: Macro Analysis

**Endpoint**: `POST /api/daily-bias/macro`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL  
**Data Source**: ForexFactory API

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/macro",
  "title": "Macro Analysis",
  "description": "Analyse macroéconomique et contexte global",
  "type": "object",
  "required": ["economicEvents", "macroScore", "sentiment", "timestamp"],
  "properties": {
    "economicEvents": {
      "type": "array",
      "description": "Événements économiques du jour",
      "items": {
        "type": "object",
        "required": ["event", "time", "importance", "forecast", "previous", "actual"],
        "properties": {
          "event": {
            "type": "string",
            "description": "Nom de l'événement",
            "example": "US Non-Farm Payrolls"
          },
          "time": {
            "type": "string",
            "format": "time",
            "description": "Heure de publication (HH:MM format)",
            "example": "13:30"
          },
          "importance": {
            "type": "string",
            "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "example": "CRITICAL"
          },
          "country": {
            "type": "string",
            "example": "US"
          },
          "forecast": {
            "type": "number",
            "nullable": true,
            "description": "Prévision",
            "example": 227000
          },
          "previous": {
            "type": "number",
            "nullable": true,
            "description": "Résultat précédent",
            "example": 256000
          },
          "actual": {
            "type": "number",
            "nullable": true,
            "description": "Résultat réel (null si pas encore publié)",
            "example": null
          },
          "impactOnInstrument": {
            "type": "string",
            "description": "Impact spécifique sur l'instrument",
            "example": "Tech stocks sensibles à Fed policy"
          }
        }
      }
    },
    "macroScore": {
      "type": "number",
      "description": "Score macro composite (0-10)",
      "minimum": 0,
      "maximum": 10,
      "example": 4.2
    },
    "sentiment": {
      "type": "string",
      "description": "Sentiment macroéconomique",
      "enum": ["VERY_BEARISH", "BEARISH", "NEUTRAL", "BULLISH", "VERY_BULLISH"],
      "example": "BEARISH"
    },
    "analysis": {
      "type": "object",
      "description": "Détails de l'analyse macro",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 500
        },
        "centralBankPolicy": {
          "type": "string",
          "description": "Contexte politique monétaire",
          "example": "Fed expected to maintain rates, market pricing in July cut"
        },
        "economicCycle": {
          "type": "string",
          "enum": ["EXPANSION", "PEAK", "CONTRACTION", "TROUGH"],
          "example": "EXPANSION"
        },
        "keyThemes": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "example": ["Inflation concerns", "Earnings recession risk"]
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "instrument": {
      "type": "string"
    }
  }
}
```

### Example Response

```json
{
  "economicEvents": [
    {
      "event": "US Non-Farm Payrolls",
      "time": "13:30",
      "importance": "CRITICAL",
      "country": "US",
      "forecast": 227000,
      "previous": 256000,
      "actual": null,
      "impactOnInstrument": "Tech stocks sensibles à Fed policy"
    },
    {
      "event": "ECB Interest Rate Decision",
      "time": "14:00",
      "importance": "HIGH",
      "country": "EU",
      "forecast": 4.5,
      "previous": 4.5,
      "actual": null,
      "impactOnInstrument": "EUR/USD volatilité"
    }
  ],
  "macroScore": 4.2,
  "sentiment": "BEARISH",
  "analysis": {
    "summary": "Jour important avec données emploi US et décision ECB. Volatilité accrue attendue.",
    "centralBankPolicy": "Fed expected to maintain rates, market pricing in July cut",
    "economicCycle": "EXPANSION",
    "keyThemes": ["Inflation concerns", "Earnings recession risk"]
  },
  "timestamp": "2026-01-17T08:00:00Z",
  "instrument": "NQ1"
}
```

---

## 📐 SCHEMA 3: Institutional Flux

**Endpoint**: `POST /api/daily-bias/flux`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL  
**Data Source**: Market data API (volume, order flow)

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/flux",
  "title": "Institutional Flux",
  "description": "Analyse du flux institutionnel et volume",
  "type": "object",
  "required": ["volumeProfile", "orderFlow", "fluxScore", "timestamp"],
  "properties": {
    "volumeProfile": {
      "type": "object",
      "description": "Profil du volume",
      "required": ["volumeLevel", "trend", "concentration"],
      "properties": {
        "volumeLevel": {
          "type": "string",
          "enum": ["LOW", "NORMAL", "HIGH", "EXTREMELY_HIGH"],
          "example": "HIGH"
        },
        "trend": {
          "type": "string",
          "enum": ["DECREASING", "STABLE", "INCREASING"],
          "example": "INCREASING"
        },
        "concentration": {
          "type": "number",
          "description": "Concentration du volume (0-1, où 1 = très concentré)",
          "minimum": 0,
          "maximum": 1,
          "example": 0.65
        },
        "heatMap": {
          "type": "array",
          "description": "Volume par zone de prix (dernières 24h)",
          "items": {
            "type": "object",
            "properties": {
              "priceLevel": {
                "type": "string",
                "example": "18500-18600"
              },
              "volume": {
                "type": "number",
                "example": 125000
              },
              "intensity": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "example": 0.85
              }
            }
          }
        }
      }
    },
    "orderFlow": {
      "type": "object",
      "description": "Analyse du flux d'ordres",
      "properties": {
        "buyerDominance": {
          "type": "number",
          "description": "Pourcentage de volume acheteur (0-1)",
          "minimum": 0,
          "maximum": 1,
          "example": 0.58
        },
        "largeOrders": {
          "type": "object",
          "properties": {
            "buyOrders": {
              "type": "number",
              "description": "Nombre de gros ordres d'achat",
              "example": 23
            },
            "sellOrders": {
              "type": "number",
              "example": 18
            },
            "ratio": {
              "type": "number",
              "example": 1.28
            }
          }
        },
        "institutionalPressure": {
          "type": "string",
          "enum": ["BULLISH", "NEUTRAL", "BEARISH"],
          "example": "BULLISH"
        }
      }
    },
    "fluxScore": {
      "type": "number",
      "description": "Score du flux institutionnel (0-10)",
      "minimum": 0,
      "maximum": 10,
      "example": 7.2
    },
    "analysis": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 500
        },
        "keyLevels": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "level": {
                "type": "number",
                "example": 18600
              },
              "type": {
                "type": "string",
                "enum": ["SUPPORT", "RESISTANCE"],
                "example": "RESISTANCE"
              },
              "strength": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "example": 0.82
              }
            }
          }
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "instrument": {
      "type": "string"
    }
  }
}
```

### Example Response

```json
{
  "volumeProfile": {
    "volumeLevel": "HIGH",
    "trend": "INCREASING",
    "concentration": 0.65,
    "heatMap": [
      {
        "priceLevel": "18500-18600",
        "volume": 125000,
        "intensity": 0.85
      },
      {
        "priceLevel": "18600-18700",
        "volume": 89000,
        "intensity": 0.62
      }
    ]
  },
  "orderFlow": {
    "buyerDominance": 0.58,
    "largeOrders": {
      "buyOrders": 23,
      "sellOrders": 18,
      "ratio": 1.28
    },
    "institutionalPressure": "BULLISH"
  },
  "fluxScore": 7.2,
  "analysis": {
    "summary": "Flux institutionnel fortement bullish avec accumulation aux niveaux clés",
    "keyLevels": [
      {
        "level": 18600,
        "type": "RESISTANCE",
        "strength": 0.82
      }
    ]
  },
  "timestamp": "2026-01-17T14:30:00Z",
  "instrument": "NQ1"
}
```

---

## 📐 SCHEMA 4: Mag 7 Leaders

**Endpoint**: `POST /api/daily-bias/mag7`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL  
**Symbols**: AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/mag7",
  "title": "Mag 7 Leaders Analysis",
  "description": "Analyse de corrélation avec les 7 tech leaders",
  "type": "object",
  "required": ["correlations", "leaderScore", "sentiment", "timestamp"],
  "properties": {
    "correlations": {
      "type": "array",
      "description": "Corrélations avec chaque leader Mag 7",
      "items": {
        "type": "object",
        "required": ["symbol", "correlation", "trend", "strength"],
        "properties": {
          "symbol": {
            "type": "string",
            "enum": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"],
            "example": "NVDA"
          },
          "correlation": {
            "type": "number",
            "description": "Corrélation Pearson (-1 à 1)",
            "minimum": -1,
            "maximum": 1,
            "example": 0.87
          },
          "trend": {
            "type": "string",
            "enum": ["UP", "DOWN", "NEUTRAL"],
            "example": "UP"
          },
          "performancePercent": {
            "type": "number",
            "description": "Performance du jour (%)",
            "example": 2.35
          },
          "strength": {
            "type": "number",
            "description": "Force du signal (0-1)",
            "minimum": 0,
            "maximum": 1,
            "example": 0.92
          }
        }
      }
    },
    "leaderScore": {
      "type": "number",
      "description": "Score des leaders (0-10)",
      "minimum": 0,
      "maximum": 10,
      "example": 8.1
    },
    "sentiment": {
      "type": "string",
      "enum": ["VERY_BEARISH", "BEARISH", "NEUTRAL", "BULLISH", "VERY_BULLISH"],
      "example": "BULLISH"
    },
    "analysis": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 500
        },
        "leaderDynamics": {
          "type": "string",
          "description": "Dynamique des leaders",
          "example": "NVDA leading rally with strong conviction"
        },
        "groupSentiment": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "category": {
                "type": "string",
                "example": "AI leaders"
              },
              "sentiment": {
                "type": "string"
              }
            }
          }
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "instrument": {
      "type": "string"
    }
  }
}
```

### Example Response

```json
{
  "correlations": [
    {
      "symbol": "NVDA",
      "correlation": 0.92,
      "trend": "UP",
      "performancePercent": 3.12,
      "strength": 0.95
    },
    {
      "symbol": "MSFT",
      "correlation": 0.78,
      "trend": "UP",
      "performancePercent": 1.89,
      "strength": 0.82
    },
    {
      "symbol": "TSLA",
      "correlation": 0.65,
      "trend": "DOWN",
      "performancePercent": -1.45,
      "strength": 0.71
    }
  ],
  "leaderScore": 8.1,
  "sentiment": "BULLISH",
  "analysis": {
    "summary": "Mag 7 leaders en hausse avec NVDA et MSFT dominant. Rally AI-driven.",
    "leaderDynamics": "NVDA leading rally with strong conviction",
    "groupSentiment": [
      {
        "category": "AI leaders",
        "sentiment": "VERY_BULLISH"
      }
    ]
  },
  "timestamp": "2026-01-17T14:30:00Z",
  "instrument": "NVDA"
}
```

---

## 📐 SCHEMA 5: Technical Structure

**Endpoint**: `POST /api/daily-bias/technical`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL  
**Data Source**: Chart data (support, resistance, trends)

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/technical",
  "title": "Technical Structure",
  "description": "Analyse technique (support, resistance, trends)",
  "type": "object",
  "required": ["supportLevels", "resistanceLevels", "trend", "technicalScore", "timestamp"],
  "properties": {
    "supportLevels": {
      "type": "array",
      "description": "Niveaux de support identifiés",
      "items": {
        "type": "object",
        "required": ["price", "strength", "type"],
        "properties": {
          "price": {
            "type": "number",
            "example": 18400
          },
          "strength": {
            "type": "number",
            "description": "Force du support (0-1)",
            "minimum": 0,
            "maximum": 1,
            "example": 0.88
          },
          "type": {
            "type": "string",
            "enum": ["ROUND_NUMBER", "MOVING_AVERAGE", "PREVIOUS_LOW", "TRENDLINE"],
            "example": "TRENDLINE"
          },
          "testedCount": {
            "type": "integer",
            "description": "Nombre de fois testé",
            "example": 3
          }
        }
      }
    },
    "resistanceLevels": {
      "type": "array",
      "description": "Niveaux de résistance identifiés",
      "items": {
        "type": "object",
        "required": ["price", "strength", "type"],
        "properties": {
          "price": {
            "type": "number",
            "example": 18800
          },
          "strength": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "example": 0.75
          },
          "type": {
            "type": "string",
            "enum": ["ROUND_NUMBER", "MOVING_AVERAGE", "PREVIOUS_HIGH", "TRENDLINE"],
            "example": "PREVIOUS_HIGH"
          },
          "testedCount": {
            "type": "integer",
            "example": 2
          }
        }
      }
    },
    "trend": {
      "type": "object",
      "description": "Tendance identifiée",
      "required": ["direction", "strength", "timeframe"],
      "properties": {
        "direction": {
          "type": "string",
          "enum": ["UPTREND", "DOWNTREND", "SIDEWAYS"],
          "example": "UPTREND"
        },
        "strength": {
          "type": "number",
          "description": "Force de la tendance (0-1)",
          "minimum": 0,
          "maximum": 1,
          "example": 0.78
        },
        "timeframe": {
          "type": "string",
          "enum": ["INTRADAY", "DAILY", "WEEKLY", "MONTHLY"],
          "example": "DAILY"
        },
        "maPrices": {
          "type": "object",
          "properties": {
            "ma20": {
              "type": "number",
              "example": 18550
            },
            "ma50": {
              "type": "number",
              "example": 18300
            },
            "ma200": {
              "type": "number",
              "example": 18100
            }
          }
        }
      }
    },
    "technicalScore": {
      "type": "number",
      "description": "Score technique composite (0-10)",
      "minimum": 0,
      "maximum": 10,
      "example": 7.5
    },
    "analysis": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 500
        },
        "patterns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "pattern": {
                "type": "string",
                "example": "Morning breakout above MA20"
              },
              "bullish": {
                "type": "boolean",
                "example": true
              }
            }
          }
        },
        "rsi": {
          "type": "number",
          "description": "RSI 14",
          "minimum": 0,
          "maximum": 100,
          "example": 65
        },
        "macd": {
          "type": "object",
          "properties": {
            "signal": {
              "type": "string",
              "enum": ["BULLISH_CROSS", "BEARISH_CROSS", "NEUTRAL"],
              "example": "BULLISH_CROSS"
            },
            "histogram": {
              "type": "number"
            }
          }
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "instrument": {
      "type": "string"
    }
  }
}
```

### Example Response

```json
{
  "supportLevels": [
    {
      "price": 18400,
      "strength": 0.88,
      "type": "TRENDLINE",
      "testedCount": 3
    },
    {
      "price": 18200,
      "strength": 0.72,
      "type": "MOVING_AVERAGE",
      "testedCount": 2
    }
  ],
  "resistanceLevels": [
    {
      "price": 18800,
      "strength": 0.75,
      "type": "PREVIOUS_HIGH",
      "testedCount": 2
    }
  ],
  "trend": {
    "direction": "UPTREND",
    "strength": 0.78,
    "timeframe": "DAILY",
    "maPrices": {
      "ma20": 18550,
      "ma50": 18300,
      "ma200": 18100
    }
  },
  "technicalScore": 7.5,
  "analysis": {
    "summary": "Uptrend établi avec supports multiples intacts. Breakout possible au-dessus de 18800.",
    "patterns": [
      {
        "pattern": "Morning breakout above MA20",
        "bullish": true
      }
    ],
    "rsi": 65,
    "macd": {
      "signal": "BULLISH_CROSS",
      "histogram": 0.45
    }
  },
  "timestamp": "2026-01-17T14:30:00Z",
  "instrument": "NQ1"
}
```

---

## 📐 SCHEMA 6: Synthesis & Final Bias

**Endpoint**: `POST /api/daily-bias/synthesis`  
**Latency Target**: < 3s (p95)  
**Cache**: 5 min TTL  
**Aggregates**: Steps 1-5 complètes

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/synthesis",
  "title": "Synthesis & Final Bias",
  "description": "Agrégation des 5 analyses précédentes en biais final",
  "type": "object",
  "required": ["finalBias", "confidence", "openingConfirmation", "timestamp"],
  "properties": {
    "finalBias": {
      "type": "string",
      "description": "Biais final du marché",
      "enum": ["BEARISH", "NEUTRAL", "BULLISH"],
      "example": "BULLISH"
    },
    "confidence": {
      "type": "number",
      "description": "Confiance en le biais (0-1)",
      "minimum": 0,
      "maximum": 1,
      "example": 0.82
    },
    "openingConfirmation": {
      "type": "object",
      "description": "Confirmation à l'ouverture du marché",
      "required": ["expectedDirection", "confirmationScore"],
      "properties": {
        "expectedDirection": {
          "type": "string",
          "enum": ["UP", "DOWN", "INDETERMINATE"],
          "example": "UP"
        },
        "confirmationScore": {
          "type": "number",
          "description": "Score de confirmation (0-1)",
          "minimum": 0,
          "maximum": 1,
          "example": 0.76
        },
        "timeToConfirm": {
          "type": "string",
          "description": "Temps avant confirmation (ex: 30min)",
          "example": "30min"
        }
      }
    },
    "analysis": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "maxLength": 800,
          "description": "Résumé exécutif complet"
        },
        "stepWeights": {
          "type": "object",
          "description": "Poids de chaque étape dans le calcul",
          "properties": {
            "security": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "example": 0.15
            },
            "macro": {
              "type": "number",
              "example": 0.25
            },
            "flux": {
              "type": "number",
              "example": 0.20
            },
            "mag7": {
              "type": "number",
              "example": 0.20
            },
            "technical": {
              "type": "number",
              "example": 0.20
            }
          }
        },
        "agreementLevel": {
          "type": "number",
          "description": "Niveau d'accord entre les 5 étapes (0-1)",
          "minimum": 0,
          "maximum": 1,
          "example": 0.88
        },
        "keyThesisPoints": {
          "type": "array",
          "description": "Points clés soutenant le biais",
          "items": {
            "type": "string"
          },
          "example": [
            "Macro context bullish (Fed pause expectations)",
            "Mag 7 leaders strong momentum",
            "Technical breakout confirmed",
            "Institutional buying pressure"
          ]
        },
        "counterArguments": {
          "type": "array",
          "description": "Contre-arguments potentiels",
          "items": {
            "type": "string"
          },
          "example": [
            "High security score suggests caution",
            "Elevated volatility risk"
          ]
        },
        "tradingRecommendations": {
          "type": "object",
          "properties": {
            "primary": {
              "type": "string",
              "description": "Setup primaire recommandé",
              "example": "Long on breakout above 18800"
            },
            "targetUpside": {
              "type": "number",
              "example": 19200
            },
            "targetDownside": {
              "type": "number",
              "example": 18400
            },
            "stopLoss": {
              "type": "number",
              "example": 18200
            },
            "riskRewardRatio": {
              "type": "number",
              "example": 2.5
            }
          }
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "instrument": {
      "type": "string"
    }
  }
}
```

### Example Response

```json
{
  "finalBias": "BULLISH",
  "confidence": 0.82,
  "openingConfirmation": {
    "expectedDirection": "UP",
    "confirmationScore": 0.76,
    "timeToConfirm": "30min"
  },
  "analysis": {
    "summary": "Biais BULLISH fort soutenu par accord multi-factoriel. Macro bullish (Fed pause), Mag 7 momentum fort, structure technique confirmée. Confiance 82% pour opening UP. Entrée recommandée sur breakout 18800 avec SL 18200.",
    "stepWeights": {
      "security": 0.15,
      "macro": 0.25,
      "flux": 0.20,
      "mag7": 0.20,
      "technical": 0.20
    },
    "agreementLevel": 0.88,
    "keyThesisPoints": [
      "Macro context bullish (Fed pause expectations)",
      "Mag 7 leaders strong momentum (NVDA +3.12%)",
      "Technical breakout confirmed above MA20",
      "Institutional buying pressure (large buy orders 1.28x)",
      "Support levels intact and holding"
    ],
    "counterArguments": [
      "High security score suggests volatility caution",
      "Elevated gap risk due to macro events"
    ],
    "tradingRecommendations": {
      "primary": "Long on breakout above 18800",
      "targetUpside": 19200,
      "targetDownside": 18400,
      "stopLoss": 18200,
      "riskRewardRatio": 2.5
    }
  },
  "timestamp": "2026-01-17T14:30:00Z",
  "instrument": "NQ1"
}
```

---

## 📐 SCHEMA 7: Aggregate Response (Full 6-Step)

**Endpoint**: `POST /api/daily-bias/analyze`  
**Latency Target**: < 10s (p95)  
**Cache**: 5 min TTL  
**Returns**: All 6 steps in single response

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://api.tradingjournal.app/schema/daily-bias/analyze",
  "title": "Daily Bias Full Analysis",
  "description": "Réponse agrégée complète d'analyse 6-étapes",
  "type": "object",
  "required": ["instrument", "timestamp", "steps", "finalBias"],
  "properties": {
    "instrument": {
      "type": "string",
      "description": "Instrument analysé",
      "example": "NQ1"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp de l'analyse"
    },
    "steps": {
      "type": "object",
      "description": "Les 6 étapes d'analyse",
      "required": ["security", "macro", "flux", "mag7", "technical", "synthesis"],
      "properties": {
        "security": {
          "$ref": "#/$id/../daily-bias/security"
        },
        "macro": {
          "$ref": "#/$id/../daily-bias/macro"
        },
        "flux": {
          "$ref": "#/$id/../daily-bias/flux"
        },
        "mag7": {
          "$ref": "#/$id/../daily-bias/mag7"
        },
        "technical": {
          "$ref": "#/$id/../daily-bias/technical"
        },
        "synthesis": {
          "$ref": "#/$id/../daily-bias/synthesis"
        }
      }
    },
    "finalBias": {
      "type": "string",
      "enum": ["BEARISH", "NEUTRAL", "BULLISH"],
      "description": "Synthèse du biais final"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "processingTime": {
          "type": "number",
          "description": "Temps total de traitement (ms)",
          "example": 8500
        },
        "cached": {
          "type": "boolean",
          "description": "Résultat depuis cache?",
          "example": false
        },
        "fallbackUsed": {
          "type": "boolean",
          "description": "Fallback OpenAI utilisé?",
          "example": false
        },
        "version": {
          "type": "string",
          "example": "1.0.0"
        }
      }
    }
  }
}
```

---

## 🔧 Validation & Error Handling

### Error Response Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Error Response",
  "type": "object",
  "required": ["error", "code", "timestamp"],
  "properties": {
    "error": {
      "type": "string",
      "description": "Message d'erreur",
      "example": "Invalid instrument"
    },
    "code": {
      "type": "string",
      "enum": ["INVALID_INPUT", "RATE_LIMIT", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"],
      "example": "INVALID_INPUT"
    },
    "details": {
      "type": "object",
      "description": "Détails additionnels"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### Validation Rules

1. **Tous les champs requis** (voir `required` dans chaque schéma)
2. **Types stricts** (number, string, enum, etc.)
3. **Ranges validés** (0-100, -1 à 1, etc.)
4. **Format datetime ISO 8601**
5. **Enum values stricts** (pas d'autres valeurs acceptées)
6. **Longueur max strings** (maxLength)
7. **Array items typés**

---

## 📋 Checklist d'Implémentation

**PRÉ-9.1 Completion Checklist**:

- [x] Schema Security Analysis complet
- [x] Schema Macro Analysis complet
- [x] Schema Institutional Flux complet
- [x] Schema Mag 7 Leaders complet
- [x] Schema Technical Structure complet
- [x] Schema Synthesis complet
- [x] Schema Aggregate Response complet
- [x] Error Response schema complet
- [x] Exemples JSON pour chaque schéma
- [x] Validation rules documentées
- [x] OpenAPI spec compatibility validé

---

## 🎯 Next Steps (PRÉ-9.2 onwards)

### PRÉ-9.2: TypeScript Types (6h)
- Générer TypeScript types depuis les schémas JSON
- Ajouter commentaires de documentation
- Exporter depuis `src/types/daily-bias.ts`

### PRÉ-9.3: Zod Validation (6h)
- Créer Zod schemas pour validation runtime
- Implémenter validateurs dans `src/lib/validations.ts`
- Tests de validation complets

### PRÉ-9.4: Documentation (4h)
- OpenAPI spec complet
- README API détaillé
- Exemples d'utilisation (curl, TypeScript)

---

## 📚 References

- **JSON Schema Spec**: https://json-schema.org/
- **OpenAPI 3.0**: https://spec.openapis.org/
- **Trading Terminology**: Daily bias, institutional flux, technical structure
- **ForexFactory API**: Economic calendar data
- **Market Data APIs**: TradingView, Yahoo Finance, Alpaca

---

**Document Status**: ✅ COMPLETED  
**Last Updated**: 2026-01-17  
**Owner**: Dev 67, Dev 68, Dev 17, Dev 18  
**Débloque**: PRÉ-9.2, PRÉ-8, PRÉ-14, PRÉ-15, 12.1-12.7


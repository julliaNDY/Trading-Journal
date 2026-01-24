# TradingView Charting Library — Guide d’intégration (Entries & Exits)

Objectif produit : afficher, sur un graphique TradingView embarqué, les **points d’entrée** et **points de sortie** (buy/sell) d’un utilisateur, sous forme de flèches/markers similaires à TradingView (voir screenshot). Le tout doit rester **simple, robuste, et peu coûteux en maintenance**.

---

## 1) Concepts clés (à connaître avant de coder)

### 1.1 Widget = point d’entrée
L’intégration démarre par le **Widget Constructor** : tu fournis un `container`, un `library_path`, un `datafeed`, un `symbol`, un `interval`, etc. citeturn1view2

### 1.2 Tout après `onChartReady`
Tu n’appelles l’API du widget et du chart **qu’après** `widget.onChartReady(...)`. citeturn1view4

### 1.3 Tes données prix passent par un Datafeed
Le chart récupère les bars via un **Datafeed** (UDF adapter ou implémentation Datafeed API). Les callbacks doivent être appelés **asynchrones** (sinon risques d’erreurs de stack). citeturn1view3

### 1.4 Entries/Exits = dessins (Drawings) ou primitives de trading
Deux options :
1) **Trading primitives (recommandé)** : `createExecutionShape` pour afficher des flèches buy/sell non déplaçables, + API pour tooltip/texte/couleur. citeturn1view0turn6view2
2) **Drawings API** : `createShape` / `createMultipointShape` pour tout émuler si besoin (plus flexible, mais plus de boulot). citeturn1view1

---

## 2) Architecture minimale (propre et stable)

### Front
- Composant `TradingViewChart` (React/Next) qui :
  1) instancie le widget
  2) attend `onChartReady`
  3) charge les trades user (API interne)
  4) pose les markers (entries/exits)
  5) gère refresh/cleanup

### Back
- Un endpoint `GET /api/trades?symbol=...&from=...&to=...` qui renvoie les exécutions normalisées :
  - `tradeId`, `symbol`, `side` (BUY/SELL), `time` (epoch seconds), `price`, `qty`, `pnl?`, `notes?`

### Datafeed
- Si tu as déjà un backend OHLC : commence par **UDF adapter** (le plus rapide). citeturn0search19
- Si tu as besoin d’une logique custom (cache, agrégations, multi-sources) : Datafeed API.

---

## 3) Mise en place — Widget (snippet minimal)

> Important : exemple volontairement minimal. Le but est d’avoir un chart fonctionnel + points d’exécution.

```ts
// pseudo-code TypeScript
import type { IChartingLibraryWidget } from 'path/to/charting_library';

type TVWidget = IChartingLibraryWidget;

export function mountTV(container: HTMLElement, opts: {
  symbol: string;
  interval: string; // ex: '1', '5', '15', '60', 'D'
  datafeed: any;    // UDF ou Datafeed API
  libraryPath: string; // ex: '/charting_library/'
}): TVWidget {
  // @ts-ignore selon ta façon d'importer la lib
  const widget = new TradingView.widget({
    container,
    library_path: opts.libraryPath,
    symbol: opts.symbol,
    interval: opts.interval,
    datafeed: opts.datafeed,
    autosize: true,
    timezone: 'Etc/UTC',
  });

  return widget;
}
```

Réf Widget Constructor : paramètres et options. citeturn1view2

---

## 4) Dessiner les entrées/sorties (recommandé : `createExecutionShape`)

### 4.1 Pourquoi c’est le meilleur choix
- Affiche des flèches buy/sell “type TradingView”.
- L’utilisateur **ne peut pas** déplacer ces exécutions dans l’UI (ce que tu veux pour un historique). citeturn1view1
- Tu peux configurer : `direction`, `time`, `price`, `text`, `tooltip`, couleurs, etc. citeturn6view2

### 4.2 Snippet : poser une exécution

```ts
type Execution = {
  tradeId: string;
  side: 'BUY' | 'SELL';
  time: number;  // epoch seconds
  price: number;
  qty?: number;
  label?: string;    // ex: 'Entry' / 'Exit'
  tooltip?: string;  // ex: 'Entry: 1 @ 5351.25\nStrategy: ...'
};

async function addExecution(widget: any, e: Execution) {
  const chart = widget.activeChart();

  const exec = await chart.createExecutionShape();

  exec
    .setTime(e.time)
    .setPrice(e.price)
    .setDirection(e.side === 'BUY' ? 'buy' : 'sell')
    .setText(e.label ?? '')
    .setTooltip(e.tooltip ?? '')

  return exec; // IExecutionLineAdapter
}
```

- `createExecutionShape` est listé côté primitives de trading. citeturn1view0
- `IExecutionLineAdapter` expose `setTime/setPrice/setDirection/setText/setTooltip` + getters. citeturn6view2

> Note temps : utilise des timestamps qui correspondent à des points existants sur le chart ; sinon TradingView “snap” au point le plus proche. (Même logique sur les drawings.) citeturn1view1

### 4.3 Gestion refresh / cleanup
Tu dois pouvoir:
- supprimer tous les markers quand l’utilisateur change de symbole/période
- recharger la bonne plage

```ts
const executionsById = new Map<string, any>();

function clearExecutions() {
  for (const exec of executionsById.values()) exec.remove();
  executionsById.clear();
}

async function renderExecutions(widget: any, list: Execution[]) {
  clearExecutions();
  for (const e of list) {
    const exec = await addExecution(widget, e);
    executionsById.set(e.tradeId, exec);
  }
}
```

Le `remove()` est disponible sur l’adapter. citeturn6view0

---

## 5) Alternative (si besoin de contrôle total) : `createShape`

Si les execution shapes ne suffisent pas (ex: style ultra custom), tu peux émuler via `createShape` (icônes/markers/traits). citeturn1view1

Points importants :
- `createShape(point, options)` pour un marker “1 point”. citeturn1view1
- Tu peux verrouiller certains comportements via options (ex: `lock`) et piloter les overrides. citeturn1view1
- L’API fournit aussi `getAllShapes()` et `removeEntity(id)` pour gérer le cycle de vie. citeturn1view1

---

## 6) Datafeed : exigences minimales (rappel)

- Branche ton datafeed au paramètre `datafeed` du widget. citeturn1view3
- Les callbacks de Datafeed API doivent être appelés **asynchrones** (pas en synchro directe). citeturn1view3

👉 Si tu veux livrer vite : commence par **UDF adapter** (backend HTTP JSON). citeturn0search19

---

## 7) UX “Review your entries & exits” (comportement produit)

Recommandation simple (sans sur-ingénierie) :
- Un toggle “Show entries/exits”
- Un filtre (date, session, stratégie, compte)
- Au hover/click sur une flèche : tooltip court (qty, price, time, R:R, PnL)

Côté chart :
- Tooltips via `setTooltip()`
- Label compact via `setText()`

citeturn6view2

---

## 8) Checklist de livraison (Definition of Done)

- [ ] Widget s’initialise (container + library_path + datafeed + symbol + interval)
- [ ] `onChartReady` utilisé avant toute action chart citeturn1view4
- [ ] Datafeed renvoie des bars stables (pas d’appel synchro aux callbacks) citeturn1view3
- [ ] Entries/Exits visibles via `createExecutionShape`
- [ ] Tooltips/labels configurés (`setTooltip`, `setText`)
- [ ] Cleanup sur changement de symbole/filtre (remove)

---

## 9) Références utiles (docs)
- API Reference (global) citeturn0search23
- Widget Constructor citeturn1view2
- Widget methods (`onChartReady`) citeturn1view4
- Datafeed API citeturn1view3
- Drawings API (createShape / createExecutionShape) citeturn1view1
- Trading primitives (createExecutionShape) citeturn1view0
- IExecutionLineAdapter (setText/setTooltip/etc.) citeturn6view2
# TradingView Charting Library — Guide BMAD (Entries & Exits)

## Objectif
Afficher, sur un graphique TradingView embarqué (Charting Library), les **points d’entrée** et **points de sortie** d’un utilisateur sous forme de flèches buy/sell (style TradingView), avec tooltip/label, et un cycle de vie propre (render, refresh, cleanup).

## Pré‑requis (à valider avant dev)
- Toutes les actions chart doivent être faites **après** `widget.onChartReady(...)`.
- `createExecutionShape()` appartient aux primitives “trading”. Selon la version/licence, ces primitives peuvent être limitées (ex: certaines versions les réservent à *Trading Platform*). **Vérifie** que ton bundle de Charting Library expose bien `activeChart().createExecutionShape()`.

---

## 1) Choix technique

### Option A — Native (recommandé) : `createExecutionShape()`
- Rend un marqueur d’exécution type TradingView (buy/sell).
- Idéal pour un historique: l’utilisateur ne doit pas “déplacer” l’exécution.
- Retourne un adapter (ex: `IExecutionLineAdapter`) pour configurer temps/prix/texte/tooltip/style.

### Option B — Fallback : `createShape()`
- Si `createExecutionShape` indisponible ou trop limité, émule une flèche via `createShape`.
- Attention: si ton `time` ne correspond pas à un bar existant, le marker peut “snap” au point le plus proche.

---

## 2) Contrat de données (stable, minimal)

### 2.1 Interface front
```ts
export interface ExecutionMarker {
  id: string;                // stable (tradeId)
  symbol: string;
  time: number;              // unix seconds
  price: number;
  side: 'buy' | 'sell';
  qty?: number;
  text?: string;             // label court (ex: "Entry", "Exit", "@5351.25")
  tooltip?: string;          // tooltip multi-ligne court
  arrowColor?: string;       // override éventuel
  textColor?: string;
}
```

### 2.2 Endpoint backend (conseillé)
`GET /api/trades/executions?symbol=...&from=...&to=...`
- Répond un tableau de `ExecutionMarker` (ou DTO équivalent)
- Normalise **time = unix seconds**

---

## 3) Intégration widget (minimum)

### 3.1 Création (rappel)
- Instancier le widget avec `container`, `library_path`, `datafeed`, `symbol`, `interval`, etc.

### 3.2 Séquencement obligatoire
```ts
widget.onChartReady(() => {
  const chart = widget.activeChart();
  // toute action chart ici
});
```

---

## 4) Implémentation — rendu idempotent (no duplicates)

### 4.1 Store + cleanup
```ts
const executionsById = new Map<string, any>(); // adapter

function clearExecutions() {
  for (const exec of executionsById.values()) exec.remove();
  executionsById.clear();
}
```

### 4.2 Fonction principale: `updateExecutions(markers)`
> Choix volontaire: **clear → render** (simple, robuste). Optimiser plus tard si nécessaire.

```ts
async function updateExecutions(widget: any, markers: ExecutionMarker[]) {
  const chart = widget.activeChart();

  // Idempotent
  clearExecutions();

  for (const m of markers) {
    const exec = await chart.createExecutionShape();

    exec
      .setTime(m.time)
      .setPrice(m.price)
      .setDirection(m.side) // 'buy' | 'sell'
      .setText(m.text ?? '')
      .setTooltip(m.tooltip ?? '');

    // Style (si supporté par ta version)
    if (m.arrowColor) exec.setArrowColor(m.arrowColor);
    if (m.textColor) exec.setTextColor(m.textColor);

    // Tuning (si supporté)
    // exec.setArrowHeight(14).setArrowSpacing(4);

    executionsById.set(m.id, exec);
  }
}
```

### 4.3 Style “Match Screenshot” (suggestion)
- Entry (buy): flèche vers le haut, couleur bleu/vert
- Exit (sell): flèche vers le bas, couleur rouge
- Tooltip: message court type “Review your entries & exits” + détails trade

Exemple de mapping :
```ts
const DEFAULT_STYLE = {
  buy:  { arrowColor: '#2962FF' },
  sell: { arrowColor: '#F23645' },
};
```

### 4.4 Z‑Index
- Les executions sont souvent au premier plan.
- Si tu utilises `createShape` en fallback, fixe un `zOrder`/`zOrder: 'top'` si disponible dans tes options.

---

## 5) Datafeed — règle anti‑crash
Si tu implémentes la Datafeed API: **appelle les callbacks de manière asynchrone** (évite les appels synchrones directs dans la même stack).

---

## 6) Snippet “Truth” (anti‑hallucination)
À coller dans Cursor si un modèle invente des paramètres :

```js
const chart = widget.activeChart();
const exec = await chart.createExecutionShape();

exec
  .setText('@1,320.75 Limit')
  .setTooltip('Review your entries & exits')
  .setTextColor('rgba(255,255,255,1)')
  .setArrowColor('#F23645')
  .setDirection('sell') // 'buy' | 'sell'
  .setTime(timestampSeconds)
  .setPrice(price);
```

---

## 7) UX recommandée (simple)
- Toggle: “Show entries/exits”
- Filtres: date range, session, compte, stratégie
- Hover/click: tooltip court (qty, price, time, PnL, R:R)

---

## 8) Checklist DoD
- [ ] Widget init OK (library_path, container, datafeed, symbol, interval)
- [ ] Toute action chart est après `onChartReady`
- [ ] Datafeed callbacks asynchrones
- [ ] `updateExecutions()` idempotent (pas de doublons)
- [ ] Cleanup via `remove()`
- [ ] Tooltips/labels visibles
- [ ] Fallback possible via `createShape`

---

## 9) Add‑on BMAD (token‑friendly)

### 9.1 À ajouter dans `PROJECT_BRIEF.md` (court)
```md
## Feature: Trade Execution Visualization
- Chart: TradingView Charting Library
- Primary API: widget.activeChart().createExecutionShape() (entries/exits)
- Data: ExecutionMarker[] (time seconds, price, side, text, tooltip)
- Style: buy=blue/green, sell=red; tooltip="Review your entries & exits"
- Behavior: idempotent re-render (clear then render)
- Note: execution primitives availability depends on your Charting Library bundle/license
```

### 9.2 Workflow Cursor (prompts prêts à coller)

**Phase 1 — Triage & Plan (Haiku 4.5)**
> @PROJECT_BRIEF.md @<TON_COMPONENT_CHART>.tsx
> Goal: afficher entries/exits via createExecutionShape.
> Plan requis:
> 1) Ajouter `ExecutionMarker` + mapping BUY/SELL.
> 2) Créer `updateExecutions(markers)` idempotent (clear -> render).
> 3) Gérer lifecycle (onChartReady, cleanup unmount + symbol change).
> Liste les fichiers à modifier.

**Phase 2 — Implémentation (Sonnet 4.5)**
> Applique le plan.
> Constraints:
> - Utilise `chart.createExecutionShape()` + `setTime/setPrice/setDirection/setText/setTooltip`.
> - Style: arrowHeight 14, arrowSpacing 4 (si supporté).
> - Output: diff only, no explanations, max 60 lignes de logique.
> - Idempotent: clear before render.
# Boat Tracker — Documentação do Projeto

Painel de monitoramento de barcos autônomos de coleta de dados ambientais.
Exibe trajetos de missões sobre um mapa dinâmico, leituras ponto a ponto de
sensores de qualidade da água, frames de câmera por ponto e um relevo
batimétrico 3D estimado das leituras de profundidade.

O app roda localmente na porta `8080` e pode ser exposto pela internet via túnel
Cloudflare:

```sh
npm run dev
cloudflared tunnel --url http://localhost:8080
```

---

## Sumário

1. [Stack e ferramentas](#stack-e-ferramentas)
2. [Estrutura de pastas](#estrutura-de-pastas)
3. [As duas abas](#as-duas-abas)
   - [Aba 1 — Mapa](#aba-1--mapa)
   - [Aba 2 — Análises / Batimetria](#aba-2--análises--batimetria)
4. [Fluxo dos dados (do CSV à tela)](#fluxo-dos-dados-do-csv-à-tela)
5. [Scripts utilitários (Python)](#scripts-utilitários-python)
6. [Execução local e túnel](#execução-local-e-túnel)

---

## Stack e ferramentas

### Frontend / aplicação

| Ferramenta                 | Versão      | Papel no projeto                                                         |
| -------------------------- | ----------- | ------------------------------------------------------------------------ |
| React                      | 19.2        | Biblioteca de UI; renderização SSR + cliente.                             |
| TanStack Start             | 1.168.x     | Framework full-stack (SSR/SSG + server functions) sobre Vite.            |
| TanStack Router            | 1.170.x     | Roteamento baseado em arquivos (`src/routes`).                           |
| TanStack Query             | 5.101.x     | Busca/cache/invalidação das missões (`useSuspenseQuery`).                |
| Vite                       | 8.2         | Bundler e dev server (porta 8080).                                        |
| TypeScript                 | 5.8         | Tipagem estática de todo o código.                                       |
| Tailwind CSS               | 4.2         | Estilização por tokens semânticos (oklch) em `src/styles.css`.            |
| Leaflet                    | 1.9.4       | Mapa dinâmico (tiles OpenStreetMap), carregado só no navegador.           |
| lucide-react               | 0.575       | Ícones da sidebar e controles.                                            |
| Radix UI / shadcn          | várias      | Primitivos de UI acessíveis.                                              |
| sonner                     | 2.0.7       | Notificações (toasts).                                                    |
| zod                        | 3.24        | Validação de entrada em server functions.                                |

### Backend / runtime

| Ferramenta                 | Papel                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| Nitro (Cloudflare Workers) | Servidor SSR/serverless onde rodam as server functions e a rota de frames. |
| `createServerFn`           | RPC tipado cliente→servidor (`getMissions`).                          |
| `import.meta.glob` (Vite)  | Em produção, embute os CSVs de `data/` no bundle (fallback sem disco). |
| Node `fs`/`path`            | Em dev/local, lê os CSVs e frames do disco.                           |

### Python (scripts utilitários, fora do app)

| Ferramenta            | Versão   | Papel                                                        |
| --------------------- | -------- | ------------------------------------------------------------ |
| Python 3              | 3.x      | Linguagem dos scripts de geração/conversão de CSV.           |
| `rosbags` (AnyReader) | —        | Leitura de bags ROS 2 `.db3` (tópicos, timestamps, mensagens). |
| `rclpy` (ROS 2)       | Humble+  | Modo `--source ros2` do `ros2_to_csv.py`: assina tópicos ao vivo. |
| `numpy`               | —        | Processamento de imagens `sensor_msgs/Image` no `mavros_db3_to_csv.py`. |
| `opencv` (`cv2`)      | —         | Codificação de frames `bgr8`→JPEG no `mavros_db3_to_csv.py`. |
| `sensor_msgs`         | Humble   | Tipos `NavSatFix`, `CompressedImage`, `Image`, `Range`.      |

> Os scripts Python rodam **fora** da aplicação, no ambiente ROS 2 ou na
> máquina de operação. A aplicação web só consome os arquivos `.csv` e os
> frames `.jpg` que eles produzem.

---

## Estrutura de pastas

```
src/
  routes/
    __root.tsx              # Shell HTML, fontes, QueryClientProvider
    index.tsx               # Rota "/": sidebar + aba ativa + painel de missões
    api/public/frames/$.ts  # Rota de servidor que serve os frames da câmera
  components/tracker/
    Sidebar.tsx             # Trilho de navegação esquerdo (Mapa / Análises)
    MapView.tsx             # Aba 1: mapa + card de leitura + bússola + controles
    MissionMap.tsx          # Leaflet/OSM carregado via lazy+ClientOnly
    ReadingCard.tsx         # Card "Dados nesta posição" (hover/clique)
    BathymetryView.tsx      # Aba 2: relevo 3D do fundo
    MissionPanel.tsx        # Painel direito "Missões do usuário"
  lib/
    missions.server.ts      # Leitura/parsing dos CSVs → tipo Mission/Reading
    missions.functions.ts   # Server function getMissions (RPC)
    bathymetry.ts           # Interpolação das profundidades (Mono P) → mesh 3D
    format.ts               # Helpers de formatação de datas
data/
  missao-AAAAMMDD.csv       # Um arquivo por missão (lido em dev e embutido em prod)
  frames/<mission_id>/*.jpg # Frames de câmera referenciados pelas colunas frame_*
docs/
  FORMATO-CSV.md            # Especificação do formato do CSV
  PROJETO.md                # Este arquivo
tools/
  ros2_to_csv.py            # Gera CSV completo (sim ou tópicos ROS 2 ao vivo)
  db3_to_csv.py             # Converte bag .db3 genérico em CSV
  mavros_db3_to_csv.py      # Converte bag do gravador MAVROS (GPSRAW + câmeras)
```

---

## As duas abas

A barra lateral (`Sidebar.tsx`) alterna entre duas seções. Apenas **Mapa**
(índice 1) e **Análises** (índice 2) estão ativas; os demais itens são
placeholder ("em breve"). O estado `section` em `index.tsx` seleciona qual
componente renderizar no centro:

```tsx
{section === 2 ? <BathymetryView mission={selected} />
               : <MapView mission={selected} />}
```

O painel direito `MissionPanel` (lista de missões) e o trilho esquerdo são
sempre visíveis, independentemente da aba.

### Aba 1 — Mapa

`MapView.tsx` envolve o `MissionMap` (Leaflet) e adiciona a camada de
interação e os overlays.

**O que mostra**

- Trajeto da missão como uma *polyline* azul sobre tiles do OpenStreetMap,
  com marcadores circulares em cada leitura.
- Marcadores **P** (partida, praia) e **C** (chegada, outro ponto da praia)
  nas extremidades do trajeto.
- Header com data, local e duração da missão.
- Bússola (rosa dos ventos) no canto superior direito: a agulha azul aponta
  para o **N**; clicar re-alinha o mapa ao norte e reenquadra o trajeto.
- Controles de zoom (+/−) e "centralizar no trajeto" (fit bounds) no canto
  inferior esquerdo.
- Card **"Dados nesta posição"** (`ReadingCard`) ancorado ao ponto ativo.

**Interação do card**

- O card **some** por padrão.
- Ao passar o mouse sobre um ponto, ele **aparece solto** (hover).
- Ao clicar no ponto, ele **fixa** (pinned).
- Clicar em **qualquer lugar do mapa** (não só no ponto) **solta** a fixação.
- Um `useLayoutEffect` com `ResizeObserver` calcula a posição do card e aplica
  *flip* (horizontal/vertical) e *clamp* para que ele nunca saia do canvas —
  mesmo nos pontos mais baixos da tela.

**Frames de câmera**

O card mostra as imagens de vante e de ré referenciadas pelas colunas
`frame_v` / `frame_r` daquela linha do CSV (servidas por
`/api/public/frames/*` ou URL direta). Quando a coluna está vazia, a câmera
aparece como **OFF** com placeholder. (Em dados de teste, o `frame` antigo
ainda mantém a imagem fixa; ver `docs/FORMATO-CSV.md`.)

### Aba 2 — Análises / Batimetria

`BathymetryView.tsx` gera um relevo 3D do fundo a partir das leituras de
profundidade (**Mono P**, em metros) da missão.

**Como funciona**

1. `buildBathymetry` (`lib/bathymetry.ts`) filtra leituras com `mono_p`
   válido e coordenadas finas, converte lat/lon em metros (projeção
   equiretangular local) e agrupa posições repetidas pela média.
2. Calcula o *convex hull* dos pontos e monta uma malha 36×36 recortada ao
   contorno do hull; cada célula recebe profundidade por **interpolação
   ponderada pelo inverso da distância** (IDW, 8 vizinhos).
3. `BathymetryView` projeta cada célula em 3D (rotação + inclinação + zoom)
   e renderiza `<polygon>` coloridos por profundidade (gradiente raso→fundo).
4. O usuário **arrasta** para girar, **roda a roda** para zoom, e usa sliders
   de rotação/inclinação/zoom/exagero vertical + checkbox de posições medidas.

Se a missão não tiver profundidades válidas, exibe um aviso em vez do relevo.

---

## Fluxo dos dados (do CSV à tela)

```
data/missao-*.csv                         (um arquivo por missão, em disco)
        │
        ▼  readCsvFiles()  ────────── dev/local: readdir(CSV_DIR) + readFile
        │                    prod:     fallback para CSVs embutidos no bundle
        ▼  parseCsv()  (splitLine com aspas/vírgulas)
        │  → rows de metadados + leituras
        ▼  loadMissions()  agrupa por mission_id → Mission[]
        │  • frameUrl() resolve frame/frame_v/frame_r
        │    (URL http passa direto; caminho relativo vira /api/public/frames/…)
        ▼  getMissions  (server function, createServerFn GET)
        │
        ▼  loader de index.tsx  →  ensureQueryData(["missions"])
        ▼  useSuspenseQuery(["missions"])  →  Mission[] no cliente
        │
        ├─ MissionPanel   lista cada Mission (data, local, coletas disponíveis)
        ├─ MapView        desenha readings[].{lat,lon} como trajeto + marcadores
        │   └─ ReadingCard mostra readings[i] (sensores + frames) no ponto ativo
        └─ BathymetryView buildBathymetry(readings) → relevo de mono_p

frames: data/frames/<mission_id>/*.jpg
        │
        ▼  GET /api/public/frames/<caminho>   (src/routes/api/public/frames/$.ts)
        │   • resolve contra CSV_DIR (padrão ./data)
        │   • bloqueia path traversal (full.startsWith(base))
        │   • content-type por extensão (.jpg/.png/.webp)
        ▼  <img src="…"> no ReadingCard
```

**Pontos-chave do fluxo**

- **Uma missão = um CSV.** Cada arquivo em `data/` vira uma `Mission`; o
  `mission_id` (ou o nome do arquivo) agrupa as linhas. A ordem das linhas
  define a ordem temporal do trajeto no mapa.
- **Server function.** `getMissions` roda no servidor (Nitro/Worker); o
  cliente nunca lê o disco. Em produção, sem filesystem, cai nos CSVs
  embutidos via `import.meta.glob('../../data/*.csv', { query: '?raw' })`.
- **Frames.** A rota `/api/public/frames/*` serve imagens só de dentro da
  pasta de dados. No preview/produção publicada os frames exigem acesso ao
  disco real; em dev/local funcionam normalmente.
- **Cache.** TanStack Query guarda `["missions"]`; o loader pré-aquece o
  cache antes do render (evita flashe de loading).
- **Interação.** No mapa, `hover`/`click` sobre um marcador definem o índice
  ativo; o `ReadingCard` lê `mission.readings[índice]` e se reposiciona sobre
  o ponto em coordenadas de container (atualizado em `move/zoom/resize`).

---

## Scripts utilitários (Python)

Três scripts em `tools/`, executados fora da aplicação:

### `ros2_to_csv.py` — geração completa do CSV

Gera o arquivo **inteiro** (cabeçalho, metadados da missão e todas as
leituras) mais os frames. Dois modos:

- **`--source sim` (padrão):** missão sintética — trajeto praia → varredura
  zigue-zague na água → outro ponto de praia, sensores plausíveis e frames
  copiados de `src/assets/camera-frontal.jpg`. Não depende de ROS 2 nem de
  hardware; garante que o app sempre tenha dados para mostrar.
- **`--source ros2`:** assina tópicos reais (`/gps/fix`, câmera
  `CompressedImage`, sensores `Float32`) por `--duracao` a cada
  `--intervalo`, grava o JPEG de cada amostra em
  `data/frames/<mission_id>/<HHMMSS>.jpg` e escreve o caminho relativo na
  coluna `frame`. Encerra sozinho ao fim do tempo.

```sh
python tools/ros2_to_csv.py --mission-id OP-20260601 --duracao 5h --intervalo 60s
```

### `db3_to_csv.py` — bag genérico para CSV

Converte um bag `.db3` (ROS 2) em CSV, amostrando a cada `--intervalo` no
gatilho de cada fix GPS. Aceita mapear tópicos de sensor para colunas via
`--topic-sensor coluna /topico`.

### `mavros_db3_to_csv.py` — bag do gravador MAVROS

Conversor específico para as gravações feitas pelo `rosbag.py` do MAVROS:

- `/mavros/gpsstatus/gps2/raw` (`GPSRAW`, lat/lon em graus × 1e7) → colunas
  `lat`/`lon`;
- `/mavros/camera/f/raw` (front, `bgr8`) → `frame_v` (câmera de vante);
- `/mavros/camera/b/raw` (back) → `frame_r` (câmera de ré);
- rangefinder em `/mavros/rangefinder/rangefinder` → `mono_p`.

Codifica os frames `sensor_msgs/Image` em JPEG com OpenCV.

```sh
python3 tools/mavros_db3_to_csv.py --db3-path data/bags/teste1 \
  --mission-id OP-20260416 --intervalo 5s --topic-sensor mono_p /mavros/rangefinder/rangefinder
```

O formato completo dos CSVs gerados está em [`docs/FORMATO-CSV.md`](FORMATO-CSV.md).

---

## Execução local e túnel

```sh
npm i
npm run dev                       # sobe em http://localhost:8080
cloudflared tunnel --url http://localhost:8080
```

O `vite.config.ts` já permite hosts `.trycloudflare.com` no dev server. Os
CSVs em `data/` são lidos do disco em dev; em produção (publicado) o app usa
os CSVs embutidos no bundle, e os frames só são servidos onde há acesso ao
filesystem da pasta de dados.
